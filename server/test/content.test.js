// Public site data, course management and the /admin page guard.   Run with:  npm test
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replyflow-content-'));
const DB = path.join(tmp, 'db.json');
process.env.REPLYFLOW_DB_PATH = DB;

const { hashPassword } = await import('../auth/passwords.js');
const { createApp } = await import('../app.js');

const FAST = { N: 2 ** 14, r: 8, p: 1 };
const PW = 'correct horse battery staple';

// A stand-in "built client" so the page guard and SPA fallback can be tested.
const dist = path.join(tmp, 'dist');
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title><div id="root"></div>');
fs.writeFileSync(path.join(dist, 'assets', 'main.js'), 'console.log(1)');

let server, base, built;
async function call(method, url, { body, cookie, headers = {}, redirect } = {}) {
  const res = await fetch(base + url, {
    method,
    redirect,
    headers: {
      'X-Requested-With': 'replyflow',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const sc = res.headers.get('set-cookie');
  return { status: res.status, json, text, headers: res.headers, cookie: sc ? sc.split(';')[0] : null };
}
const login = async (u) => (await call('POST', '/api/auth/login', { body: { username: u, password: PW } })).cookie;

before(async () => {
  built = createApp({
    distDir: dist,
    accounts: [
      { id: 'asha', username: 'asha', displayName: 'Asha Verma', role: 'admin', passwordHash: await hashPassword(PW, FAST) },
      { id: 'ravi', username: 'ravi', displayName: 'Ravi Singh', role: 'staff', passwordHash: await hashPassword(PW, FAST) },
    ],
  });
  server = built.app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { built.sessions.stop(); server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const NEW = { name: 'Olympiad', class: '6-9', description: 'Maths olympiad training.', duration: '6 months', batchTimings: 'Sat 10am', fee: 'Rs 20,000', location: 'Main centre', demoAvailability: 'Every Sunday' };
const publicNames = async () => (await call('GET', '/api/public/site')).json.courses.map((c) => c.name);

describe('public site data (no sign-in)', () => {
  test('anyone can read it, and it holds only public fields', async () => {
    const r = await call('GET', '/api/public/site');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ['courses', 'faqs', 'institute', 'pages']);
    assert.deepEqual(Object.keys(r.json.institute).sort(), ['address', 'email', 'facebook', 'hours', 'instagram', 'name', 'phone', 'website', 'whatsapp', 'youtube']);
    assert.deepEqual(await publicNames(), ['JEE', 'NEET', 'Foundation']);
    assert.deepEqual(Object.keys(r.json.courses[0]).sort(),
      ['batchTimings', 'class', 'curriculum', 'demoAvailability', 'description', 'duration', 'eligibility', 'featured', 'fee', 'highlights', 'id', 'image', 'location', 'name', 'slug']);
    for (const secret of ['Aarav', '9876543210', 'aiKnowledge', 'passwordHash', 'followups', 'messages', 'published', 'enquiries']) {
      assert.ok(!r.text.includes(secret), `public response must not contain ${secret}`);
    }
  });

  test('it is read-only: customers cannot write through it', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const r = await call(method, '/api/public/site', { body: { courses: [] } });
      assert.ok(r.status === 401 || r.status === 404, `${method} -> ${r.status}`);
    }
  });

  test('private data stays private', async () => {
    for (const url of ['/api/leads', '/api/settings', '/api/courses', '/api/dashboard', '/api/followups']) {
      assert.equal((await call('GET', url)).status, 401, url);
    }
  });
});

describe('course management authorization', () => {
  test('anonymous requests cannot list, create, edit or delete', async () => {
    assert.equal((await call('GET', '/api/courses')).status, 401);
    assert.equal((await call('POST', '/api/courses', { body: NEW })).status, 401);
    assert.equal((await call('PUT', '/api/courses/c_jee', { body: { name: 'Hacked' } })).status, 401);
    assert.equal((await call('DELETE', '/api/courses/c_jee')).status, 401);
    assert.ok((await publicNames()).includes('JEE'), 'nothing changed');
  });

  test('staff can view the list but not change it; the server decides, not the screen', async () => {
    const staff = await login('ravi');
    assert.equal((await call('GET', '/api/courses', { cookie: staff })).status, 200);
    assert.equal((await call('POST', '/api/courses', { body: NEW, cookie: staff })).status, 403);
    assert.equal((await call('PUT', '/api/courses/c_jee', { body: { name: 'Hacked' }, cookie: staff })).status, 403);
    assert.equal((await call('DELETE', '/api/courses/c_jee', { cookie: staff })).status, 403);
    assert.deepEqual(await publicNames(), ['JEE', 'NEET', 'Foundation']);
  });

  test('cross-site forgery is refused for admins too', async () => {
    const admin = await login('asha');
    const r = await call('POST', '/api/courses', { body: NEW, cookie: admin, headers: { Origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
    const noHeader = await fetch(`${base}/api/courses`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin }, body: JSON.stringify(NEW) });
    assert.equal(noHeader.status, 403);
  });
});

describe('add, edit and delete: the public site follows', () => {
  let admin; let id;
  before(async () => { admin = await login('asha'); });

  test('add -> appears on the public site with its facts', async () => {
    const r = await call('POST', '/api/courses', { body: NEW, cookie: admin });
    assert.equal(r.status, 201);
    id = r.json.id;
    assert.match(id, /^c_/);
    assert.equal(r.json.published, true);
    const pub = (await call('GET', '/api/public/site')).json.courses.find((c) => c.id === id);
    assert.equal(pub.name, 'Olympiad');
    assert.equal(pub.fee, 'Rs 20,000');
    assert.equal(pub.batchTimings, 'Sat 10am');
    // the AI assistant reads the same facts
    const s = (await call('GET', '/api/settings', { cookie: admin })).json;
    assert.equal(s.aiKnowledge.Olympiad.fee, 'Rs 20,000');
  });

  test('a client cannot choose the id or smuggle in other fields', async () => {
    const r = await call('POST', '/api/courses', { body: { ...NEW, name: 'Sneaky', id: 'c_jee', isAdmin: true, __proto__: { x: 1 } }, cookie: admin });
    assert.equal(r.status, 201);
    assert.notEqual(r.json.id, 'c_jee');
    assert.equal(r.json.isAdmin, undefined);
    await call('DELETE', `/api/courses/${r.json.id}`, { cookie: admin });
  });

  test('edit -> the public site shows the new values; omitted fields are kept', async () => {
    const r = await call('PUT', `/api/courses/${id}`, { body: { fee: 'Rs 25,000', description: 'Updated text' }, cookie: admin });
    assert.equal(r.status, 200);
    const pub = (await call('GET', '/api/public/site')).json.courses.find((c) => c.id === id);
    assert.equal(pub.fee, 'Rs 25,000');
    assert.equal(pub.description, 'Updated text');
    assert.equal(pub.batchTimings, 'Sat 10am', 'untouched field survives');
  });

  test('rename keeps leads and AI facts attached', async () => {
    const lead = (await call('POST', '/api/leads', { body: { name: 'Olympiad Lead', course: 'Olympiad' }, cookie: admin })).json;
    const r = await call('PUT', `/api/courses/${id}`, { body: { name: 'Maths Olympiad' }, cookie: admin });
    assert.equal(r.status, 200);
    const s = (await call('GET', '/api/settings', { cookie: admin })).json;
    assert.equal(s.aiKnowledge['Maths Olympiad'].fee, 'Rs 25,000');
    assert.equal(s.aiKnowledge.Olympiad, undefined, 'old key removed');
    const leads = (await call('GET', '/api/leads', { cookie: admin })).json;
    assert.equal(leads.find((l) => l.id === lead.id).course, 'Maths Olympiad');
  });

  test('hiding a course removes it from the public site but not from the admin list', async () => {
    await call('PUT', `/api/courses/${id}`, { body: { published: false }, cookie: admin });
    assert.ok(!(await publicNames()).includes('Maths Olympiad'));
    assert.ok((await call('GET', '/api/courses', { cookie: admin })).json.some((c) => c.id === id && c.published === false));
    await call('PUT', `/api/courses/${id}`, { body: { published: true }, cookie: admin });
    assert.ok((await publicNames()).includes('Maths Olympiad'));
  });

  test('delete -> gone from the public site and the admin list', async () => {
    assert.equal((await call('DELETE', `/api/courses/${id}`, { cookie: admin })).status, 200);
    assert.ok(!(await publicNames()).includes('Maths Olympiad'));
    assert.ok(!(await call('GET', '/api/courses', { cookie: admin })).json.some((c) => c.id === id));
    const s = (await call('GET', '/api/settings', { cookie: admin })).json;
    assert.equal(s.aiKnowledge['Maths Olympiad'], undefined);
    assert.equal((await call('DELETE', `/api/courses/${id}`, { cookie: admin })).status, 404);
    assert.equal((await call('PUT', `/api/courses/${id}`, { body: { fee: 'x' }, cookie: admin })).status, 404);
  });
});

describe('course validation', () => {
  let admin;
  before(async () => { admin = await login('asha'); });
  const post = (body) => call('POST', '/api/courses', { body, cookie: admin });

  test('names are required, bounded and unique', async () => {
    for (const bad of [{}, { name: '' }, { name: ' ' }, { name: 'A' }, { name: 'x'.repeat(81) }, { name: 5 }, { name: ['JEE'] }]) {
      const r = await post(bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.ok(r.json.fields.name);
    }
    const dup = await post({ name: 'jee' });
    assert.equal(dup.status, 409);
    assert.match(dup.json.fields.name, /already exists/);
  });
  test('other fields are length- and type-checked', async () => {
    const r = await post({ name: 'Valid Name', fee: 'x'.repeat(121), description: 'y'.repeat(601), location: 42, class: 'bad\u0000char' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.json.fields).sort(), ['class', 'description', 'fee', 'location']);
    assert.equal((await post({ name: 'Valid Name', published: 'yes' })).status, 400);
    assert.equal((await call('POST', '/api/courses', { body: [], cookie: admin })).status, 400);
    assert.ok(!(await publicNames()).includes('Valid Name'), 'nothing was saved');
  });
  test('errors do not reveal internals', async () => {
    const r = await post({ name: 'x'.repeat(81) });
    assert.ok(!/stack|node_modules|\.js:|Error:|\/home\//.test(r.text), r.text);
  });
  test('text with markup is stored as plain text, never interpreted by the API', async () => {
    const r = await post({ name: 'A <b>bold</b> idea', description: '<script>alert(1)</script>' });
    assert.equal(r.status, 201);
    const pub = (await call('GET', '/api/public/site')).json.courses.find((c) => c.id === r.json.id);
    assert.equal(pub.description, '<script>alert(1)</script>');
    await call('DELETE', `/api/courses/${r.json.id}`, { cookie: admin });
  });
});

describe('institute details', () => {
  let admin;
  before(async () => { admin = await login('asha'); });
  const put = (institute, cookie = admin) => call('PUT', '/api/settings', { body: { institute }, cookie });

  test('admins can update them and the public site shows the change', async () => {
    assert.equal((await put({ phone: '+91 99999 12345', address: 'New Road, Ludhiana' })).status, 200);
    const pub = (await call('GET', '/api/public/site')).json.institute;
    assert.equal(pub.phone, '+91 99999 12345');
    assert.equal(pub.address, 'New Road, Ludhiana');
    assert.equal(pub.name, 'Apex Learning Institute', 'untouched field survives');
  });
  test('dangerous links and junk are rejected', async () => {
    for (const bad of [{ website: 'javascript:alert(1)' }, { website: 'ftp://x.y' }, { name: '' }, { phone: 'call me' }, { instagram: 'not a handle!' }, { name: 'x'.repeat(101) }, { address: 7 }]) {
      const r = await put(bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.ok(r.json.fields);
    }
    assert.equal((await call('GET', '/api/public/site')).json.institute.website, 'https://example.com');
  });
  test('courses cannot be written through the settings route', async () => {
    assert.equal((await call('PUT', '/api/settings', { body: { courses: [{ id: 'x', name: 'Evil' }] }, cookie: admin })).status, 400);
    assert.equal((await call('PUT', '/api/settings', { body: { aiKnowledge: {} }, cookie: admin })).status, 400);
  });
  test('staff cannot edit them', async () => {
    assert.equal((await put({ phone: '+91 1111 111111' }, await login('ravi'))).status, 403);
  });
});

describe('persistence', () => {
  test('changes are written to disk and survive a restart', async () => {
    const admin = await login('asha');
    const r = await call('POST', '/api/courses', { body: { name: 'Persisted Course', fee: 'Rs 1' }, cookie: admin });
    const store = pathToFileURL(fileURLToPath(new URL('../data/store.js', import.meta.url))).href;
    // A brand-new Node process, as after a restart, reading only what is on disk:
    const read = () => JSON.parse(spawnSync(process.execPath, ['--input-type=module', '-e',
      `import * as s from '${store}'; const x = s.load().settings; console.log(JSON.stringify({ c: x.courses.map(c => c.name), k: x.aiKnowledge }))`],
      { env: { ...process.env, REPLYFLOW_DB_PATH: DB }, encoding: 'utf8' }).stdout);
    const after = read();
    assert.ok(after.c.includes('Persisted Course'));
    assert.equal(after.k['Persisted Course'].fee, 'Rs 1');
    await call('DELETE', `/api/courses/${r.json.id}`, { cookie: admin });
    assert.ok(!read().c.includes('Persisted Course'), 'deletion persisted too');
  });
});

describe('pages: public site, staff sign-in and the /admin guard', () => {
  const nofollow = { redirect: 'manual' };

  test('the customer site and sign-in page open with no session', async () => {
    for (const url of ['/', '/courses/c_jee', '/courses', '/staff/login']) {
      const r = await call('GET', url, nofollow);
      assert.equal(r.status, 200, url);
      assert.match(r.text, /id="root"/);
    }
    assert.equal((await call('GET', '/assets/main.js')).status, 200);
  });

  test('/admin pages redirect anonymous visitors to the staff sign-in page', async () => {
    for (const url of ['/admin', '/admin/', '/admin/leads/lead_1?x=1', '/admin/courses']) {
      const r = await call('GET', url, nofollow);
      assert.equal(r.status, 302, url);
      assert.equal(r.headers.get('location'), `/staff/login?next=${encodeURIComponent(url)}`);
      assert.ok(!r.text.includes('id="root"'), 'the app page is not served');
    }
  });

  test('a forged cookie does not open /admin', async () => {
    assert.equal((await call('GET', '/admin', { ...nofollow, cookie: 'rf_session=' + 'A'.repeat(43) })).status, 302);
  });

  test('a signed-in session opens /admin; after sign-out it redirects again', async () => {
    const cookie = await login('ravi');
    assert.equal((await call('GET', '/admin/leads', { ...nofollow, cookie })).status, 200);
    assert.equal((await call('POST', '/api/auth/logout', { cookie })).status, 200);
    assert.equal((await call('GET', '/admin/leads', { ...nofollow, cookie })).status, 302);
    assert.equal((await call('GET', '/api/leads', { cookie })).status, 401);
  });

  test('unknown API paths stay JSON, never the app page', async () => {
    const r = await call('GET', '/api/nope');
    assert.equal(r.status, 401);
    assert.ok(r.json);
  });
});
