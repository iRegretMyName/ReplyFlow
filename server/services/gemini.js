// Gemini wrapper. Keys come from .env only. Returns structured, validated output
// or throws a typed error the route can show in the UI.
const CATEGORIES = ['admissions','fees','courses','batches','timings','location','demo','results','faculty','general','support','spam'];
const TEMPERATURES = ['hot', 'warm', 'cold'];

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'NO_KEY' | 'UNAVAILABLE' | 'INVALID_RESPONSE'
  }
}

function buildPrompt({ message, lead, knowledge }) {
  const knowledgeText = knowledge && Object.values(knowledge).some(Boolean)
    ? Object.entries(knowledge).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
    : '(No institute information has been saved yet.)';

  return `You are a friendly admissions assistant for an education coaching institute.
Analyse the student's enquiry and reply as the institute's staff would.

RULES:
- Only state institute-specific facts (fees, timings, location, batch dates, demo availability) that appear in INSTITUTE KNOWLEDGE below.
- If a needed fact is missing, do NOT invent it. Say you'll check and confirm the details.
- Never claim to be human. Sign off generically (e.g. "Team Admissions").
- Keep the reply polite, concise (2-4 sentences), natural, professional, and not salesy.
- Reply in the same language style the student used (English, Hindi, or Hinglish).

ALLOWED categories: ${CATEGORIES.join(', ')}
ALLOWED leadTemperature: ${TEMPERATURES.join(', ')}
Temperature guide: hot = ready to join or asking fees/demo/admission now; warm = interested, comparing; cold = vague, spam, or general info only.

INSTITUTE KNOWLEDGE:
${knowledgeText}

LEAD: ${JSON.stringify(lead)}
STUDENT MESSAGE: ${JSON.stringify(message)}

Respond with ONLY a JSON object, no markdown, with exactly these keys:
{
  "category": "<one allowed category>",
  "intent": "<short intent phrase>",
  "leadTemperature": "<hot|warm|cold>",
  "confidence": <number between 0 and 1>,
  "reply": "<reply to the student>",
  "suggestedFollowUpHours": <integer>,
  "reasoning": "<one short sentence explaining the classification>"
}`;
}

export async function analyseEnquiry(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (!apiKey || apiKey === 'your_key_here') {
    throw new AiError('NO_KEY', 'GEMINI_API_KEY is not set. Add it to .env and restart the server.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new AiError('UNAVAILABLE', timedOut
      ? 'The AI took too long to respond. Try again.'
      : 'Could not reach the Gemini API. Check your internet connection.');
  }

  if (!res.ok) {
    throw new AiError('UNAVAILABLE', `Gemini API returned ${res.status}. Try again shortly.`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return validate(text);
}

export function validate(raw) {
  let obj;
  try {
    obj = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    throw new AiError('INVALID_RESPONSE', 'AI returned an unreadable response.');
  }

  const category = CATEGORIES.includes(obj.category) ? obj.category : 'general';
  const leadTemperature = TEMPERATURES.includes(obj.leadTemperature) ? obj.leadTemperature : 'warm';
  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
  if (!reply) throw new AiError('INVALID_RESPONSE', 'AI returned an empty reply.');

  const confidence = Math.min(1, Math.max(0, Number(obj.confidence) || 0));
  const hours = Math.round(Number(obj.suggestedFollowUpHours));

  return {
    category,
    intent: String(obj.intent || 'General enquiry').slice(0, 120),
    leadTemperature,
    confidence,
    reply,
    suggestedFollowUpHours: Number.isFinite(hours) && hours > 0 ? hours : 24,
    reasoning: String(obj.reasoning || '').slice(0, 300),
  };
}
