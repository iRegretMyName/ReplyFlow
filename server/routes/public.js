// The only part of the API that needs no sign-in. Customers can read the public site data and
// send an enquiry; they can do nothing else.
import { Router } from 'express';
import { createLimiter } from '../auth/rateLimit.js';
import { createEnquiry, publicLegal, publicSite, validateEnquiry } from '../data/content.js';

const HOUR = 3_600_000;

export function createPublicRouter({ now = Date.now, maxEnquiriesPerHour = 5 } = {}) {
  const router = Router();
  // Each address may send a handful of enquiries per hour: enough for a real family, not for a bot.
  const limiter = createLimiter({ max: maxEnquiriesPerHour, windowMs: HOUR, blockMs: HOUR, now });

  router.get('/site', (_req, res) => res.json(publicSite()));

  router.get('/legal/:name', (req, res) => {
    const text = publicLegal(req.params.name);
    if (!text.trim()) return res.status(404).json({ error: 'Not found' });
    res.json({ text });
  });

  router.post('/enquiries', (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const gate = limiter.check(ip);
    if (!gate.allowed) {
      res.setHeader('Retry-After', String(gate.retryAfterSec));
      return res.status(429).json({ error: 'You have sent several enquiries already. Please try again later, or call us.', code: 'RATE_LIMITED' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // "company" is a field real people never see. If it is filled in, a bot did it: pretend all is well and store nothing.
    if (typeof body.company === 'string' && body.company.trim()) return res.status(201).json({ ok: true });

    const { value, fields } = validateEnquiry(body);
    if (fields) return res.status(400).json({ error: 'Please check the highlighted fields.', fields });
    limiter.fail(ip); // counts this submission towards the hourly limit
    const saved = createEnquiry(value);
    if (!saved) return res.status(503).json({ error: "We can't take enquiries right now. Please call us instead." });
    console.log('[enquiry] new website enquiry received');
    res.status(201).json({ ok: true });
  });

  return router;
}
