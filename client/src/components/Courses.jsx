// Course management. These records are what the public website lists, and the facts on each
// (fee, batch timings, ...) are also the only facts the AI assistant may state.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Dialog from './ui/Dialog.jsx';
import Icon from './ui/Icon.jsx';
import { EmptyState, ErrorState, InlineError, SkeletonRows } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import ImageField from './ui/ImageField.jsx';
import WebsiteTabs from './WebsiteTabs.jsx';

const EMPTY = { name: '', slug: '', class: '', description: '', eligibility: '', highlights: [], curriculum: [], image: '', featured: false, duration: '', batchTimings: '', fee: '', location: '', demoAvailability: '', published: true };
const FACTS = [
  ['duration', 'Duration', 'e.g. 2 years'],
  ['batchTimings', 'Batch timings', 'e.g. Mon–Fri, 4pm–7pm'],
  ['fee', 'Fee', 'e.g. ₹1,20,000 per year'],
  ['location', 'Location', 'Which centre or branch'],
  ['demoAvailability', 'Demo availability', 'e.g. Free demo every Saturday'],
];

export default function Courses() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user.role === 'admin'; // the server enforces this too

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('added');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // course being edited, or null when adding
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    api.courses().then(setCourses).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = courses.filter((c) =>
      (filter === 'all' || (filter === 'published') === c.published) &&
      (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
    return sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [courses, search, filter, sort]);
  const filtering = search.trim() || filter !== 'all';

  const openAdd = () => { setEditing(null); setForm(EMPTY); setErrors({}); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setErrors({}); setFormOpen(true); };
  const set = (key, value) => { setForm({ ...form, [key]: value }); setErrors((e) => ({ ...e, [key]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (editing) {
        const updated = await api.updateCourse(editing.id, form);
        setCourses((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        toast.success(`${updated.name} updated. The website shows the change now.`);
      } else {
        const created = await api.createCourse(form);
        setCourses((list) => [...list, created]);
        toast.success(created.published ? `${created.name} added to the website.` : `${created.name} saved (hidden from the website).`);
      }
      setFormOpen(false);
    } catch (err) {
      if (err.data?.fields) setErrors(err.data.fields); else toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (c) => { setToDelete(c); setDeleteOpen(true); };
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteCourse(toDelete.id);
      setCourses((list) => list.filter((c) => c.id !== toDelete.id));
      toast.success(`${toDelete.name} deleted.`);
      setDeleteOpen(false);
    } catch (err) {
      toast.error(err.message);
      if (err.status === 404) { setDeleteOpen(false); load(); }
    } finally {
      setDeleting(false);
    }
  };

  // Highlights and curriculum are typed one per line.
  const linesProps = (key) => ({
    id: `course-${key}`,
    value: (form[key] || []).join('\n'),
    onChange: (e) => set(key, e.target.value.split('\n')),
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `course-${key}-err` : undefined,
  });

  const fieldProps = (key) => ({
    id: `course-${key}`,
    value: form[key] || '',
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `course-${key}-err` : undefined,
    onChange: (e) => set(key, e.target.value),
  });

  return (
    <section>
      <WebsiteTabs current="w-courses" />
      <header className="page-head">
        <div>
          <h1>Courses</h1>
          <p className="page-sub">What your website lists, and the facts the AI assistant may state.</p>
        </div>
        <div className="head-actions">
          {canEdit && <button type="button" className="btn primary" onClick={openAdd}><Icon name="plus" size={16} /> Add course</button>}
        </div>
      </header>

      {!canEdit && (
        <div className="notice"><Icon name="info" size={18} /><p><strong>Only administrators can add, edit or delete courses.</strong> You can see what the website currently lists.</p></div>
      )}

      <div className="toolbar" role="search">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" aria-label="Search courses" placeholder="Search courses" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select aria-label="Filter by visibility" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All courses</option>
          <option value="published">On the website</option>
          <option value="hidden">Hidden</option>
        </select>
        <select aria-label="Sort courses" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="added">Website order</option>
          <option value="name">Name A–Z</option>
        </select>
        {!loading && !error && (
          <p className="toolbar-count" aria-live="polite">{filtering ? `${shown.length} of ${courses.length}` : courses.length} {courses.length === 1 ? 'course' : 'courses'}</p>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="panel"><SkeletonRows rows={4} /></div>
      ) : shown.length === 0 ? (
        <div className="panel">
          {filtering ? (
            <EmptyState icon="search" title="No courses match" action={<button type="button" className="btn" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>} />
          ) : (
            <EmptyState icon="book" title="No courses yet" action={canEdit ? <button type="button" className="btn primary" onClick={openAdd}>Add the first course</button> : null}>
              Courses you add appear on your public website.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col" className="hide-sm">Class</th>
                <th scope="col" className="hide-md">Fee</th>
                <th scope="col" className="hide-md">Batch timings</th>
                <th scope="col">Website</th>
                {canEdit && <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="cell-flex">
                      <span className="thumb" aria-hidden="true">{c.image ? <img src={`/uploads/${c.image}`} alt="" /> : <Icon name="book" size={16} />}</span>
                      <span>
                        <span className="cell-name static">{c.name}{c.featured && <span className="tag tag-featured">Featured</span>}</span>
                        {c.description && <span className="cell-sub clamp">{c.description}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="hide-sm">{c.class || '—'}</td>
                  <td className="hide-md">{c.fee || '—'}</td>
                  <td className="hide-md">{c.batchTimings || '—'}</td>
                  <td>
                    {c.published
                      ? <a className="tag tag-new" href={`/courses/${c.slug}`} target="_blank" rel="noopener noreferrer">Published</a>
                      : <span className="tag tag-lost">Hidden</span>}
                  </td>
                  {canEdit && (
                    <td className="actions-col">
                      <button type="button" className="icon-btn" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}><Icon name="edit" size={17} /></button>
                      <button type="button" className="icon-btn danger" onClick={() => askDelete(c)} aria-label={`Delete ${c.name}`}><Icon name="trash" size={17} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add a course'}
        footer={(
          <>
            <button type="button" className="btn" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
            <button type="submit" form="course-form" className="btn primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add course'}</button>
          </>
        )}
      >
        <form id="course-form" onSubmit={submit} noValidate>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="course-name">Course name *</label>
              <input {...fieldProps('name')} maxLength={80} autoComplete="off" />
              <InlineError id="course-name-err">{errors.name}</InlineError>
            </div>
            <div className="field">
              <label htmlFor="course-class">Class</label>
              <input {...fieldProps('class')} maxLength={20} placeholder="e.g. 11-12" autoComplete="off" />
              <InlineError id="course-class-err">{errors.class}</InlineError>
            </div>
            <div className="field check-field">
              <label className="check">
                <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
                <span>Show on the website</span>
              </label>
            </div>
            <div className="field span-2">
              <label htmlFor="course-description">Description</label>
              <textarea {...fieldProps('description')} rows={3} maxLength={600} />
              <InlineError id="course-description-err">{errors.description}</InlineError>
            </div>
            <div className="field check-field span-2">
              <label className="check">
                <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                <span>Feature on the homepage</span>
              </label>
            </div>
            <div className="span-2">
              <ImageField label="Course image" value={form.image} onChange={(v) => set('image', v)} error={errors.image} hint="Shown on the course cards and page. Without one, a plain pattern is used." />
            </div>
            <div className="field span-2">
              <label htmlFor="course-slug">Page address</label>
              <input {...fieldProps('slug')} maxLength={60} placeholder="made from the name if left blank" autoComplete="off" />
              <span className="hint">yoursite.com/courses/<strong>{form.slug || '…'}</strong>. Changing it breaks old links to this course.</span>
              <InlineError id="course-slug-err">{errors.slug}</InlineError>
            </div>
            <div className="field span-2">
              <label htmlFor="course-eligibility">Who it's for (eligibility)</label>
              <input {...fieldProps('eligibility')} maxLength={200} autoComplete="off" />
              <InlineError id="course-eligibility-err">{errors.eligibility}</InlineError>
            </div>
            <div className="field">
              <label htmlFor="course-highlights">Highlights <span className="hint">one per line, up to 8</span></label>
              <textarea {...linesProps('highlights')} rows={4} />
              <InlineError id="course-highlights-err">{errors.highlights}</InlineError>
            </div>
            <div className="field">
              <label htmlFor="course-curriculum">Curriculum <span className="hint">one topic per line, up to 12</span></label>
              <textarea {...linesProps('curriculum')} rows={4} />
              <InlineError id="course-curriculum-err">{errors.curriculum}</InlineError>
            </div>
          </div>
          <p className="form-section">Facts <span className="muted">Shown to customers and used by the AI assistant. Leave blank if unknown.</span></p>
          <div className="form-grid">
            {FACTS.map(([key, label, ph]) => (
              <div className="field" key={key}>
                <label htmlFor={`course-${key}`}>{label}</label>
                <input {...fieldProps(key)} placeholder={ph} autoComplete="off" />
                <InlineError id={`course-${key}-err`}>{errors[key]}</InlineError>
              </div>
            ))}
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete this course?"
        size="sm"
        footer={(
          <>
            <button type="button" className="btn" onClick={() => setDeleteOpen(false)} disabled={deleting}>Keep it</button>
            <button type="button" className="btn danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete course'}</button>
          </>
        )}
      >
        <p>
          <strong>{toDelete?.name}</strong> will be removed from your website and the AI assistant will lose its facts. Existing leads keep the course name. This can't be undone.
        </p>
        <p className="muted small">To take it off the website but keep it, edit it and turn off “Show on the website” instead.</p>
      </Dialog>
    </section>
  );
}
