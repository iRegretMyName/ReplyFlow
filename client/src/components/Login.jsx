import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Link, navigate, safeNext, useRoute } from '../router.jsx';
import Icon from './ui/Icon.jsx';
import Wordmark from './ui/Wordmark.jsx';
import { InlineError, Spinner } from './ui/States.jsx';
import OmrArt from './OmrArt.jsx';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Login() {
  const { login, commit, notice } = useAuth();
  const route = useRoute();
  const next = safeNext(route.query.get('next'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | busy | done
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const userRef = useRef(null);
  const passRef = useRef(null);

  useEffect(() => { document.title = 'Sign in · ReplyFlow'; }, []);
  // Focus the first field on desktop. On phones that would throw the keyboard up before anyone has read the page.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) userRef.current?.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (phase !== 'idle') return;

    const errors = {};
    if (!username.trim()) errors.username = 'Enter your username.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    setFormError('');
    if (errors.username) { userRef.current?.focus(); return; }
    if (errors.password) { passRef.current?.focus(); return; }

    setPhase('busy');
    try {
      const user = await login(username.trim(), password);
      setPhase('done');
      setTimeout(() => { commit(user); navigate(next, { replace: true }); }, reducedMotion() ? 0 : 420);
    } catch (err) {
      setPhase('idle');
      setFormError(err.message);
      if (err.status === 401) { setPassword(''); passRef.current?.focus(); }
    }
  };

  const busy = phase !== 'idle';

  return (
    <div className="login">
      <aside className="login-art">
        <OmrArt />
        <div className="login-art-copy">
          <Wordmark size="lg" />
          <p className="login-lede">Every enquiry answered. Every reply approved by a person first.</p>
        </div>
      </aside>

      <main className="login-panel" id="main">
        <div className="login-card">
          <p className="login-private"><Icon name="lock" size={15} /> Private staff portal</p>
          <h1>Sign in</h1>
          <p className="login-intro">
            The admissions desk for your team: review AI-drafted replies, keep every enquiry moving and never miss a follow-up.
          </p>

          {notice && <p className="login-notice" role="status">{notice}</p>}

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                ref={userRef}
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                value={username}
                readOnly={busy}
                aria-invalid={fieldErrors.username ? 'true' : undefined}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                onChange={(e) => { setUsername(e.target.value); if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: '' })); }}
              />
              <InlineError id="username-error">{fieldErrors.username}</InlineError>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  id="password"
                  ref={passRef}
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={password}
                  readOnly={busy}
                  aria-invalid={fieldErrors.password ? 'true' : undefined}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' })); }}
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShow((s) => !s)}
                  aria-label="Show password"
                  aria-pressed={show}
                >
                  <Icon name={show ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
              <InlineError id="password-error">{fieldErrors.password}</InlineError>
            </div>

            {formError && (
              <div className="form-error" role="alert">
                <Icon name="alert" size={18} />
                <span>{formError}</span>
              </div>
            )}

            <button type="submit" className={`btn primary block login-submit ${phase}`} aria-disabled={busy}>
              {phase === 'idle' && 'Sign in'}
              {phase === 'busy' && (<><Spinner /> Signing in…</>)}
              {phase === 'done' && (<><Icon name="check" size={18} /> Signed in</>)}
            </button>
            <span className="sr-only" role="status">{phase === 'busy' ? 'Signing in' : phase === 'done' ? 'Signed in' : ''}</span>
          </form>

          <p className="login-help">
            Don't have credentials? Ask your administrator. Staff accounts are issued by them and can't be created on this page.
          </p>
          <Link to="/" className="login-back"><Icon name="back" size={15} /> Back to the website</Link>
        </div>
      </main>
    </div>
  );
}
