// Editable page content: announcement banner, homepage text and image, the About page, privacy policy and terms.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from './ui/Icon.jsx';
import ImageField from './ui/ImageField.jsx';
import { ErrorState, InlineError, SkeletonRows, Spinner } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import WebsiteTabs from './WebsiteTabs.jsx';

export default function SitePages() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user.role === 'admin';
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.pages().then((p) => { setForm(p); setSaved(JSON.stringify(p)); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const dirty = useMemo(() => form && JSON.stringify(form) !== saved, [form, saved]);

  const setIn = (section, key, value) => { setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } })); setErrors((e) => ({ ...e, [`${section}.${key}`]: '' })); };
  const setTop = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setErrors((e) => ({ ...e, [key]: '' })); };
  const setValue = (i, key, v) => setForm((f) => ({ ...f, about: { ...f.about, values: f.about.values.map((x, j) => (j === i ? { ...x, [key]: v } : x)) } }));

  const save = async () => {
    setSaving(true); setErrors({});
    try { const p = await api.savePages(form); setForm(p); setSaved(JSON.stringify(p)); toast.success('Saved. Your website is updated.'); }
    catch (e) { if (e.data?.fields) { setErrors(e.data.fields); toast.error('Some fields need attention.'); } else toast.error(e.message); }
    finally { setSaving(false); }
  };

  const field = (id, label, value, onChange, { errKey, rows, hint, max, placeholder } = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {rows
        ? <textarea id={id} rows={rows} value={value} maxLength={max} onChange={onChange} aria-invalid={errors[errKey] ? 'true' : undefined} aria-describedby={errors[errKey] ? `${id}-err` : undefined} />
        : <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={onChange} aria-invalid={errors[errKey] ? 'true' : undefined} aria-describedby={errors[errKey] ? `${id}-err` : undefined} />}
      {hint && <span className="hint">{hint}</span>}
      <InlineError id={`${id}-err`}>{errors[errKey]}</InlineError>
    </div>
  );

  return (
    <section>
      <WebsiteTabs current="w-pages" />
      <header className="page-head">
        <div>
          <h1>Pages</h1>
          <p className="page-sub">Text and images for your homepage, About page and legal pages. Anything left blank is simply not shown, or filled in from your records.</p>
        </div>
        {canEdit && form && <button type="button" className="btn primary" onClick={save} disabled={!dirty || saving}>{saving ? <><Spinner /> Saving…</> : dirty ? 'Save changes' : 'Saved'}</button>}
      </header>
      {!canEdit && form && <div className="notice"><Icon name="info" size={18} /><p><strong>Only administrators can edit page content.</strong></p></div>}
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !form && <div className="panel"><SkeletonRows rows={6} /></div>}

      {form && (
        <>
          <fieldset className="card" disabled={!canEdit}>
            <legend>Announcement banner <span className="legend-sub">A single line across the top of every page</span></legend>
            <label className="check"><input type="checkbox" checked={form.announcement.enabled} onChange={(e) => setIn('announcement', 'enabled', e.target.checked)} /><span>Show the banner</span></label>
            <div className="form-grid">
              {field('ann-text', 'Text', form.announcement.text, (e) => setIn('announcement', 'text', e.target.value), { errKey: 'announcement.text', max: 200, placeholder: 'e.g. Admissions are open' })}
              {field('ann-href', 'Link (optional)', form.announcement.href, (e) => setIn('announcement', 'href', e.target.value), { errKey: 'announcement.href', max: 200, hint: 'A page on this site like /contact, or a full https:// link.' })}
            </div>
          </fieldset>

          <fieldset className="card" disabled={!canEdit}>
            <legend>Homepage <span className="legend-sub"><a className="link" href="/" target="_blank" rel="noopener noreferrer">View</a></span></legend>
            <div className="form-grid">
              {field('home-h', 'Headline', form.home.headline, (e) => setIn('home', 'headline', e.target.value), { errKey: 'home.headline', max: 100, hint: 'Leave blank to use your institute name.' })}
              {field('home-s', 'Subtitle', form.home.subtitle, (e) => setIn('home', 'subtitle', e.target.value), { errKey: 'home.subtitle', max: 200, hint: 'Leave blank to list your courses automatically.' })}
            </div>
            <ImageField label="Hero photo" value={form.home.heroImage} onChange={(v) => setIn('home', 'heroImage', v)} error={errors['home.heroImage']} hint="Use a photo you own the rights to. Without one, the homepage shows its answer-sheet artwork." />
          </fieldset>

          <fieldset className="card" disabled={!canEdit}>
            <legend>About page <span className="legend-sub"><a className="link" href="/about" target="_blank" rel="noopener noreferrer">View</a></span></legend>
            {field('about-h', 'Headline', form.about.headline, (e) => setIn('about', 'headline', e.target.value), { errKey: 'about.headline', max: 120, hint: 'Leave blank to use “About {your name}”.' })}
            {field('about-story', 'Your story', form.about.story, (e) => setIn('about', 'story', e.target.value), { errKey: 'about.story', rows: 7, max: 3000, hint: 'Separate paragraphs with a blank line. Only write what is true: this appears as written.' })}
            <ImageField label="About photo" value={form.about.image} onChange={(v) => setIn('about', 'image', v)} error={errors['about.image']} />
            <p className="form-section">Values <span className="muted">Up to 6 short points about how you work</span></p>
            {form.about.values.map((v, i) => (
              <div className="value-row" key={i}>
                <div className="field"><label htmlFor={`val-t-${i}`}>Title</label><input id={`val-t-${i}`} value={v.title} maxLength={60} onChange={(e) => setValue(i, 'title', e.target.value)} /></div>
                <div className="field"><label htmlFor={`val-x-${i}`}>Description</label><input id={`val-x-${i}`} value={v.text} maxLength={300} onChange={(e) => setValue(i, 'text', e.target.value)} /></div>
                <button type="button" className="icon-btn danger" onClick={() => setForm((f) => ({ ...f, about: { ...f.about, values: f.about.values.filter((_, j) => j !== i) } }))} aria-label={`Remove value ${i + 1}`}><Icon name="trash" size={17} /></button>
              </div>
            ))}
            <InlineError id="about-values-err">{errors['about.values']}</InlineError>
            {canEdit && form.about.values.length < 6 && <button type="button" className="btn small" onClick={() => setForm((f) => ({ ...f, about: { ...f.about, values: [...f.about.values, { title: '', text: '' }] } }))}><Icon name="plus" size={15} /> Add a value</button>}
          </fieldset>

          <fieldset className="card" disabled={!canEdit}>
            <legend>Privacy policy and terms</legend>
            <div className="notice"><Icon name="info" size={18} /><p>ReplyFlow doesn't write legal text for you. Paste your own policy (ideally checked by someone qualified). A page, and its footer link, only appear once you've written it.</p></div>
            {field('legal-privacy', 'Privacy policy', form.privacy, (e) => setTop('privacy', e.target.value), { errKey: 'privacy', rows: 8, max: 20000 })}
            {field('legal-terms', 'Terms and conditions', form.terms, (e) => setTop('terms', e.target.value), { errKey: 'terms', rows: 8, max: 20000 })}
          </fieldset>
        </>
      )}
    </section>
  );
}
