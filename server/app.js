// Builds the Express app. Kept separate from server.js so tests can start it
// with their own accounts and clock.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import apiRouter from './routes/index.js';
import { buildAccountDirectory } from './auth/accounts.js';
import { createSessionStore } from './auth/sessions.js';
import { readAuthConfig } from './auth/config.js';
import { createAuthRouter } from './auth/routes.js';
import { createPublicRouter } from './routes/public.js';
import { imagesInUse } from './data/content.js';
import { pruneUploads, uploadDir } from './data/uploads.js';
import { attachSession, csrfGuard, noStore, requireAuth, securityHeaders } from './auth/middleware.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');
// Pages the website really has. The course page address (/courses/some-slug) is checked by the app.
const KNOWN_PAGE = /^\/(?:(?:courses|about|contact|faq|privacy|terms|staff\/login)\/?|courses\/[^/]+\/?|admin(?:\/.*)?)?$/;

export function createApp({ accounts, env = process.env, now = Date.now, allowWeakHashes = false, distDir = DIST } = {}) {
  const cfg = readAuthConfig(env);
  const directory = buildAccountDirectory(accounts, { allowWeakHashes });
  const sessions = createSessionStore({ idleMs: cfg.idleMs, absoluteMs: cfg.absoluteMs, now });

  const app = express();
  app.disable('x-powered-by');
  // Behind a reverse proxy (nginx, a hosting platform), set TRUST_PROXY to the number
  // of proxies so the real visitor address is used for sign-in rate limiting.
  if (env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);

  app.use(securityHeaders(cfg));
  app.use(express.json({ limit: '100kb' }));

  // Uploaded images (course pictures and the like). Public, with random file names.
  // Unused files are cleaned out at start-up.
  try { pruneUploads(imagesInUse()); } catch { /* nothing to clean */ }
  app.use('/uploads', express.static(uploadDir(), { maxAge: '7d', immutable: true }));

  // Everything under /api. Open to everyone: the read-only public site data and the sign-in routes.
  // Everything after requireAuth needs a signed-in staff member.
  const api = express.Router();
  api.use(noStore);
  api.use(csrfGuard(cfg));
  api.use(attachSession({ cfg, sessions, directory }));
  api.use('/public', createPublicRouter({ now, maxEnquiriesPerHour: Number(env.ENQUIRY_LIMIT_PER_HOUR) || 5 }));
  api.use('/auth', createAuthRouter({ cfg, sessions, directory, now }));
  api.use(requireAuth);
  api.use(apiRouter);
  api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use('/api', api);

  // Production: serve the built client from the same origin as the API.
  // The customer site and sign-in page are public. /admin pages are only served to a signed-in
  // session: everyone else is redirected to the staff sign-in page by the server itself.
  // (The API enforces access separately, so this is a convenience on top, not the only lock.)
  const indexFile = path.join(distDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use('/admin', attachSession({ cfg, sessions, directory }), (req, res, next) => {
      if (req.user) return next();
      res.redirect(302, `/staff/login?next=${encodeURIComponent(req.originalUrl)}`);
    });
    app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    // Any other address gets the app (which draws its own "not found" page). Unknown pages are
    // answered with a real 404 status so search engines don't index them.
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      if (!KNOWN_PAGE.test(req.path)) res.status(404);
      res.sendFile(indexFile);
    });
  }

  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return { app, cfg, directory, sessions };
}
