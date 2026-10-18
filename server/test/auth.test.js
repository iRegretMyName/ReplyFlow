// Run with:  npm test      (uses Node's built-in test runner, nothing extra to install)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The tests use a throwaway database, never the real one. This must be set before the app is imported.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replyflow-test-'));
process.env.REPLYFLOW_DB_PATH = path.join(tmp, 'db.json');

const { hashPassword, verifyPassword, parseHash } = await import('../auth/passwords.js');
const { buildAccountDirectory } = await import('../auth/accounts.js');
const { createApp } = await import('../app.js');

// Cheaper than production settings (still above the minimum) so the suite runs fast.
const FAST = { N: 2 ** 14, r: 8, p: 1 };
const PW = 'correct horse battery staple';

const accountsList = async () => [
  { id: 'asha', username: 'Asha', displayName: 'Asha Verma', role: 'admin', passwordHash: await hashPassword(PW, FAST) },
  { id: 'ravi', username: 'ravi@example.com', displayName: 'Ravi Singh', role: 'staff', passwordHash: await hashPassword(PW, FAST) },
  { id: 'gone', username: 'gone', displayName: 'Former Staff', enabled: false, passwordHash: await hashPassword(PW, FAST) },
];

async function start({ env = {}, now } = {}) {
  const built = createApp({ accounts: await accountsList(), env, now, allowWeakHashes: false });
  const server = built.app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, url, { body, cookie, headers = {}, csrf = true } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-Requested-With': 'replyflow' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    const setCookie = res.headers.get('set-cookie');
    return { status: res.status, json, text, headers: res.headers, setCookie, cookie: setCookie ? setCookie.split(';')[0] : null };
  }
  const login = (username, password = PW, extra = {}) => call('POST', '/api/auth/login', { body: { username, password }, ...extra });
  const close = () => { built.sessions.stop(); server.close(); };
  return { call, login, close, built, base };
}

describe('password hashing', () => {
  test('round trip works and a wrong password fails', async () => {
    const h = await hashPassword(PW, FAST);
    assert.match(h, /^scrypt\$16384\$8\$1\$/);
    assert.equal(await verifyPassword(PW, h), true);
    assert.equal(await verifyPassword(PW + 'x', h), false);
  });
  test('same password gives different hashes (random salt)', async () => {
    assert.notEqual(await hashPassword(PW, FAST), await hashPassword(PW, FAST));
  });
  test('malformed or tampered hashes never verify', async () => {
    for (const bad of ['', 'plaintext', 'scrypt$1$1$1$a$b', 'scrypt$3$8$1$AAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAA', null, undefined, 42]) {
      assert.equal(await verifyPassword(PW, bad), false);
    }
    assert.equal(parseHash('scrypt$16384$8$1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAA')?.N, 16384);
  });
  test('password is not recoverable from the stored string', async () => {
    const h = await hashPassword(PW, FAST);
    assert.ok(!h.includes(PW));
    assert.ok(!h.includes(Buffer.from(PW).toString('base64')));
  });
});

describe('account list validation', () => {
  const ok = async () => ({ id: 'a1', username: 'a1', displayName: 'A One', passwordHash: await hashPassword(PW, FAST) });
  test('accepts a valid list and defaults role/enabled', async () => {
    const d = buildAccountDirectory([await ok()], { allowWeakHashes: false });
    assert.equal(d.byUsername.get('a1').role, 'staff');
    assert.equal(d.enabled, 1);
  });
  test('rejects plaintext passwords, weak hashes, duplicates, bad roles', async () => {
    const base = await ok();
    assert.throws(() => buildAccountDirectory([{ ...base, passwordHash: 'hunter2hunter2' }]), /passwordHash/);
    const weak = await hashPassword(PW, { N: 2 ** 10, r: 8, p: 1 });
    assert.throws(() => buildAccountDirectory([{ ...base, passwordHash: weak }]), /too weak/);
    assert.throws(() => buildAccountDirectory([base, { ...base, id: 'a2' }]), /username is used/);
    assert.throws(() => buildAccountDirectory([base, { ...base, username: 'other' }]), /id is used/);
    assert.throws(() => buildAccountDirectory([{ ...base, role: 'superuser' }]), /role/);
    assert.throws(() => buildAccountDirectory({}), /array/);
  });
  test('an empty list is allowed (nobody can sign in)', () => {
    assert.equal(buildAccountDirectory([]).total, 0);
  });
});

describe('protected API', () => {
  let s;
  before(async () => { s = await start(); });
  after(() => s.close());

  test('every data route rejects anonymous requests', async () => {
    const routes = [
      ['GET', '/api/leads'], ['GET', '/api/leads/lead_x'], ['POST', '/api/leads'], ['PUT', '/api/leads/x'],
      ['GET', '/api/messages/x'], ['POST', '/api/messages'], ['POST', '/api/reply'],
      ['GET', '/api/followups'], ['POST', '/api/followups'], ['PUT', '/api/followups/x'],
      ['GET', '/api/dashboard'], ['GET', '/api/settings'], ['PUT', '/api/settings'],
      ['GET', '/api/does-not-exist'],
    ];
    for (const [method, url] of routes) {
      const r = await s.call(method, url, { body: method === 'GET' ? undefined : {} });
      assert.equal(r.status, 401, `${method} ${url} should be 401, got ${r.status}`);
      assert.ok(!r.text.includes('Apex'), 'no data in the response');
    }
  });

  test('there is no registration route', async () => {
    for (const url of ['/api/auth/register', '/api/auth/signup', '/api/register', '/api/users', '/api/auth/users']) {
      const r = await s.call('POST', url, { body: { username: 'new', password: PW + 'x' } });
      assert.ok([401, 404].includes(r.status), `${url} -> ${r.status}`);
      assert.equal(r.setCookie, null);
    }
  });

  test('/auth/me is 401 without a session', async () => {
    assert.equal((await s.call('GET', '/api/auth/me')).status, 401);
  });

  test('API responses are never cached', async () => {
    const r = await s.call('GET', '/api/leads');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });
});

describe('sign in', () => {
  let s;
  before(async () => { s = await start(); });
  after(() => s.close());

  test('wrong password, unknown user and disabled account all look identical', async () => {
    const wrong = await s.login('asha', 'not the password!!');
    const unknown = await s.login('nobody', PW);
    const disabled = await s.login('gone', PW);
    for (const r of [wrong, unknown, disabled]) {
      assert.equal(r.status, 401);
      assert.equal(r.setCookie, null);
    }
    assert.deepEqual(wrong.json, unknown.json);
    assert.deepEqual(wrong.json, disabled.json);
    assert.equal(wrong.json.error, 'Incorrect username or password.');
  });

  test('missing or non-string fields are a 400, not a crash', async () => {
    for (const body of [{}, { username: 'asha' }, { username: 1, password: 2 }, { username: {}, password: [] }, { username: '  ', password: 'x' }]) {
      assert.equal((await s.call('POST', '/api/auth/login', { body })).status, 400);
    }
    assert.equal((await s.call('POST', '/api/auth/login', { body: '{"username":' })).status, 400);
  });

  test('success sets a hardened cookie and never returns the hash', async () => {
    const r = await s.login('ASHA'); // usernames are case-insensitive
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.user, { id: 'asha', username: 'asha', displayName: 'Asha Verma', role: 'admin' });
    assert.ok(!r.text.includes('scrypt'));
    assert.match(r.setCookie, /^rf_session=[A-Za-z0-9_-]{40,}/);
    assert.match(r.setCookie, /HttpOnly/);
    assert.match(r.setCookie, /SameSite=Strict/);
    assert.match(r.setCookie, /Path=\//);
    assert.doesNotMatch(r.setCookie, /Secure/); // not production
  });

  test('email-style usernames work', async () => {
    assert.equal((await s.login('Ravi@Example.com')).status, 200);
  });

  test('session grants access; /me and data routes work', async () => {
    const { cookie } = await s.login('ravi@example.com');
    const me = await s.call('GET', '/api/auth/me', { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.json.user.id, 'ravi');
    const leads = await s.call('GET', '/api/leads', { cookie });
    assert.equal(leads.status, 200);
    assert.ok(Array.isArray(leads.json) && leads.json.length > 0, 'existing leads still served');
    const dash = await s.call('GET', '/api/dashboard', { cookie });
    assert.equal(dash.status, 200);
    assert.equal(typeof dash.json.totalLeads, 'number');
  });

  test('a forged or guessed cookie gets nothing', async () => {
    for (const c of ['rf_session=abc', 'rf_session=' + 'A'.repeat(43), 'rf_session=', 'other=1']) {
      assert.equal((await s.call('GET', '/api/leads', { cookie: c })).status, 401);
    }
  });

  test('each sign-in issues a new token', async () => {
    const a = await s.login('asha');
    const b = await s.login('asha');
    assert.notEqual(a.cookie, b.cookie);
  });
});

describe('roles', () => {
  let s;
  before(async () => { s = await start(); });
  after(() => s.close());

  test('only admins can change institute info; staff can do everything else', async () => {
    const staff = (await s.login('ravi@example.com')).cookie;
    const admin = (await s.login('asha')).cookie;
    const patch = { institute: { name: 'Test Institute' } };
    const denied = await s.call('PUT', '/api/settings', { body: patch, cookie: staff });
    assert.equal(denied.status, 403);
    const allowed = await s.call('PUT', '/api/settings', { body: patch, cookie: admin });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.json.institute.name, 'Test Institute');
    assert.equal((await s.call('GET', '/api/settings', { cookie: staff })).json.institute.name, 'Test Institute');

    const lead = await s.call('POST', '/api/leads', { body: { name: 'New Student', phone: '9000000000' }, cookie: staff });
    assert.equal(lead.status, 201);
    const msg = await s.call('POST', '/api/messages', { body: { leadId: lead.json.id, sender: 'staff', text: 'Hello' }, cookie: staff });
    assert.equal(msg.status, 201);
    assert.equal(msg.json.by, 'Ravi Singh'); // who logged it comes from the session, not the request
    const spoof = await s.call('POST', '/api/messages', { body: { leadId: lead.json.id, sender: 'staff', text: 'Hi', by: 'Asha Verma' }, cookie: staff });
    assert.equal(spoof.json.by, 'Ravi Singh');
  });

  test('role sent by the client is ignored', async () => {
    const staff = (await s.login('ravi@example.com')).cookie;
    const r = await s.call('PUT', '/api/settings', { body: { institute: { name: 'x' }, role: 'admin' }, cookie: staff, headers: { 'X-Role': 'admin' } });
    assert.equal(r.status, 403);
  });

  test('settings input is validated', async () => {
    const admin = (await s.login('asha')).cookie;
    for (const body of [[], 'x', { institute: 'str' }, { courses: {} }, { aiKnowledge: [] }]) {
      assert.equal((await s.call('PUT', '/api/settings', { body, cookie: admin })).status, 400);
    }
  });
});

describe('sign out', () => {
  let s;
  before(async () => { s = await start(); });
  after(() => s.close());

  test('logout ends the session on the server, not just in the browser', async () => {
    const { cookie } = await s.login('asha');
    assert.equal((await s.call('GET', '/api/leads', { cookie })).status, 200);
    const out = await s.call('POST', '/api/auth/logout', { cookie });
    assert.equal(out.status, 200);
    assert.match(out.setCookie, /Max-Age=0/);
    // The old cookie value is replayed, as an attacker who copied it would:
    assert.equal((await s.call('GET', '/api/leads', { cookie })).status, 401);
    assert.equal((await s.call('GET', '/api/auth/me', { cookie })).status, 401);
  });

  test('logout without a session still succeeds and clears the cookie', async () => {
    const out = await s.call('POST', '/api/auth/logout');
    assert.equal(out.status, 200);
    assert.match(out.setCookie, /Max-Age=0/);
  });
});

describe('CSRF protection', () => {
  let s;
  before(async () => { s = await start(); });
  after(() => s.close());

  test('state-changing requests without the custom header are refused', async () => {
    assert.equal((await s.login('asha', PW, { csrf: false })).status, 403);
    const { cookie } = await s.login('asha');
    assert.equal((await s.call('POST', '/api/leads', { body: { name: 'X' }, cookie, csrf: false })).status, 403);
    assert.equal((await s.call('POST', '/api/auth/logout', { cookie, csrf: false })).status, 403);
    assert.equal((await s.call('GET', '/api/auth/me', { cookie })).status, 200, 'the session survived the blocked logout');
  });

  test('a request from another origin is refused even with the header', async () => {
    const { cookie } = await s.login('asha');
    const evil = await s.call('POST', '/api/leads', { body: { name: 'X' }, cookie, headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    const same = await s.call('POST', '/api/leads', { body: { name: 'X' }, cookie, headers: { Origin: s.base } });
    assert.equal(same.status, 201);
    const cross = await s.call('GET', '/api/leads', { cookie, headers: { 'Sec-Fetch-Site': 'cross-site' } });
    assert.equal(cross.status, 403);
    const nullOrigin = await s.call('POST', '/api/leads', { body: { name: 'X' }, cookie, headers: { Origin: 'null' } });
    assert.equal(nullOrigin.status, 403);
  });
});

describe('rate limiting', () => {
  test('five wrong guesses block that username, even for the right password', async () => {
    const s = await start();
    try {
      for (let i = 0; i < 5; i++) assert.equal((await s.login('asha', 'wrong password ' + i)).status, 401);
      const blocked = await s.login('asha', PW);
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get('retry-after')) > 0);
      assert.equal(blocked.setCookie, null);
      // A different account from the same address is not locked out by that.
      assert.equal((await s.login('ravi@example.com', PW)).status, 200);
    } finally { s.close(); }
  });

  test('the block lifts after the window', async () => {
    let t = 1_700_000_000_000;
    const s = await start({ now: () => t });
    try {
      for (let i = 0; i < 5; i++) await s.login('asha', 'nope nope nope ' + i);
      assert.equal((await s.login('asha', PW)).status, 429);
      t += 16 * 60_000;
      assert.equal((await s.login('asha', PW)).status, 200);
    } finally { s.close(); }
  });

  test('a successful sign-in clears the failure count', async () => {
    const s = await start();
    try {
      for (let i = 0; i < 4; i++) await s.login('asha', 'nope nope nope ' + i);
      assert.equal((await s.login('asha', PW)).status, 200);
      for (let i = 0; i < 4; i++) assert.equal((await s.login('asha', 'again nope ' + i)).status, 401);
    } finally { s.close(); }
  });

  test('guessing many usernames from one address is limited too', async () => {
    const s = await start();
    try {
      let last;
      for (let i = 0; i < 21; i++) last = await s.login('user' + i, 'some password here');
      assert.equal(last.status, 429);
      assert.equal((await s.login('asha', PW)).status, 429, 'address is blocked entirely');
    } finally { s.close(); }
  });
});

describe('session expiry', () => {
  test('idle sessions end; activity keeps them alive; there is an absolute cap', async () => {
    let t = 1_700_000_000_000;
    const s = await start({ now: () => t, env: { SESSION_IDLE_MINUTES: '30', SESSION_MAX_HOURS: '2' } });
    try {
      const { cookie } = await s.login('asha');
      for (let i = 0; i < 3; i++) { // active every 20 minutes
        t += 20 * 60_000;
        assert.equal((await s.call('GET', '/api/leads', { cookie })).status, 200, 'renewed by activity');
      }
      t += 40 * 60_000; // 100 minutes in; 40 idle minutes
      assert.equal((await s.call('GET', '/api/leads', { cookie })).status, 401, 'idle timeout');

      const second = (await s.login('asha')).cookie;
      for (let i = 0; i < 5; i++) { t += 25 * 60_000; await s.call('GET', '/api/leads', { cookie: second }); }
      assert.equal((await s.call('GET', '/api/leads', { cookie: second })).status, 401, 'absolute cap (2h) reached despite activity');
    } finally { s.close(); }
  });
});

describe('production cookie settings', () => {
  test('Secure + __Host- prefix + HSTS + CSP in production', async () => {
    const s = await start({ env: { NODE_ENV: 'production' } });
    try {
      const r = await s.login('asha');
      assert.match(r.setCookie, /^__Host-rf_session=/);
      assert.match(r.setCookie, /; Secure/);
      assert.match(r.setCookie, /HttpOnly/);
      assert.match(r.setCookie, /SameSite=Strict/);
      assert.doesNotMatch(r.setCookie, /Domain=/);
      assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
      assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.ok(r.headers.get('strict-transport-security'));
      const me = await s.call('GET', '/api/auth/me', { cookie: r.cookie });
      assert.equal(me.status, 200);
    } finally { s.close(); }
  });
  test('COOKIE_SECURE=false allows plain-HTTP production on a trusted network', async () => {
    const s = await start({ env: { NODE_ENV: 'production', COOKIE_SECURE: 'false' } });
    try {
      const r = await s.login('asha');
      assert.match(r.setCookie, /^rf_session=/);
      assert.doesNotMatch(r.setCookie, /Secure/);
    } finally { s.close(); }
  });
});

describe('staff:hash command', () => {
  const script = fileURLToPath(new URL('../scripts/hash-password.js', import.meta.url));
  const run = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8' });

  test('prints a hash that verifies, and never prints the password', async () => {
    const r = run(`${PW}\n${PW}\n`);
    assert.equal(r.status, 0, r.stderr);
    const m = /passwordHash: '(scrypt\$[^']+)'/.exec(r.stdout);
    assert.ok(m, r.stdout);
    assert.ok(!r.stdout.includes(PW) && !r.stderr.includes(PW));
    assert.equal(await verifyPassword(PW, m[1]), true);
    assert.equal(parseHash(m[1]).N, 65536);
    // ...and the account loader accepts it as-is, with production strictness:
    const d = buildAccountDirectory([{ id: 'cli', username: 'cli', displayName: 'CLI', passwordHash: m[1] }]);
    assert.equal(d.enabled, 1);
  });
  test('refuses short passwords and mismatches', () => {
    assert.equal(run('short\nshort\n').status, 1);
    assert.equal(run(`${PW}\n${PW}x\n`).status, 1);
  });
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));
