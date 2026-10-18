// Institute details: the contact information shown on the public website.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from './ui/Icon.jsx';
import { ErrorState, InlineError, SkeletonRows, Spinner } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import WebsiteTabs from './WebsiteTabs.jsx';

const FIELDS = [
  ['name', 'Institute name', { required: true, span: 2 }],
  ['phone', 'Phone', { type: 'tel', hint: 'Shown as a "Call" button on the website.' }],
  ['whatsapp', 'WhatsApp number', { type: 'tel', hint: 'Shown as a "WhatsApp" link.' }],
  ['email', 'Email', { type: 'email', hint: 'Shown on the Contact page and in the footer.' }],
  ['address', 'Address', { span: 2, hint: 'Also used to make an "Open in Maps" link.' }],
  ['hours', 'Opening hours', { span: 2, hint: 'e.g. Mon–Sat, 9am–6pm' }],
  ['website', 'Website', { hint: 'Start with https://' }],
  ['instagram', 'Instagram', { hint: '@handle or a full https:// link' }],
  ['facebook', 'Facebook', { hint: 'Full https:// link to your page' }],
  ['youtube', 'YouTube', { hint: 'Full https:// link to your channel' }],
];

export default function Institute() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user.role === 'admin'; // the server enforces this too
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(() => {
    setError('');
    api.settings()
      .then((s) => { const inst = s.institute || {}; setForm(inst); setSaved(JSON.stringify(inst)); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const dirty = useMemo(() => form && JSON.stringify(form) !== saved, [form, saved]);
  const set = (key, value) => { setForm({ ...form, [key]: value }); setFieldErrors((f) => ({ ...f, [key]: '' })); };

  const save = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await api.saveSettings({ institute: form });
      setForm(updated.institute);
      setSaved(JSON.stringify(updated.institute));
      toast.success('Institute details saved. The website is updated.');
    } catch (e) {
      if (e.data?.fields) setFieldErrors(e.data.fields); else toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <WebsiteTabs current="w-institute" />
      <header className="page-head">
        <div>
          <h1>Institute</h1>
          <p className="page-sub">Contact details shown across your public website. Anything left blank is simply not shown.</p>
        </div>
        {canEdit && form && (
          <button type="button" className="btn primary" onClick={save} disabled={!dirty || saving}>
            {saving ? <><Spinner /> Saving…</> : dirty ? 'Save changes' : 'Saved'}
          </button>
        )}
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !form && <div className="panel"><SkeletonRows rows={6} /></div>}

      {form && (
        <>
          {!canEdit && (
            <div className="notice"><Icon name="info" size={18} /><p><strong>Only administrators can edit this page.</strong> You can see what the website currently shows.</p></div>
          )}
          <fieldset className="card" disabled={!canEdit}>
            <legend>Details</legend>
            <div className="form-grid">
              {FIELDS.map(([key, label, opts]) => (
                <div className={`field ${opts.span === 2 ? 'span-2' : ''}`} key={key}>
                  <label htmlFor={`inst-${key}`}>{label}{opts.required ? ' *' : ''}</label>
                  <input
                    id={`inst-${key}`}
                    type={opts.type || 'text'}
                    value={form[key] || ''}
                    aria-invalid={fieldErrors[key] ? 'true' : undefined}
                    aria-describedby={[opts.hint ? `inst-${key}-hint` : '', fieldErrors[key] ? `inst-${key}-err` : ''].filter(Boolean).join(' ') || undefined}
                    onChange={(e) => set(key, e.target.value)}
                  />
                  {opts.hint && <span className="hint" id={`inst-${key}-hint`}>{opts.hint}</span>}
                  <InlineError id={`inst-${key}-err`}>{fieldErrors[key]}</InlineError>
                </div>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </section>
  );
}
