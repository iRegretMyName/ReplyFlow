// The website's manageable content. One set of records feeds the public website, the admin panel
// and the AI assistant (which may only state facts saved here).
//
// Storage (all inside db.json, so existing data keeps working):
//   settings.institute            contact details
//   settings.courses[]            id, slug, name, class, description, eligibility, highlights[], curriculum[],
//                                 image, featured, published
//   settings.aiKnowledge[name]    duration, batchTimings, fee, location, demoAvailability
//   settings.faqs[]               id, question, answer, published
//   settings.pages                announcement, home, about, privacy, terms
//   enquiries[]                   messages sent through the website's contact form
// This module is the only place that combines or validates them.
import * as store from './store.js';
import { newId } from '../utils/ids.js';
import { imageExists, removeImage, NAME_RE } from './uploads.js';

export const FACT_KEYS = ['duration', 'batchTimings', 'fee', 'location', 'demoAvailability'];
const LIMITS = { name: 80, class: 20, description: 600, eligibility: 200, duration: 120, batchTimings: 200, fee: 120, location: 200, demoAvailability: 200 };
const LABELS = { name: 'Name', class: 'Class', description: 'Description', eligibility: 'Eligibility', duration: 'Duration', batchTimings: 'Batch timings', fee: 'Fee', location: 'Location', demoAvailability: 'Demo availability' };
const LISTS = { highlights: { label: 'Highlights', max: 8, item: 120 }, curriculum: { label: 'Curriculum', max: 12, item: 120 } };
// Control characters have no place in names or descriptions (newlines and tabs are fine).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isHttpUrl = (t) => { try { return ['http:', 'https:'].includes(new URL(t).protocol); } catch { return false; } };

export const slugify = (text) => {
  const s = String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || 'course';
};
function uniqueSlug(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) { const c = `${base.slice(0, 56)}-${n}`; if (!taken.has(c)) return c; }
}

export function settings() {
  const d = store.load();
  d.settings ??= {};
  const s = d.settings;
  s.institute ??= {};
  s.courses ??= [];
  s.aiKnowledge ??= {};
  s.faqs ??= [];
  s.pages ??= {};
  d.enquiries ??= [];
  // Courses saved before slugs existed get one (this runs once, then it is stored).
  if (s.courses.some((c) => !c.slug)) {
    const taken = new Set(s.courses.map((c) => c.slug).filter(Boolean));
    for (const c of s.courses) if (!c.slug) { c.slug = uniqueSlug(slugify(c.name), taken); taken.add(c.slug); }
    store.save();
  }
  return s;
}

export const imagesInUse = () => {
  const s = settings();
  const set = new Set(s.courses.map((c) => c.image).filter(Boolean));
  for (const name of [s.pages.home?.heroImage, s.pages.about?.image]) if (name) set.add(name);
  return set;
};
// Removes an uploaded file once nothing uses it any more.
const release = (name) => { if (name && !imagesInUse().has(name)) removeImage(name); };
export const imageUrl = (name) => (name && NAME_RE.test(name) ? `/uploads/${name}` : '');

// ---------- text helpers ----------
function cleanText(raw, label, max, fields, key) {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') { fields[key] = `${label} must be text.`; return null; }
  const t = raw.trim();
  if (CONTROL.test(t)) { fields[key] = `${label} contains characters that aren't allowed.`; return null; }
  if (t.length > max) { fields[key] = `${label} can be at most ${max} characters.`; return null; }
  return t;
}
function cleanList(raw, { label, max, item }, fields, key) {
  if (raw === undefined || raw === null) return [];
  const arr = typeof raw === 'string' ? raw.split('\n') : raw;
  if (!Array.isArray(arr) || arr.some((x) => typeof x !== 'string')) { fields[key] = `${label} must be a list of text lines.`; return null; }
  const out = arr.map((x) => x.trim()).filter(Boolean);
  if (out.length > max) { fields[key] = `${label} can have at most ${max} lines.`; return null; }
  const bad = out.find((x) => x.length > item || CONTROL.test(x));
  if (bad !== undefined) { fields[key] = `Each line in ${label} can be at most ${item} characters.`; return null; }
  return out;
}
const failed = (fields) => Object.keys(fields).length > 0;

// ---------- courses ----------
export function mergedCourse(c, s = settings()) {
  const k = s.aiKnowledge[c.name] || {};
  const out = {
    id: c.id, slug: c.slug, name: c.name, class: c.class || '', description: c.description || '',
    eligibility: c.eligibility || '', highlights: c.highlights || [], curriculum: c.curriculum || [],
    image: c.image || '', featured: c.featured === true,
    published: c.published !== false, // courses saved before this field existed stay visible
  };
  for (const f of FACT_KEYS) out[f] = typeof k[f] === 'string' ? k[f] : '';
  return out;
}
export const listCourses = () => settings().courses.map((c) => mergedCourse(c));
export const findCourse = (id) => settings().courses.find((c) => c.id === id);

export function validateCourse(input, { ignoreId } = {}) {
  const fields = {};
  const value = {};
  if (!isPlain(input)) return { fields: { _form: 'Invalid request.' } };
  const s = settings();

  for (const key of ['name', 'class', 'description', 'eligibility', ...FACT_KEYS]) {
    const t = cleanText(input[key], LABELS[key], LIMITS[key], fields, key);
    if (t !== null) value[key] = t;
  }
  for (const key of Object.keys(LISTS)) {
    const l = cleanList(input[key], LISTS[key], fields, key);
    if (l !== null) value[key] = l;
  }
  if (!fields.name) {
    if (value.name.length < 2) fields.name = 'Enter the course name (at least 2 characters).';
    else if (s.courses.some((c) => c.id !== ignoreId && c.name.toLowerCase() === value.name.toLowerCase())) fields.name = 'A course with this name already exists.';
  }
  const published = input.published ?? true;
  if (typeof published !== 'boolean') fields.published = 'Must be true or false.'; else value.published = published;
  const featured = input.featured ?? false;
  if (typeof featured !== 'boolean') fields.featured = 'Must be true or false.'; else value.featured = featured;

  const image = input.image ?? '';
  if (typeof image !== 'string' || (image && !imageExists(image))) fields.image = 'That image could not be found. Upload it again.';
  else value.image = image;

  // The page address. Left blank it is made from the name; once set it stays put unless edited.
  const rawSlug = input.slug ?? '';
  if (typeof rawSlug !== 'string') fields.slug = 'Page address must be text.';
  else if (rawSlug.trim() && !SLUG_RE.test(rawSlug.trim()) ) fields.slug = 'Use lowercase letters, numbers and single dashes, e.g. jee-main-advanced.';
  else if (rawSlug.trim().length > 60) fields.slug = 'Page address can be at most 60 characters.';
  else if (rawSlug.trim() && s.courses.some((c) => c.id !== ignoreId && c.slug === rawSlug.trim())) fields.slug = 'Another course already uses this page address.';
  else value.slug = rawSlug.trim();

  return failed(fields) ? { fields } : { value };
}

const factsOf = (v) => Object.fromEntries(FACT_KEYS.map((f) => [f, v[f]]));
const storable = (v) => ({ name: v.name, class: v.class, description: v.description, eligibility: v.eligibility, highlights: v.highlights, curriculum: v.curriculum, image: v.image, featured: v.featured, published: v.published });

export function createCourse(v) {
  const s = settings();
  const taken = new Set(s.courses.map((c) => c.slug));
  const course = { id: newId('c'), slug: v.slug || uniqueSlug(slugify(v.name), taken), ...storable(v) };
  s.courses.push(course);
  s.aiKnowledge[v.name] = factsOf(v);
  store.save();
  return mergedCourse(course, s);
}

export function updateCourse(course, v) {
  const s = settings();
  const oldName = course.name;
  const oldImage = course.image;
  if (oldName !== v.name) {
    delete s.aiKnowledge[oldName];
    // Leads remember their course by name, so a rename carries them along.
    for (const lead of store.load().leads) if (lead.course === oldName) lead.course = v.name;
  }
  Object.assign(course, storable(v), { slug: v.slug || course.slug });
  s.aiKnowledge[v.name] = factsOf(v);
  store.save();
  if (oldImage && oldImage !== v.image) release(oldImage);
  return mergedCourse(course, s);
}

export function deleteCourse(course) {
  const s = settings();
  s.courses = s.courses.filter((c) => c.id !== course.id);
  delete s.aiKnowledge[course.name];
  store.save();
  release(course.image);
}

// ---------- institute ----------
const PHONE = /^\+?[\d\s()-]{6,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;
const INSTITUTE_FIELDS = {
  name: { label: 'Name', max: 100, required: true },
  phone: { label: 'Phone', max: 24, check: (t) => PHONE.test(t), hint: 'Use digits, spaces, + ( ) or -.' },
  whatsapp: { label: 'WhatsApp', max: 24, check: (t) => PHONE.test(t), hint: 'Use digits, spaces, + ( ) or -.' },
  email: { label: 'Email', max: 120, check: (t) => EMAIL.test(t), hint: 'Use a full address like name@example.com.' },
  address: { label: 'Address', max: 300 },
  hours: { label: 'Opening hours', max: 200 },
  website: { label: 'Website', max: 200, check: isHttpUrl, hint: 'Start with https://' },
  instagram: { label: 'Instagram', max: 100, check: (t) => HANDLE.test(t) || isHttpUrl(t), hint: 'Use @handle or a full https:// link.' },
  facebook: { label: 'Facebook', max: 200, check: isHttpUrl, hint: 'Start with https://' },
  youtube: { label: 'YouTube', max: 200, check: isHttpUrl, hint: 'Start with https://' },
};
export const INSTITUTE_KEYS = Object.keys(INSTITUTE_FIELDS);

export function validateInstitute(input) {
  const fields = {};
  const value = {};
  if (!isPlain(input)) return { fields: { _form: 'Invalid institute details.' } };
  for (const [key, rule] of Object.entries(INSTITUTE_FIELDS)) {
    if (!(key in input)) continue;
    const raw = input[key] ?? '';
    if (typeof raw !== 'string') { fields[key] = `${rule.label} must be text.`; continue; }
    const text = raw.trim();
    if (CONTROL.test(text)) fields[key] = `${rule.label} contains characters that aren't allowed.`;
    else if (rule.required && !text) fields[key] = `${rule.label} is required.`;
    else if (text.length > rule.max) fields[key] = `${rule.label} can be at most ${rule.max} characters.`;
    else if (text && rule.check && !rule.check(text)) fields[key] = `${rule.label} isn't valid. ${rule.hint}`;
    else value[key] = text;
  }
  return failed(fields) ? { fields } : { value };
}

// ---------- FAQs ----------
export const listFaqs = () => settings().faqs;
export const findFaq = (id) => settings().faqs.find((f) => f.id === id);

export function validateFaq(input) {
  const fields = {};
  const value = {};
  if (!isPlain(input)) return { fields: { _form: 'Invalid request.' } };
  const q = cleanText(input.question, 'Question', 200, fields, 'question');
  if (q !== null) { if (q.length < 5) fields.question = 'Enter the question (at least 5 characters).'; else value.question = q; }
  const a = cleanText(input.answer, 'Answer', 1500, fields, 'answer');
  if (a !== null) { if (!a) fields.answer = 'Enter the answer.'; else value.answer = a; }
  const published = input.published ?? true;
  if (typeof published !== 'boolean') fields.published = 'Must be true or false.'; else value.published = published;
  return failed(fields) ? { fields } : { value };
}
export function createFaq(v) {
  const f = { id: newId('faq'), question: v.question, answer: v.answer, published: v.published };
  settings().faqs.push(f); store.save(); return f;
}
export function updateFaq(f, v) { Object.assign(f, { question: v.question, answer: v.answer, published: v.published }); store.save(); return f; }
export function deleteFaq(f) { const s = settings(); s.faqs = s.faqs.filter((x) => x.id !== f.id); store.save(); }
export function moveFaq(f, dir) {
  const list = settings().faqs; const i = list.indexOf(f); const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]]; store.save(); return list;
}

// ---------- editable page content ----------
const PAGE_DEFAULTS = {
  announcement: { enabled: false, text: '', href: '' },
  home: { headline: '', subtitle: '', heroImage: '' },
  about: { headline: '', story: '', values: [], image: '' },
  privacy: '',
  terms: '',
};
export const getPages = () => { const p = settings().pages; return { ...PAGE_DEFAULTS, ...p, announcement: { ...PAGE_DEFAULTS.announcement, ...p.announcement }, home: { ...PAGE_DEFAULTS.home, ...p.home }, about: { ...PAGE_DEFAULTS.about, ...p.about } }; };

export function validatePages(input) {
  const fields = {};
  const value = {};
  if (!isPlain(input)) return { fields: { _form: 'Invalid request.' } };
  const imageField = (raw, key) => {
    if (raw === undefined || raw === null || raw === '') return '';
    if (typeof raw !== 'string' || !imageExists(raw)) { fields[key] = 'That image could not be found. Upload it again.'; return null; }
    return raw;
  };
  if ('announcement' in input) {
    const a = input.announcement;
    if (!isPlain(a)) fields.announcement = 'Invalid announcement.';
    else {
      const text = cleanText(a.text, 'Announcement text', 200, fields, 'announcement.text');
      const href = cleanText(a.href, 'Link', 200, fields, 'announcement.href');
      if (href && !(href.startsWith('/') && !href.startsWith('//')) && !isHttpUrl(href)) fields['announcement.href'] = 'Use a page on this site (like /courses) or a full https:// link.';
      if (typeof (a.enabled ?? false) !== 'boolean') fields['announcement.enabled'] = 'Must be true or false.';
      if (a.enabled && !text) fields['announcement.text'] = 'Enter the announcement text, or turn it off.';
      if (text !== null && href !== null) value.announcement = { enabled: a.enabled === true, text, href };
    }
  }
  if ('home' in input) {
    const h = input.home;
    if (!isPlain(h)) fields.home = 'Invalid homepage content.';
    else {
      const headline = cleanText(h.headline, 'Headline', 100, fields, 'home.headline');
      const subtitle = cleanText(h.subtitle, 'Subtitle', 200, fields, 'home.subtitle');
      const heroImage = imageField(h.heroImage, 'home.heroImage');
      if (headline !== null && subtitle !== null && heroImage !== null) value.home = { headline, subtitle, heroImage };
    }
  }
  if ('about' in input) {
    const a = input.about;
    if (!isPlain(a)) fields.about = 'Invalid About content.';
    else {
      const headline = cleanText(a.headline, 'Headline', 120, fields, 'about.headline');
      const story = cleanText(a.story, 'Story', 3000, fields, 'about.story');
      const image = imageField(a.image, 'about.image');
      let values = [];
      if (a.values !== undefined && a.values !== null) {
        if (!Array.isArray(a.values) || a.values.length > 6) fields['about.values'] = 'Add at most 6 values.';
        else {
          for (const [i, v] of a.values.entries()) {
            const t = isPlain(v) ? cleanText(v.title, 'Value title', 60, {}, 'x') : null;
            const x = isPlain(v) ? cleanText(v.text, 'Value text', 300, {}, 'x') : null;
            if (t === null || x === null) { fields['about.values'] = `Value ${i + 1} is too long or contains invalid characters.`; break; }
            if (t || x) values.push({ title: t, text: x });
          }
        }
      }
      if (headline !== null && story !== null && image !== null && !fields['about.values']) value.about = { headline, story, values, image };
    }
  }
  for (const key of ['privacy', 'terms']) {
    if (!(key in input)) continue;
    const t = cleanText(input[key], key === 'privacy' ? 'Privacy policy' : 'Terms', 20000, fields, key);
    if (t !== null) value[key] = t;
  }
  return failed(fields) ? { fields } : { value };
}

export function savePages(value) {
  const s = settings();
  const before = imagesInUse();
  s.pages = { ...s.pages, ...value };
  store.save();
  for (const name of before) release(name);
  return getPages();
}

// ---------- enquiries from the contact form ----------
const MAX_ENQUIRIES = 5000;
export const STATUSES = ['new', 'in-progress', 'resolved'];
export const listEnquiries = () => settings() && store.load().enquiries;
export const findEnquiry = (id) => listEnquiries().find((e) => e.id === id);
export const enquiryCounts = () => { const l = listEnquiries(); return { new: l.filter((e) => e.status === 'new').length, total: l.length }; };

export function validateEnquiry(input) {
  const fields = {};
  const value = {};
  if (!isPlain(input)) return { fields: { _form: 'Invalid request.' } };
  const name = cleanText(input.name, 'Name', 80, fields, 'name');
  if (name !== null) { if (name.length < 2) fields.name = 'Please enter your name.'; else value.name = name; }
  const phone = cleanText(input.phone, 'Phone', 24, fields, 'phone');
  if (phone !== null) { if (phone && !PHONE.test(phone)) fields.phone = 'Enter a valid phone number (digits, spaces, + ( ) or -).'; else value.phone = phone; }
  const email = cleanText(input.email, 'Email', 120, fields, 'email');
  if (email !== null) { if (email && !EMAIL.test(email)) fields.email = 'Enter a valid email address.'; else value.email = email; }
  if (!fields.phone && !fields.email && !value.phone && !value.email) fields.phone = 'Please give a phone number or an email so we can reply.';
  const message = cleanText(input.message, 'Message', 1000, fields, 'message');
  if (message !== null) { if (message.length < 5) fields.message = 'Please write a short message (at least 5 characters).'; else value.message = message; }
  const slug = cleanText(input.course, 'Course', 60, fields, 'course');
  if (slug) {
    const c = settings().courses.find((x) => x.slug === slug && x.published !== false);
    if (!c) fields.course = 'Please choose a course from the list.'; else value.course = c.name;
  } else if (slug !== null) value.course = '';
  return failed(fields) ? { fields } : { value };
}

export function createEnquiry(v) {
  const list = listEnquiries();
  if (list.length >= MAX_ENQUIRIES) return null;
  const e = { id: newId('enq'), name: v.name, phone: v.phone, email: v.email, course: v.course, message: v.message, status: 'new', createdAt: new Date().toISOString(), leadId: null };
  list.unshift(e);
  store.save();
  return e;
}
export function deleteEnquiry(e) { const d = store.load(); d.enquiries = d.enquiries.filter((x) => x.id !== e.id); store.save(); }

// Turns an enquiry into a lead in the admissions desk, with the message as the first thing the student said.
export function convertEnquiry(e, staffName) {
  const d = store.load();
  if (e.leadId && d.leads.some((l) => l.id === e.leadId)) return d.leads.find((l) => l.id === e.leadId);
  const created = new Date().toISOString();
  const lead = {
    id: newId('lead'), name: e.name, phone: e.phone, email: e.email, class: '', course: e.course, source: 'Website',
    status: 'new', temperature: 'warm', category: 'general', intent: '', createdAt: e.createdAt, lastContactedAt: null, nextFollowUpAt: null,
  };
  d.leads.unshift(lead);
  d.messages.push({ id: newId('msg'), leadId: lead.id, sender: 'student', text: e.message, timestamp: e.createdAt, by: `Website form (converted by ${staffName})` });
  e.leadId = lead.id;
  if (e.status === 'new') e.status = 'in-progress';
  store.save();
  return lead;
}

// ---------- the public view ----------
// Public responses are built field by field from this allow-list, never by spreading a stored
// record, so a field added to the database later can't leak by accident.
const str = (v) => (typeof v === 'string' ? v : '');
export function publicCourse(c) {
  return {
    id: c.id, slug: c.slug, name: c.name, class: c.class, description: c.description, eligibility: c.eligibility,
    highlights: c.highlights, curriculum: c.curriculum, featured: c.featured, image: imageUrl(c.image),
    duration: c.duration, batchTimings: c.batchTimings, fee: c.fee, location: c.location, demoAvailability: c.demoAvailability,
  };
}

export function publicSite() {
  const s = settings();
  const i = s.institute;
  const p = getPages();
  return {
    institute: Object.fromEntries(INSTITUTE_KEYS.map((k) => [k, str(i[k])])),
    courses: s.courses.filter((c) => c.published !== false).map((c) => publicCourse(mergedCourse(c, s))),
    faqs: s.faqs.filter((f) => f.published !== false).map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    pages: {
      announcement: p.announcement.enabled && p.announcement.text ? { text: p.announcement.text, href: p.announcement.href } : null,
      home: { headline: p.home.headline, subtitle: p.home.subtitle, heroImage: imageUrl(p.home.heroImage) },
      about: { headline: p.about.headline, story: p.about.story, values: p.about.values, image: imageUrl(p.about.image) },
      hasPrivacy: !!p.privacy.trim(),
      hasTerms: !!p.terms.trim(),
    },
  };
}
export const publicLegal = (name) => (name === 'privacy' || name === 'terms' ? getPages()[name] : '');
