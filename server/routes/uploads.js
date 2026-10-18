// Image upload for the admin panel. The file is sent as the raw request body.
import express, { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import { MAX_UPLOAD_BYTES, saveImage } from '../data/uploads.js';

const router = Router();
router.post('/', requireRole('admin'), express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: 'No image was received.' });
  const name = saveImage(buf);
  if (!name) return res.status(400).json({ error: 'Please choose a JPEG, PNG or WebP image.' });
  res.status(201).json({ name, url: `/uploads/${name}` });
});
export default router;
