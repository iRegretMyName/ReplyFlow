// Choose and upload an image. The file is checked here for a quick message, and checked again on the
// server by its actual contents, which is the check that counts.
import { useId, useRef, useState } from 'react';
import { api } from '../../api.js';
import Icon from './Icon.jsx';
import { Spinner } from './States.jsx';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 2 * 1024 * 1024;

export default function ImageField({ label, value, onChange, disabled, error, hint }) {
  const id = useId();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem('');
    if (!TYPES.includes(file.type)) { setProblem('Please choose a JPEG, PNG or WebP image.'); return; }
    if (file.size > MAX) { setProblem('That image is over 2 MB. Please choose a smaller one.'); return; }
    setBusy(true);
    try { onChange((await api.uploadImage(file)).name); } catch (err) { setProblem(err.message); } finally { setBusy(false); }
  };

  const shown = problem || error;
  return (
    <div className="field image-field">
      <span className="label-like" id={`${id}-l`}>{label}</span>
      <div className="image-row">
        <div className="image-preview" aria-hidden="true">
          {value ? <img src={`/uploads/${value}`} alt="" /> : <Icon name="image" size={26} />}
        </div>
        <div className="image-actions">
          <input ref={input} id={id} type="file" accept={TYPES.join(',')} className="sr-only" onChange={pick} disabled={disabled || busy} aria-describedby={`${id}-h`} />
          <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={disabled || busy} aria-labelledby={`${id}-l ${id}-b`}>
            {busy ? <><Spinner /> Uploading…</> : <span id={`${id}-b`}>{value ? 'Change image' : 'Choose image'}</span>}
          </button>
          {value && !busy && <button type="button" className="btn small ghost" onClick={() => onChange('')} disabled={disabled}>Remove</button>}
          <span className="hint" id={`${id}-h`}>{hint || 'JPEG, PNG or WebP, up to 2 MB.'}</span>
        </div>
      </div>
      {shown && <p className="field-error" role="alert"><Icon name="alert" size={15} /><span>{shown}</span></p>}
    </div>
  );
}
