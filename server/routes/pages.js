// Editable page content: announcement banner, homepage text, About page, privacy policy and terms.
import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import { getPages, savePages, validatePages } from '../data/content.js';

const router = Router();
router.get('/', (_req, res) => res.json(getPages()));
router.put('/', requireRole('admin'), (req, res) => {
  const { value, fields } = validatePages(req.body);
  if (fields) return res.status(400).json({ error: 'Please check the highlighted fields.', fields });
  res.json(savePages(value));
});
export default router;
