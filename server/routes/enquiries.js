// Enquiries sent through the website's contact form. Staff only: they contain people's contact details.
import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import { save as saveStore } from '../data/store.js';
import { STATUSES, convertEnquiry, deleteEnquiry, enquiryCounts, findEnquiry, listEnquiries } from '../data/content.js';

const router = Router();
const notFound = (res) => res.status(404).json({ error: 'Enquiry not found' });

router.get('/', (_req, res) => res.json(listEnquiries()));
router.get('/counts', (_req, res) => res.json(enquiryCounts()));

router.put('/:id', (req, res) => {
  const e = findEnquiry(req.params.id);
  if (!e) return notFound(res);
  if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
  e.status = req.body.status;
  saveStore();
  res.json(e);
});

router.post('/:id/convert', (req, res) => {
  const e = findEnquiry(req.params.id);
  if (!e) return notFound(res);
  const lead = convertEnquiry(e, req.user.displayName);
  res.json({ lead, enquiry: e });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const e = findEnquiry(req.params.id);
  if (!e) return notFound(res);
  deleteEnquiry(e);
  res.json({ ok: true });
});

export default router;
