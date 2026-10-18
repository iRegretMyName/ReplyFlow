import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import { createFaq, deleteFaq, findFaq, listFaqs, moveFaq, updateFaq, validateFaq } from '../data/content.js';

const router = Router();
const admin = requireRole('admin');
const invalid = (res, fields) => res.status(400).json({ error: 'Please check the highlighted fields.', fields });
const notFound = (res) => res.status(404).json({ error: 'Question not found' });

router.get('/', (_req, res) => res.json(listFaqs()));
router.post('/', admin, (req, res) => {
  const { value, fields } = validateFaq(req.body);
  if (fields) return invalid(res, fields);
  res.status(201).json(createFaq(value));
});
router.put('/:id', admin, (req, res) => {
  const faq = findFaq(req.params.id);
  if (!faq) return notFound(res);
  const { value, fields } = validateFaq({ ...faq, ...(req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) });
  if (fields) return invalid(res, fields);
  res.json(updateFaq(faq, value));
});
router.post('/:id/move', admin, (req, res) => {
  const faq = findFaq(req.params.id);
  if (!faq) return notFound(res);
  const dir = req.body?.direction;
  if (dir !== 'up' && dir !== 'down') return res.status(400).json({ error: 'direction must be up or down' });
  res.json(moveFaq(faq, dir));
});
router.delete('/:id', admin, (req, res) => {
  const faq = findFaq(req.params.id);
  if (!faq) return notFound(res);
  deleteFaq(faq);
  res.json({ ok: true });
});
export default router;
