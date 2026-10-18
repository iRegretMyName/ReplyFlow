import { Router } from 'express';
import * as store from '../data/store.js';
import { buildSeed } from '../data/seed.js';
import { newId } from '../utils/ids.js';
import { analyseEnquiry, AiError } from '../services/gemini.js';
import { requireRole } from '../auth/middleware.js';
import coursesRouter from './courses.js';
import faqsRouter from './faqs.js';
import pagesRouter from './pages.js';
import enquiriesRouter from './enquiries.js';
import uploadsRouter from './uploads.js';
import { settings as contentSettings, validateInstitute } from '../data/content.js';

const router = Router();
const db = () => store.load();
const now = () => new Date().toISOString();
const bad = (res, msg) => res.status(400).json({ error: msg });

const LEAD_STATUSES = ['new', 'contacted', 'interested', 'follow-up', 'converted', 'lost'];
const TEMPERATURES = ['hot', 'warm', 'cold'];
const MAX_TEXT = 2000;
const MAX_FIELD = 200;

// Everything in this router sits behind requireAuth (see app.js). req.user is the signed-in staff member.
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clip = (v, max = MAX_FIELD) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const findLead = (id) => db().leads.find((l) => l.id === id);

// A lead's nextFollowUpAt is always the earliest pending follow-up (or null).
function syncNextFollowUp(leadId) {
  const lead = findLead(leadId);
  if (!lead) return;
  const next = db().followups
    .filter((f) => f.leadId === leadId && f.status === 'pending')
    .map((f) => f.scheduledFor)
    .sort()[0];
  lead.nextFollowUpAt = next ?? null;
}

// Seed on first run
if (!db().leads.length && !db().settings) store.replaceAll(buildSeed());

// Make sure settings always has the shape the client expects
if (!db().settings) {
  db().settings = { institute: {}, courses: [], aiKnowledge: {} };
  store.save();
}

// ---------- Leads ----------
router.get('/leads', (_req, res) => res.json(db().leads));

router.get('/leads/:id', (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

router.post('/leads', (req, res) => {
  const { name, phone, class: cls, course, source } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return bad(res, 'Student name is required');
  const lead = {
    id: newId('lead'), name: clip(name), phone: clip(phone, 40), email: '',
    class: clip(cls, 20), course: clip(course), source: clip(source) || 'Manual',
    status: 'new', temperature: 'warm', category: 'general', intent: '',
    createdAt: now(), lastContactedAt: null, nextFollowUpAt: null,
  };
  db().leads.unshift(lead);
  store.save();
  res.status(201).json(lead);
});

router.put('/leads/:id', (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const body = req.body || {};
  if ('status' in body && !LEAD_STATUSES.includes(body.status)) return bad(res, 'Invalid status');
  if ('temperature' in body && !TEMPERATURES.includes(body.temperature)) return bad(res, 'Invalid temperature');
  const allowed = ['name', 'phone', 'email', 'class', 'course', 'source', 'status', 'temperature', 'category', 'intent', 'lastContactedAt'];
  for (const key of allowed) {
    if (!(key in body)) continue;
    const v = body[key];
    const ok = key === 'lastContactedAt' ? v === null || typeof v === 'string' : typeof v === 'string';
    if (!ok) return bad(res, `Invalid ${key}`);
    lead[key] = typeof v === 'string' ? v.slice(0, MAX_FIELD) : v;
  }
  store.save();
  res.json(lead);
});

// ---------- Messages ----------
router.get('/messages/:leadId', (req, res) => {
  res.json(db().messages.filter((m) => m.leadId === req.params.leadId));
});

router.post('/messages', (req, res) => {
  const { leadId, sender, text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return bad(res, 'Message text is required');
  if (text.length > MAX_TEXT) return bad(res, `Message is too long (max ${MAX_TEXT} characters)`);
  if (!['student', 'staff'].includes(sender)) return bad(res, 'Sender must be student or staff');
  const lead = findLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const msg = { id: newId('msg'), leadId, sender, text: text.trim(), timestamp: now(), by: req.user.displayName };
  db().messages.push(msg);
  if (sender === 'staff') lead.lastContactedAt = msg.timestamp;
  store.save();
  res.status(201).json(msg);
});

// ---------- AI ----------
router.post('/reply', async (req, res) => {
  const { message, lead: rawLead } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return bad(res, 'Enquiry message is empty');
  if (message.length > MAX_TEXT) return bad(res, `Enquiry is too long (max ${MAX_TEXT} characters)`);

  // Send only what the model needs. No name, phone, or email goes to Gemini.
  const src = rawLead && typeof rawLead === 'object' ? rawLead : {};
  const lead = {
    class: src.class || '',
    course: src.course || '',
    source: src.source || '',
    status: src.status || '',
  };

  try {
    const result = await analyseEnquiry({
      message: message.trim(),
      lead,
      knowledge: db().settings?.aiKnowledge?.[lead.course] || null,
    });
    res.json(result);
  } catch (err) {
    const status = err instanceof AiError && err.code === 'NO_KEY' ? 503 : 502;
    res.status(status).json({
      error: err.message || 'AI analysis failed',
      code: err.code || 'UNKNOWN',
      fallback: 'You can still categorize this enquiry manually.',
    });
  }
});

// ---------- Follow-ups ----------
router.get('/followups', (_req, res) => res.json(db().followups));

router.post('/followups', (req, res) => {
  const { leadId, scheduledFor, reason } = req.body || {};
  if (!findLead(leadId)) return res.status(404).json({ error: 'Lead not found' });
  if (typeof scheduledFor !== 'string' || Number.isNaN(Date.parse(scheduledFor))) return bad(res, 'Valid scheduledFor date is required');
  const fu = {
    id: newId('fu'), leadId, scheduledFor: new Date(scheduledFor).toISOString(),
    reason: clip(reason, 300) || 'Follow-up', status: 'pending',
  };
  db().followups.push(fu);
  syncNextFollowUp(leadId);
  store.save();
  res.status(201).json(fu);
});

router.put('/followups/:id', (req, res) => {
  const fu = db().followups.find((f) => f.id === req.params.id);
  if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
  const body = req.body || {};
  if ('status' in body && !['pending', 'completed', 'cancelled'].includes(body.status)) return bad(res, 'Invalid status');
  if ('scheduledFor' in body && (typeof body.scheduledFor !== 'string' || Number.isNaN(Date.parse(body.scheduledFor)))) return bad(res, 'Invalid scheduledFor date');
  if ('reason' in body && typeof body.reason !== 'string') return bad(res, 'Invalid reason');
  for (const key of ['status', 'scheduledFor', 'reason']) if (key in body) fu[key] = key === 'reason' ? clip(body.reason, 300) : body[key];
  syncNextFollowUp(fu.leadId);
  store.save();
  res.json(fu);
});

// ---------- Dashboard ----------
router.get('/dashboard', (_req, res) => {
  const { leads, followups } = db();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const weekAgo = Date.now() - 7 * 86400_000;
  const dueToday = followups.filter((f) => f.status === 'pending' && new Date(f.scheduledFor) <= endOfDay);
  res.json({
    totalLeads: leads.length,
    newThisWeek: leads.filter((l) => new Date(l.createdAt).getTime() > weekAgo).length,
    newToday: leads.filter((l) => new Date(l.createdAt) >= startOfDay).length,
    hotLeads: leads.filter((l) => l.temperature === 'hot' && !['converted', 'lost'].includes(l.status)).length,
    followUpsDue: dueToday.length,
    converted: leads.filter((l) => l.status === 'converted').length,
    newEnquiries: (db().enquiries || []).filter((e) => e.status === 'new').length,
    recentLeads: [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
  });
});

// ---------- Settings ----------
router.get('/settings', (_req, res) => res.json(db().settings));

// Institute details appear on the public website, so only administrators can change them.
// Courses (and the facts the AI may state about them) are managed through /courses.
router.put('/settings', requireRole('admin'), (req, res) => {
  const body = req.body;
  if (!isPlainObject(body)) return bad(res, 'Invalid settings');
  if ('courses' in body || 'aiKnowledge' in body) return bad(res, 'Courses are managed through /api/courses');
  if ('institute' in body) {
    const { value, fields } = validateInstitute(body.institute);
    if (fields) return res.status(400).json({ error: 'Please check the highlighted fields.', fields });
    const s = contentSettings();
    s.institute = { ...s.institute, ...value };
    store.save();
  }
  res.json(db().settings);
});

router.use('/courses', coursesRouter);
router.use('/faqs', faqsRouter);
router.use('/pages', pagesRouter);
router.use('/enquiries', enquiriesRouter);
router.use('/uploads', uploadsRouter);

export default router;
