// Course management for the admin panel. Mounted behind requireAuth; changes need an administrator.
import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import { createCourse, deleteCourse, findCourse, listCourses, mergedCourse, updateCourse, validateCourse } from '../data/content.js';

const router = Router();
const admin = requireRole('admin');
const invalid = (res, fields) => res.status(fields.name?.includes('already exists') ? 409 : 400).json({ error: 'Please check the highlighted fields.', fields });
const notFound = (res) => res.status(404).json({ error: 'Course not found' });

router.get('/', (_req, res) => res.json(listCourses()));

router.post('/', admin, (req, res) => {
  const { value, fields } = validateCourse(req.body);
  if (fields) return invalid(res, fields);
  res.status(201).json(createCourse(value));
});

router.put('/:id', admin, (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return notFound(res);
  // Fields left out of the request keep their current value.
  const merged = { ...mergedCourse(course), ...(req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) };
  const { value, fields } = validateCourse(merged, { ignoreId: course.id });
  if (fields) return invalid(res, fields);
  res.json(updateCourse(course, value));
});

router.delete('/:id', admin, (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return notFound(res);
  deleteCourse(course);
  res.json({ ok: true });
});

export default router;
