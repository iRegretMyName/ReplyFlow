// Request guards. Everything here runs on the server, so hiding a button in the
// browser is never what keeps data safe.
import { publicUser } from './accounts.js';

// ---------- cookies ----------
export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    if (!(name in out)) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

export function setSessionCookie(res, cfg, token, maxAgeMs) {
  const parts = [
    `${cfg.cookieName}=${token}`,
    'Path=/',
    'HttpOnly',                 // JavaScript in the page can never read it
    'SameSite=Strict',          // never sent on requests started from another site
    `Max-Age=${Math.max(1, Math.floor(maxAgeMs / 1000))}`,
  ];
  if (cfg.secureCookies) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res, cfg) {
  const parts = [`${cfg.cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  if (cfg.secureCookies) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// ---------- headers ----------
export function securityHeaders(cfg) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // The dev server (Vite) needs inline scripts for hot reload, so CSP is production only.
    if (cfg.isProd) res.setHeader('Content-Security-Policy', csp);
    if (cfg.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    next();
  };
}

export const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

// ---------- CSRF ----------
// Defence in depth for cookie sessions:
//  1. The cookie is SameSite=Strict, so other sites cannot send it at all.
//  2. Every request that changes data must carry a custom header. A web page on
//     another origin cannot add one without the browser asking this server first.
//  3. If the browser says which origin the request came from, it must be ours.
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'replyflow';

export function csrfGuard(cfg) {
  const devOrigins = cfg.isProd ? [] : ['localhost:5173', '127.0.0.1:5173'];
  const extra = new Set([...cfg.allowedOrigins.map((o) => { try { return new URL(o).host; } catch { return o; } }), ...devOrigins]);
  const forbid = (res) => res.status(403).json({ error: 'Request blocked. Reload the page and try again.', code: 'CSRF' });

  return (req, res, next) => {
    if (req.headers['sec-fetch-site'] === 'cross-site') return forbid(res);
    if (!UNSAFE.has(req.method)) return next();
    if (req.headers[CSRF_HEADER] !== CSRF_VALUE) return forbid(res);
    const origin = req.headers.origin;
    if (origin) {
      let host;
      try { host = new URL(origin).host; } catch { return forbid(res); }
      if (host !== req.headers.host && !extra.has(host)) return forbid(res);
    }
    next();
  };
}

// ---------- sessions ----------
// Looks up the session cookie and, if it is valid, attaches req.user. The account
// is re-read from the account list on every request, so a disabled account or a
// changed role takes effect immediately, not when its session expires.
export function attachSession({ cfg, sessions, directory }) {
  return (req, res, next) => {
    req.user = null;
    req.sessionToken = null;
    const token = parseCookies(req.headers.cookie)[cfg.cookieName];
    if (!token) return next();
    const session = sessions.touch(token);
    if (!session) return next();
    const account = directory.byId.get(session.userId);
    if (!account || !account.enabled) { sessions.destroy(token); return next(); }
    req.user = publicUser(account);
    req.sessionToken = token;
    req.sessionRemainingMs = session.remainingMs;
    next();
  };
}

export const requireAuth = (req, res, next) => {
  if (req.user) return next();
  res.status(401).json({ error: 'Please sign in to continue.', code: 'UNAUTHENTICATED' });
};

export const requireRole = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  res.status(403).json({ error: "You don't have permission to do that.", code: 'FORBIDDEN' });
};
