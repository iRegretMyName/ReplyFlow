// Sign in, sign out and "who am I". There is deliberately no route for creating
// or changing accounts: those live in server/config/staff-accounts.js.
import { Router } from 'express';
import { normaliseUsername, publicUser } from './accounts.js';
import { verifyPassword, dummyHash, MAX_PASSWORD_LENGTH } from './passwords.js';
import { createLimiter } from './rateLimit.js';
import { clearSessionCookie, setSessionCookie, parseCookies } from './middleware.js';

const WINDOW = 15 * 60_000;

export function createAuthRouter({ cfg, sessions, directory, now = Date.now }) {
  const router = Router();

  // Five wrong guesses for one username from one address -> blocked for 15 minutes.
  // Twenty wrong guesses of any kind from one address -> blocked for 15 minutes.
  // Keyed on address + username so strangers cannot lock real staff out from elsewhere.
  const perAccount = createLimiter({ max: 5, windowMs: WINDOW, blockMs: WINDOW, now });
  const perAddress = createLimiter({ max: 20, windowMs: WINDOW, blockMs: WINDOW, now });

  const ipOf = (req) => req.ip || req.socket?.remoteAddress || 'unknown';
  const minutes = (sec) => Math.max(1, Math.ceil(sec / 60));

  router.post('/login', async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string'
        || !username.trim() || !password || username.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: 'Enter your username and password.', code: 'BAD_REQUEST' });
      }

      const ip = ipOf(req);
      const name = normaliseUsername(username);
      const accountKey = `${ip}|${name.slice(0, 64)}`;

      const blocked = [perAddress.check(ip), perAccount.check(accountKey)].find((r) => !r.allowed);
      if (blocked) {
        res.setHeader('Retry-After', String(blocked.retryAfterSec));
        return res.status(429).json({
          error: `Too many sign-in attempts. Try again in ${minutes(blocked.retryAfterSec)} minute${minutes(blocked.retryAfterSec) === 1 ? '' : 's'}.`,
          code: 'RATE_LIMITED',
        });
      }

      const account = directory.byUsername.get(name);
      // Always do the same amount of hashing work, even for unknown usernames.
      const passwordOk = await verifyPassword(password, account ? account.passwordHash : await dummyHash());

      if (!account || !account.enabled || !passwordOk) {
        perAccount.fail(accountKey);
        perAddress.fail(ip);
        console.warn(`[auth] failed sign-in from ${ip}`);
        // One message for unknown user, wrong password and disabled account.
        return res.status(401).json({ error: 'Incorrect username or password.', code: 'INVALID_CREDENTIALS' });
      }

      perAccount.reset(accountKey);
      // A fresh session on every sign-in; any session cookie sent along is retired.
      sessions.destroy(parseCookies(req.headers.cookie)[cfg.cookieName]);
      const token = sessions.create(account.id);
      setSessionCookie(res, cfg, token, cfg.absoluteMs);
      console.log(`[auth] signed in: ${account.id}`);
      res.json({ user: publicUser(account) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in.', code: 'UNAUTHENTICATED' });
    res.json({ user: req.user });
  });

  // Works even with a stale or missing session, so the cookie always gets cleared.
  router.post('/logout', (req, res) => {
    sessions.destroy(req.sessionToken || parseCookies(req.headers.cookie)[cfg.cookieName]);
    clearSessionCookie(res, cfg);
    res.json({ ok: true });
  });

  return router;
}
