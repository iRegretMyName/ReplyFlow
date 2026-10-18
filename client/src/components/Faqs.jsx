// Frequently asked questions shown on the public FAQ page and the homepage.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Dialog from './ui/Dialog.jsx';
import Icon from './ui/Icon.jsx';
import { EmptyState, ErrorState, InlineError, SkeletonRows } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import WebsiteTabs from './WebsiteTabs.jsx';

const EMPTY = { question: '', answer: '', published: true };

export default function Faqs() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(''); setLoading(true);
    api.faqs().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setErrors({}); setOpen(true); };
  const openEdit = (f) => { setEditing(f); setForm({ question: f.question, answer: f.answer, published: f.published !== false }); setErrors({}); setOpen(true); };
  const set = (k, v) => { setForm({ ...form, [k]: v }); setErrors((e) => ({ ...e, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setErrors({});
    try {
      if (editing) { const u = await api.updateFaq(editing.id, form); setItems((l) => l.map((x) => (x.id === u.id ? u : x))); toast.success('Question updated.'); }
      else { const c = await api.createFaq(form); setItems((l) => [...l, c]); toast.success('Question added.'); }
      setOpen(false);
    } catch (err) { if (err.data?.fields) setErrors(err.data.fields); else toast.error(err.message); } finally { setSaving(false); }
  };

  const move = async (f, direction) => {
    try { setItems(await api.moveFaq(f.id, direction)); } catch (err) { toast.error(err.message); }
  };
  const togglePublished = async (f) => {
    try { const u = await api.updateFaq(f.id, { published: !(f.published !== false) }); setItems((l) => l.map((x) => (x.id === u.id ? u : x))); toast.success(u.published ? 'Now shown on the website.' : 'Hidden from the website.'); } catch (err) { toast.error(err.message); }
  };
  const confirmDelete = async () => {
    setBusy(true);
    try { await api.deleteFaq(toDelete.id); setItems((l) => l.filter((x) => x.id !== toDelete.id)); toast.success('Question deleted.'); setDelOpen(false); }
    catch (err) { toast.error(err.message); if (err.status === 404) { setDelOpen(false); load(); } } finally { setBusy(false); }
  };

  return (
    <section>
      <WebsiteTabs current="w-faqs" />
      <header className="page-head">
        <div>
          <h1>FAQs</h1>
          <p className="page-sub">Questions you've written appear first on the FAQ page. Answers about your courses, location and contact details are added automatically from your records.</p>
        </div>
        {canEdit && <button type="button" className="btn primary" onClick={openAdd}><Icon name="plus" size={16} /> Add question</button>}
      </header>
      {!canEdit && <div className="notice"><Icon name="info" size={18} /><p><strong>Only administrators can change FAQs.</strong></p></div>}

      {error ? <ErrorState message={error} onRetry={load} /> : loading ? <div className="panel"><SkeletonRows rows={4} /></div> : items.length === 0 ? (
        <div className="panel"><EmptyState icon="info" title="No questions of your own yet" action={canEdit ? <button type="button" className="btn primary" onClick={openAdd}>Add the first question</button> : null}>The FAQ page still shows automatic answers about your courses and contact details.</EmptyState></div>
      ) : (
        <ul className="panel rows">
          {items.map((f, i) => (
            <li key={f.id} className="row static">
              <span className="row-main">
                <strong>{f.question}</strong>
                <span className="row-sub clamp">{f.answer}</span>
                <span className="row-sub">{f.published !== false ? <span className="tag tag-new">Shown</span> : <span className="tag tag-lost">Hidden</span>}</span>
              </span>
              {canEdit && (
                <span className="row-actions">
                  <button type="button" className="icon-btn" onClick={() => move(f, 'up')} disabled={i === 0} aria-label={`Move “${f.question}” up`}><Icon name="up" size={17} /></button>
                  <button type="button" className="icon-btn" onClick={() => move(f, 'down')} disabled={i === items.length - 1} aria-label={`Move “${f.question}” down`}><Icon name="down" size={17} /></button>
                  <button type="button" className="btn small" onClick={() => togglePublished(f)}>{f.published !== false ? 'Hide' : 'Show'}</button>
                  <button type="button" className="icon-btn" onClick={() => openEdit(f)} aria-label={`Edit “${f.question}”`}><Icon name="edit" size={17} /></button>
                  <button type="button" className="icon-btn danger" onClick={() => { setToDelete(f); setDelOpen(true); }} aria-label={`Delete “${f.question}”`}><Icon name="trash" size={17} /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => !saving && setOpen(false)} title={editing ? 'Edit question' : 'Add a question'}
        footer={<><button type="button" className="btn" onClick={() => setOpen(false)} disabled={saving}>Cancel</button><button type="submit" form="faq-form" className="btn primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add question'}</button></>}>
        <form id="faq-form" onSubmit={submit} noValidate>
          <div className="field"><label htmlFor="faq-q">Question *</label>
            <input id="faq-q" value={form.question} maxLength={200} onChange={(e) => set('question', e.target.value)} aria-invalid={errors.question ? 'true' : undefined} aria-describedby={errors.question ? 'faq-q-err' : undefined} />
            <InlineError id="faq-q-err">{errors.question}</InlineError></div>
          <div className="field"><label htmlFor="faq-a">Answer *</label>
            <textarea id="faq-a" rows={5} value={form.answer} maxLength={1500} onChange={(e) => set('answer', e.target.value)} aria-invalid={errors.answer ? 'true' : undefined} aria-describedby={errors.answer ? 'faq-a-err' : undefined} />
            <InlineError id="faq-a-err">{errors.answer}</InlineError></div>
          <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} /><span>Show on the website</span></label>
        </form>
      </Dialog>

      <Dialog open={delOpen} onClose={() => !busy && setDelOpen(false)} title="Delete this question?" size="sm"
        footer={<><button type="button" className="btn" onClick={() => setDelOpen(false)} disabled={busy}>Keep it</button><button type="button" className="btn danger" onClick={confirmDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete question'}</button></>}>
        <p>“{toDelete?.question}” will be removed from your website. This can't be undone. To keep it but stop showing it, use Hide instead.</p>
      </Dialog>
    </section>
  );
}
