// Turns stored text into safe links and readable phrases. Anything an administrator typed is
// only ever used as a link if it passes these checks (no javascript: or other odd schemes).
const digits = (s) => String(s || '').replace(/\D/g, '');

export const telHref = (phone) => {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return digits(clean).length >= 6 ? `tel:${clean}` : '';
};
export const whatsappHref = (n) => (digits(n).length >= 6 ? `https://wa.me/${digits(n)}` : '');
export const webHref = (v) => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
export const instagramHref = (v) => {
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return webHref(v);
  const handle = v.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : '';
};
export const prettyUrl = (u) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

export const joinList = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export const FACTS = [
  ['duration', 'Duration'],
  ['batchTimings', 'Batch timings'],
  ['fee', 'Fee'],
  ['location', 'Location'],
  ['demoAvailability', 'Demo classes'],
];
export const filledFacts = (course) => FACTS.filter(([k]) => course[k]).map(([k, label]) => [label, course[k]]);

export const mapsHref = (address) => (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
export const mailHref = (e) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '') ? `mailto:${e}` : '');
// "Classes 8-12" from the course class labels (e.g. "8-10" and "11-12"), or '' when they aren't numbers.
export function classRange(courses) {
  const nums = courses.flatMap((c) => (String(c.class).match(/\d+/g) || []).map(Number)).filter((n) => n >= 1 && n <= 12);
  return nums.length ? `${Math.min(...nums)}–${Math.max(...nums)}` : '';
}
