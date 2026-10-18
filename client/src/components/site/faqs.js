// The FAQ list: questions the administrator wrote, followed by answers built from the records on
// file (courses, address, contact details). Nothing is made up: if a fact isn't saved, its question isn't shown.
const list = (items) => items.join('\n');

export function buildFaqs(site) {
  const { institute: i, courses, faqs } = site;
  const out = faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }));

  if (courses.length) {
    out.push({
      id: 'auto-courses', question: 'Which courses do you offer?',
      answer: list(courses.map((c) => `${c.name}${c.class ? ` (Class ${c.class})` : ''}${c.description ? `: ${c.description}` : ''}`)),
    });
  }
  const fees = courses.filter((c) => c.fee);
  if (fees.length) out.push({ id: 'auto-fees', question: 'What are the fees?', answer: list(fees.map((c) => `${c.name}: ${c.fee}`)) });
  const timings = courses.filter((c) => c.batchTimings);
  if (timings.length) out.push({ id: 'auto-timings', question: 'What are the batch timings?', answer: list(timings.map((c) => `${c.name}: ${c.batchTimings}`)) });
  const demos = courses.filter((c) => c.demoAvailability);
  if (demos.length) out.push({ id: 'auto-demo', question: 'Can we attend a demo class?', answer: list(demos.map((c) => `${c.name}: ${c.demoAvailability}`)) });
  if (i.address || i.hours) {
    out.push({ id: 'auto-where', question: 'Where are you, and when are you open?', answer: list([i.address && `Address: ${i.address}`, i.hours && `Hours: ${i.hours}`].filter(Boolean)) });
  }
  const contact = [i.phone && `Phone: ${i.phone}`, i.whatsapp && `WhatsApp: ${i.whatsapp}`, i.email && `Email: ${i.email}`].filter(Boolean);
  out.push({ id: 'auto-contact', question: 'How can I get in touch?', answer: list([...contact, 'You can also send an enquiry from the Contact page.']) });
  return out;
}

// Splits stored text into paragraphs on blank lines.
export const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
