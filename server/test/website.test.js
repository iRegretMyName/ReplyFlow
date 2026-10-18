// Slugs, rich course fields, image uploads, FAQs, page content and the enquiry workflow.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replyflow-website-'));
process.env.REPLYFLOW_DB_PATH = path.join(tmp, 'db.json');
process.env.REPLYFLOW_UPLOAD_DIR = path.join(tmp, 'uploads');

const { hashPassword } = await import('../auth/passwords.js');
const { createApp } = await import('../app.js');
const { pruneUploads } = await import('../data/uploads.js');
const { imagesInUse } = await import('../data/content.js');

const FAST = { N: 2 ** 14, r: 8, p: 1 };
const PW = 'correct horse battery staple';
const dist = path.join(tmp, 'dist');
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');

// Smallest byte strings that look like each format (enough for the signature check).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]);

async function boot(env = {}) {
  const built = createApp({
    distDir: dist, env: { ENQUIRY_LIMIT_PER_HOUR: '1000', ...env },
    accounts: [
      { id: 'asha', username: 'asha', displayName: 'Asha Verma', role: 'admin', passwordHash: await hashPassword(PW, FAST) },
      { id: 'ravi', username: 'ravi', displayName: 'Ravi Singh', role: 'staff', passwordHash: await hashPassword(PW, FAST) },
    ],
  });
  const server = built.app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { body, raw, cookie, headers = {}, csrf = true, redirect } = {}) => {
    const res = await fetch(base + url, {
      method, redirect,
      headers: { ...(csrf ? { 'X-Requested-With': 'replyflow' } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ }
    const sc = res.headers.get('set-cookie');
    return { status: res.status, json, text, headers: res.headers, cookie: sc ? sc.split(';')[0] : null };
  };
  const login = async (u) => (await call('POST', '/api/auth/login', { body: { username: u, password: PW } })).cookie;
  return { call, login, base, close: () => { built.sessions.stop(); server.close(); } };
}

let s; let admin; let staff;
before(async () => { s = await boot(); admin = await s.login('asha'); staff = await s.login('ravi'); });
after(() => { s.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

// cookie: omit for the administrator, pass null for an anonymous visitor.
const upload = (buf, cookie = admin, type = 'application/octet-stream') => s.call('POST', '/api/uploads', { raw: buf, cookie: cookie || undefined, headers: { 'Content-Type': type } });
const site = async () => (await s.call('GET', '/api/public/site')).json;
const uploadsOnDisk = () => fs.existsSync(path.join(tmp, 'uploads')) ? fs.readdirSync(path.join(tmp, 'uploads')) : [];

describe('course page addresses (slugs)', () => {
  test('existing courses were given slugs from their names', async () => {
    assert.deepEqual((await site()).courses.map((c) => c.slug), ['jee', 'neet', 'foundation']);
  });
  test('new courses get unique slugs; a rename keeps the address stable', async () => {
    const a = await s.call('POST', '/api/courses', { body: { name: 'Maths Olympiad!' }, cookie: admin });
    const b = await s.call('POST', '/api/courses', { body: { name: 'Maths-Olympiad' }, cookie: admin });
    assert.equal(a.json.slug, 'maths-olympiad');
    assert.equal(b.json.slug, 'maths-olympiad-2');
    await s.call('PUT', `/api/courses/${a.json.id}`, { body: { name: 'Olympiad Maths' }, cookie: admin });
    assert.equal((await site()).courses.find((c) => c.id === a.json.id).slug, 'maths-olympiad');
    for (const c of [a, b]) await s.call('DELETE', `/api/courses/${c.json.id}`, { cookie: admin });
  });
  test('custom slugs are validated and must be unique', async () => {
    for (const bad of ['Has Space', 'UPPER', '-lead', 'a--b', 'x'.repeat(61), 'jee']) {
      const r = await s.call('POST', '/api/courses', { body: { name: 'Slug Test', slug: bad }, cookie: admin });
      assert.equal(r.status, 400, bad); assert.ok(r.json.fields.slug);
    }
    const ok = await s.call('POST', '/api/courses', { body: { name: 'Slug Test', slug: 'my-custom-address' }, cookie: admin });
    assert.equal(ok.json.slug, 'my-custom-address');
    await s.call('DELETE', `/api/courses/${ok.json.id}`, { cookie: admin });
  });
});

describe('richer course content', () => {
  let id;
  test('highlights, curriculum, eligibility and featured are saved and published', async () => {
    const r = await s.call('POST', '/api/courses', { body: { name: 'Rich Course', eligibility: 'Class 10 pass', highlights: ['Small batches', '  ', 'Weekly tests'], curriculum: 'Algebra\nGeometry', featured: true }, cookie: admin });
    assert.equal(r.status, 201); id = r.json.id;
    const c = (await site()).courses.find((x) => x.id === id);
    assert.deepEqual(c.highlights, ['Small batches', 'Weekly tests']);
    assert.deepEqual(c.curriculum, ['Algebra', 'Geometry']);
    assert.equal(c.eligibility, 'Class 10 pass'); assert.equal(c.featured, true);
  });
  test('limits are enforced', async () => {
    const r = await s.call('POST', '/api/courses', { body: { name: 'Too Many', highlights: Array(9).fill('x'), curriculum: ['y'.repeat(121)], eligibility: 'e'.repeat(201), featured: 'yes' }, cookie: admin });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.json.fields).sort(), ['curriculum', 'eligibility', 'featured', 'highlights']);
    assert.equal((await s.call('POST', '/api/courses', { body: { name: 'Bad', highlights: [1, 2] }, cookie: admin })).status, 400);
  });
  after(async () => { await s.call('DELETE', `/api/courses/${id}`, { cookie: admin }); });
});

describe('image uploads', () => {
  test('only administrators can upload', async () => {
    assert.equal((await upload(PNG, null)).status, 401);
    assert.equal((await upload(PNG, staff)).status, 403);
    assert.equal(uploadsOnDisk().length, 0);
  });
  test('files are judged by their bytes, not their claimed type or name', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(30)]);
    for (const [name, buf, type] of [['svg', svg, 'image/svg+xml'], ['html as png', html, 'image/png'], ['gif', gif, 'image/gif'], ['empty', Buffer.alloc(0), 'image/png'], ['tiny', Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg']]) {
      const r = await upload(buf, admin, type);
      assert.equal(r.status, 400, name);
    }
    assert.equal(uploadsOnDisk().length, 0, 'nothing was stored');
  });
  test('oversized files are refused', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    assert.equal((await upload(big)).status, 413);
    assert.equal(uploadsOnDisk().length, 0);
  });
  test('JPEG, PNG and WebP are accepted, stored under random names and served safely', async () => {
    for (const [buf, ext, type] of [[PNG, 'png', 'image/png'], [JPG, 'jpg', 'image/jpeg'], [WEBP, 'webp', 'image/webp']]) {
      const r = await upload(buf, admin, 'text/plain'); // the claimed type is ignored
      assert.equal(r.status, 201);
      assert.match(r.json.name, new RegExp(`^[a-f0-9]{32}\\.${ext}$`));
      const got = await s.call('GET', r.json.url);
      assert.equal(got.status, 200);
      assert.equal(got.headers.get('content-type'), type);
      assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
      fs.rmSync(path.join(tmp, 'uploads', r.json.name));
    }
  });
  test('uploads cannot be traversed or listed', async () => {
    assert.notEqual((await s.call('GET', '/uploads/../db.json')).status, 200);
    assert.notEqual((await s.call('GET', '/uploads/')).status, 200);
  });

  test('a course image shows publicly, and is removed when replaced or when the course is deleted', async () => {
    const a = (await upload(PNG)).json.name;
    const c = await s.call('POST', '/api/courses', { body: { name: 'Pictured', image: a }, cookie: admin });
    assert.equal(c.status, 201);
    assert.equal((await site()).courses.find((x) => x.id === c.json.id).image, `/uploads/${a}`);
    const b = (await upload(JPG)).json.name;
    await s.call('PUT', `/api/courses/${c.json.id}`, { body: { image: b }, cookie: admin });
    assert.ok(!uploadsOnDisk().includes(a), 'replaced image deleted');
    assert.ok(uploadsOnDisk().includes(b));
    await s.call('DELETE', `/api/courses/${c.json.id}`, { cookie: admin });
    assert.ok(!uploadsOnDisk().includes(b), 'image deleted with its course');
  });
  test('a course cannot point at a file that was never uploaded', async () => {
    for (const image of ['../db.json', 'a'.repeat(32) + '.png', 'x.png', '/etc/passwd', 5]) {
      const r = await s.call('POST', '/api/courses', { body: { name: 'Bad Image', image }, cookie: admin });
      assert.equal(r.status, 400, String(image)); assert.ok(r.json.fields.image);
    }
  });
  test('abandoned uploads are cleaned up, but not ones in use or recent', async () => {
    const used = (await upload(PNG)).json.name;
    const abandoned = (await upload(PNG)).json.name;
    const fresh = (await upload(PNG)).json.name;
    const c = await s.call('POST', '/api/courses', { body: { name: 'Keeper', image: used }, cookie: admin });
    const old = new Date(Date.now() - 2 * 3_600_000);
    for (const n of [used, abandoned]) fs.utimesSync(path.join(tmp, 'uploads', n), old, old);
    pruneUploads(imagesInUse());
    assert.ok(uploadsOnDisk().includes(used)); assert.ok(!uploadsOnDisk().includes(abandoned)); assert.ok(uploadsOnDisk().includes(fresh));
    await s.call('DELETE', `/api/courses/${c.json.id}`, { cookie: admin });
    fs.rmSync(path.join(tmp, 'uploads', fresh), { force: true });
  });
});

describe('FAQs', () => {
  let ids = [];
  test('anonymous and staff cannot manage them', async () => {
    assert.equal((await s.call('GET', '/api/faqs')).status, 401);
    assert.equal((await s.call('POST', '/api/faqs', { body: { question: 'Hello there?', answer: 'x' } })).status, 401);
    assert.equal((await s.call('POST', '/api/faqs', { body: { question: 'Hello there?', answer: 'x' }, cookie: staff })).status, 403);
  });
  test('validation', async () => {
    for (const bad of [{}, { question: 'Hi', answer: 'x' }, { question: 'A real question?', answer: '' }, { question: 'q'.repeat(201), answer: 'x' }, { question: 'A real question?', answer: 'a'.repeat(1501) }, { question: 5, answer: 'x' }]) {
      assert.equal((await s.call('POST', '/api/faqs', { body: bad, cookie: admin })).status, 400, JSON.stringify(bad).slice(0, 40));
    }
  });
  test('create, publish, unpublish, reorder and delete are reflected on the public site', async () => {
    for (const q of ['First question?', 'Second question?', 'Third question?']) ids.push((await s.call('POST', '/api/faqs', { body: { question: q, answer: `Answer to ${q}` }, cookie: admin })).json.id);
    assert.deepEqual((await site()).faqs.map((f) => f.question), ['First question?', 'Second question?', 'Third question?']);
    await s.call('PUT', `/api/faqs/${ids[1]}`, { body: { published: false }, cookie: admin });
    assert.deepEqual((await site()).faqs.map((f) => f.question), ['First question?', 'Third question?']);
    assert.equal((await s.call('GET', '/api/faqs', { cookie: admin })).json.length, 3, 'admin still sees hidden ones');
    await s.call('POST', `/api/faqs/${ids[2]}/move`, { body: { direction: 'up' }, cookie: admin });
    await s.call('POST', `/api/faqs/${ids[2]}/move`, { body: { direction: 'up' }, cookie: admin });
    assert.deepEqual((await site()).faqs.map((f) => f.question), ['Third question?', 'First question?']);
    assert.equal((await s.call('POST', `/api/faqs/${ids[0]}/move`, { body: { direction: 'sideways' }, cookie: admin })).status, 400);
    for (const id of ids) assert.equal((await s.call('DELETE', `/api/faqs/${id}`, { cookie: admin })).status, 200);
    assert.deepEqual((await site()).faqs, []);
    assert.equal((await s.call('DELETE', `/api/faqs/${ids[0]}`, { cookie: admin })).status, 404);
  });
});

describe('editable page content', () => {
  const put = (body, cookie = admin) => s.call('PUT', '/api/pages', { body, cookie: cookie || undefined });
  test('only administrators can change it', async () => {
    assert.equal((await put({ privacy: 'x' }, null)).status, 401);
    assert.equal((await put({ privacy: 'x' }, staff)).status, 403);
  });
  test('announcement appears only while enabled, and links are checked', async () => {
    assert.equal((await site()).pages.announcement, null);
    assert.equal((await put({ announcement: { enabled: true, text: '' } })).status, 400);
    for (const href of ['javascript:alert(1)', '//evil.example', 'ftp://x.y']) assert.equal((await put({ announcement: { enabled: true, text: 'Hi', href } })).status, 400, href);
    assert.equal((await put({ announcement: { enabled: true, text: 'Admissions open', href: '/contact' } })).status, 200);
    assert.deepEqual((await site()).pages.announcement, { text: 'Admissions open', href: '/contact' });
    await put({ announcement: { enabled: false, text: 'Admissions open', href: '/contact' } });
    assert.equal((await site()).pages.announcement, null);
  });
  test('home and about content', async () => {
    const r = await put({ home: { headline: 'Learn well', subtitle: 'Small batches' }, about: { headline: 'Our story', story: 'Para one.\n\nPara two.', values: [{ title: 'Care', text: 'We listen.' }, { title: '', text: '' }] } });
    assert.equal(r.status, 200);
    const p = (await site()).pages;
    assert.equal(p.home.headline, 'Learn well');
    assert.equal(p.about.story, 'Para one.\n\nPara two.');
    assert.deepEqual(p.about.values, [{ title: 'Care', text: 'We listen.' }], 'empty rows are dropped');
    assert.equal((await put({ about: { values: Array(7).fill({ title: 'a', text: 'b' }) } })).status, 400);
    assert.equal((await put({ home: { headline: 'h'.repeat(101) } })).status, 400);
    assert.equal((await put({ home: { heroImage: '../secret.png' } })).status, 400);
  });
  test('privacy and terms are public only once written', async () => {
    assert.equal((await s.call('GET', '/api/public/legal/privacy')).status, 404);
    assert.equal((await site()).pages.hasPrivacy, false);
    await put({ privacy: 'We keep your details to answer you.' });
    assert.equal((await s.call('GET', '/api/public/legal/privacy')).json.text, 'We keep your details to answer you.');
    assert.equal((await site()).pages.hasPrivacy, true);
    assert.equal((await s.call('GET', '/api/public/legal/anything')).status, 404);
    assert.equal((await put({ terms: 'x'.repeat(20001) })).status, 400);
  });
  test('extra institute fields appear publicly and are validated', async () => {
    assert.equal((await s.call('PUT', '/api/settings', { body: { institute: { email: 'hello@example.com', hours: 'Mon-Sat 9am-6pm', facebook: 'https://facebook.com/x', youtube: 'https://youtube.com/x' } }, cookie: admin })).status, 200);
    const i = (await site()).institute;
    assert.equal(i.email, 'hello@example.com'); assert.equal(i.hours, 'Mon-Sat 9am-6pm');
    for (const bad of [{ email: 'nope' }, { facebook: 'javascript:1' }, { youtube: 'x' }, { hours: 'h'.repeat(201) }]) assert.equal((await s.call('PUT', '/api/settings', { body: { institute: bad }, cookie: admin })).status, 400, JSON.stringify(bad));
  });
});

describe('enquiries: the contact form', () => {
  const send = (body, extra = {}) => s.call('POST', '/api/public/enquiries', { body, ...extra });
  const good = { name: 'Kavya Rao', phone: '+91 98765 43210', email: 'kavya@example.com', message: 'What are the batch timings for JEE?', course: 'jee' };

  test('a valid enquiry is saved, and the response gives nothing back', async () => {
    const r = await send(good);
    assert.equal(r.status, 201);
    assert.deepEqual(r.json, { ok: true });
    const list = (await s.call('GET', '/api/enquiries', { cookie: admin })).json;
    const e = list.find((x) => x.name === 'Kavya Rao');
    assert.equal(e.status, 'new'); assert.equal(e.course, 'JEE'); assert.equal(e.message, good.message);
  });
  test('either a phone or an email is enough; neither is not', async () => {
    assert.equal((await send({ name: 'Only Phone', phone: '98765 43210', message: 'Please call me.' })).status, 201);
    assert.equal((await send({ name: 'Only Email', email: 'a@b.co', message: 'Please write to me.' })).status, 201);
    const r = await send({ name: 'No Contact', message: 'How do I reach you?' });
    assert.equal(r.status, 400); assert.ok(r.json.fields.phone);
  });
  test('every field is validated on the server', async () => {
    const r = await send({ name: 'A', phone: 'call me maybe', email: 'not-an-email', message: 'hi', course: 'no-such-course' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.json.fields).sort(), ['course', 'email', 'message', 'name', 'phone']);
    for (const bad of [{}, [], 'x', { ...good, name: 5 }, { ...good, message: 'm'.repeat(1001) }, { ...good, name: 'a'.repeat(81) }, { ...good, name: 'bad\u0000name' }]) assert.equal((await send(bad)).status, 400, JSON.stringify(bad).slice(0, 50));
  });
  test('only a published course can be chosen', async () => {
    const c = (await s.call('POST', '/api/courses', { body: { name: 'Hidden One', published: false }, cookie: admin })).json;
    assert.equal((await send({ ...good, course: c.slug })).status, 400);
    await s.call('DELETE', `/api/courses/${c.id}`, { cookie: admin });
  });
  test('markup in a message is stored as plain text', async () => {
    await send({ ...good, name: 'Markup Mark', message: '<script>alert(1)</script> hello' });
    const e = (await s.call('GET', '/api/enquiries', { cookie: admin })).json.find((x) => x.name === 'Markup Mark');
    assert.equal(e.message, '<script>alert(1)</script> hello');
  });
  test('a bot that fills the hidden field is told "ok" but nothing is stored', async () => {
    const before = (await s.call('GET', '/api/enquiries', { cookie: admin })).json.length;
    assert.equal((await send({ ...good, name: 'Spam Bot', company: 'Cheap Pills Ltd' })).status, 201);
    const after = (await s.call('GET', '/api/enquiries', { cookie: admin })).json;
    assert.equal(after.length, before); assert.ok(!after.some((e) => e.name === 'Spam Bot'));
  });
  test('cross-site forgery is refused', async () => {
    assert.equal((await send(good, { csrf: false })).status, 403);
    assert.equal((await send(good, { headers: { Origin: 'https://evil.example' } })).status, 403);
  });
  test('the public cannot read enquiries', async () => {
    for (const u of ['/api/enquiries', '/api/enquiries/counts']) assert.equal((await s.call('GET', u)).status, 401);
    const pub = await s.call('GET', '/api/public/site');
    assert.ok(!pub.text.includes('Kavya') && !pub.text.includes('98765 43210'));
  });
  test('staff can list, count, update status and convert to a lead; only admins delete', async () => {
    const list = (await s.call('GET', '/api/enquiries', { cookie: staff })).json;
    const e = list.find((x) => x.name === 'Kavya Rao');
    assert.ok((await s.call('GET', '/api/enquiries/counts', { cookie: staff })).json.new >= 1);
    assert.equal((await s.call('PUT', `/api/enquiries/${e.id}`, { body: { status: 'bogus' }, cookie: staff })).status, 400);
    assert.equal((await s.call('PUT', `/api/enquiries/${e.id}`, { body: { status: 'resolved' }, cookie: staff })).json.status, 'resolved');
    assert.equal((await s.call('PUT', `/api/enquiries/${e.id}`, { body: { status: 'new' }, cookie: staff })).json.status, 'new');

    const conv = await s.call('POST', `/api/enquiries/${e.id}/convert`, { cookie: staff });
    assert.equal(conv.status, 200);
    assert.equal(conv.json.lead.source, 'Website'); assert.equal(conv.json.lead.name, 'Kavya Rao'); assert.equal(conv.json.lead.course, 'JEE');
    assert.equal(conv.json.enquiry.status, 'in-progress');
    const msgs = (await s.call('GET', `/api/messages/${conv.json.lead.id}`, { cookie: staff })).json;
    assert.equal(msgs[0].text, good.message); assert.equal(msgs[0].sender, 'student');
    const again = await s.call('POST', `/api/enquiries/${e.id}/convert`, { cookie: staff });
    assert.equal(again.json.lead.id, conv.json.lead.id, 'converting twice makes one lead');
    assert.equal((await s.call('GET', '/api/leads', { cookie: staff })).json.filter((l) => l.name === 'Kavya Rao').length, 1);

    assert.equal((await s.call('DELETE', `/api/enquiries/${e.id}`, { cookie: staff })).status, 403);
    assert.equal((await s.call('DELETE', `/api/enquiries/${e.id}`, { cookie: admin })).status, 200);
    assert.equal((await s.call('DELETE', `/api/enquiries/${e.id}`, { cookie: admin })).status, 404);
    assert.equal((await s.call('POST', `/api/enquiries/${e.id}/convert`, { cookie: admin })).status, 404);
  });
  test('the dashboard counts new enquiries', async () => {
    const d = (await s.call('GET', '/api/dashboard', { cookie: staff })).json;
    assert.equal(typeof d.newEnquiries, 'number'); assert.ok(d.newEnquiries >= 1);
  });
  test('each address can send only a few enquiries an hour', async () => {
    const lim = await boot({ ENQUIRY_LIMIT_PER_HOUR: '3' });
    try {
      for (let i = 0; i < 3; i++) assert.equal((await lim.call('POST', '/api/public/enquiries', { body: { ...good, name: `Person ${i}` } })).status, 201);
      const r = await lim.call('POST', '/api/public/enquiries', { body: good });
      assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0);
    } finally { lim.close(); }
  });
});

describe('unknown pages get a real 404', () => {
  test('the app is served, with the right status', async () => {
    const ok = ['/', '/courses', '/courses/jee', '/about', '/contact', '/faq', '/privacy', '/terms', '/staff/login'];
    for (const u of ok) assert.equal((await s.call('GET', u, { redirect: 'manual' })).status, 200, u);
    for (const u of ['/nope', '/courses/a/b', '/about/team', '/administrator']) {
      const r = await s.call('GET', u, { redirect: 'manual' });
      assert.equal(r.status, 404, u); assert.match(r.text, /id="root"/);
    }
    assert.equal((await s.call('GET', '/admin/anything', { redirect: 'manual' })).status, 302, 'admin still guarded');
  });
});
