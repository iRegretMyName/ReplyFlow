import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { InlineError, Spinner } from '../ui/States.jsx';

const PHONE = /^\+?[\d\s()-]{6,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY = { name: '', phone: '', email: '', course: '', message: '', company: '' };

// The same rules the server applies. The server is the one that decides; this gives instant feedback.
function check(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Please enter your name.';
  if (v.phone.trim() && !PHONE.test(v.phone.trim())) e.phone = 'Enter a valid phone number (digits, spaces, + ( ) or -).';
  if (v.email.trim() && !EMAIL.test(v.email.trim())) e.email = 'Enter a valid email address.';
  if (!v.phone.trim() && !v.email.trim()) e.phone = 'Please give a phone number or an email so we can reply.';
  if (v.message.trim().length < 5) e.message = 'Please write a short message (at least 5 characters).';
  return e;
}

export default function ContactForm({ courses, initialCourse, hasPrivacy, instituteName }) {
  const [v, setV] = useState({ ...EMPTY, course: courses.some((c) => c.slug === initialCourse) ? initialCourse : '' });
  const [touched, setTouched] = useState({});
  const [server, setServer] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [failure, setFailure] = useState('');
  const done = useRef(null);
  const form = useRef(null);

  useEffect(() => { if (state === 'sent') done.current?.focus(); }, [state]);

  // Client-side messages, plus any the server returned (an empty string means "cleared", so it must not hide a client message).
  const errors = { ...check(v), ...Object.fromEntries(Object.entries(server).filter(([, m]) => m)) };
  const show = (k) => (touched[k] || touched._all ? errors[k] : '');
  const set = (k, val) => { setV((p) => ({ ...p, [k]: val })); setServer((s) => ({ ...s, [k]: '' })); };
  const blur = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'sending') return;
    setTouched({ _all: true });
    const first = Object.keys(check(v))[0];
    if (first) { form.current?.querySelector(`[name="${first}"]`)?.focus(); return; }
    setState('sending'); setFailure('');
    try {
      await api.sendEnquiry({ ...v, name: v.name.trim() });
      setState('sent'); // only now: the server has confirmed it saved the enquiry
    } catch (err) {
      if (err.data?.fields) { setServer(err.data.fields); setState('idle'); form.current?.querySelector(`[name="${Object.keys(err.data.fields)[0]}"]`)?.focus(); }
      else { setFailure(err.message); setState('error'); }
    }
  };

  if (state === 'sent') {
    return (
      <div className="sent" role="status">
        <svg className="sent-check" viewBox="0 0 52 52" width="56" height="56" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="m15 27 8 8 15-17" /></svg>
        <h2 ref={done} tabIndex={-1} className="site-h3">Thank you, {v.name.trim().split(' ')[0]}.</h2>
        <p>We've received your enquiry and will get back to you using the details you gave.</p>
        <button type="button" className="btn" onClick={() => { setV(EMPTY); setTouched({}); setServer({}); setState('idle'); }}>Send another enquiry</button>
      </div>
    );
  }

  const sending = state === 'sending';
  const inputProps = (k) => ({
    id: `c-${k}`, name: k, value: v[k], readOnly: sending,
    onChange: (e) => set(k, e.target.value), onBlur: () => blur(k),
    'aria-invalid': show(k) ? 'true' : undefined, 'aria-describedby': show(k) ? `c-${k}-err` : undefined,
  });

  return (
    <form ref={form} className="contact-form" onSubmit={submit} noValidate>
      <p className="req-note"><span aria-hidden="true">*</span> Required</p>
      <div className="field"><label htmlFor="c-name">Your name <span aria-hidden="true">*</span></label><input {...inputProps('name')} autoComplete="name" maxLength={80} /><div className="err-slot"><InlineError id="c-name-err">{show('name')}</InlineError></div></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="c-phone">Phone</label><input {...inputProps('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={24} /><div className="err-slot"><InlineError id="c-phone-err">{show('phone')}</InlineError></div></div>
        <div className="field"><label htmlFor="c-email">Email</label><input {...inputProps('email')} type="email" inputMode="email" autoComplete="email" maxLength={120} /><div className="err-slot"><InlineError id="c-email-err">{show('email')}</InlineError></div></div>
      </div>
      <p className="hint form-hint">Give a phone number, an email, or both, so we can reply.</p>
      {courses.length > 0 && (
        <div className="field"><label htmlFor="c-course">Course (optional)</label>
          <select {...inputProps('course')} disabled={sending}><option value="">Not sure yet</option>{courses.map((c) => <option key={c.id} value={c.slug}>{c.name}{c.class ? ` (Class ${c.class})` : ''}</option>)}</select>
          <div className="err-slot"><InlineError id="c-course-err">{show('course')}</InlineError></div></div>
      )}
      <div className="field"><label htmlFor="c-message">Your message <span aria-hidden="true">*</span></label><textarea {...inputProps('message')} rows={5} maxLength={1000} />
        <span className="hint counter" aria-hidden="true">{v.message.length}/1000</span><div className="err-slot"><InlineError id="c-message-err">{show('message')}</InlineError></div></div>
      {/* A field real visitors never see or reach. If something fills it in, it is a bot. */}
      <div className="hp" aria-hidden="true"><label>Company<input name="company" tabIndex={-1} autoComplete="off" value={v.company} onChange={(e) => set('company', e.target.value)} /></label></div>

      {state === 'error' && (
        <div className="form-error" role="alert"><Icon name="alert" size={18} /><span>{failure} Your message is still here, so you can try again.</span></div>
      )}
      <button type="submit" className="btn primary block form-submit" disabled={sending} aria-busy={sending}>
        {sending ? <><Spinner /> Sending…</> : <>Send enquiry <Icon name="send" size={16} className="btn-arrow" /></>}
      </button>
      <p className="hint privacy-note">Your details go to the admissions team at {instituteName} so they can reply.{hasPrivacy && <> <Link to="/privacy" className="link">Privacy policy</Link></>}</p>
    </form>
  );
}
