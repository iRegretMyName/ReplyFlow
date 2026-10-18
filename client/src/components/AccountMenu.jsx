import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';
import Icon from './ui/Icon.jsx';

const ROLE_LABEL = { admin: 'Administrator', staff: 'Staff' };
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function AccountMenu({ compact = false, placement = 'down' }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const signOutBtn = useRef(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return undefined;
    signOutBtn.current?.focus();
    const onPointer = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const signOut = async () => { setBusy(true); await logout(); };

  return (
    <div className={`account account-${placement}`} ref={wrap}>
      <button
        ref={button}
        type="button"
        className="account-btn"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={compact ? `Account menu for ${user.displayName}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">{initials(user.displayName)}</span>
        {!compact && (
          <>
            <span className="account-id">
              <span className="account-name">{user.displayName}</span>
              <span className="account-role">{ROLE_LABEL[user.role] || user.role}</span>
            </span>
            <Icon name="chevron" size={16} className="account-chevron" />
          </>
        )}
      </button>
      {open && (
        <div className="account-pop" id={popId}>
          <p className="account-pop-name">{user.displayName}</p>
          <p className="account-pop-meta">{user.username} · {ROLE_LABEL[user.role] || user.role}</p>
          <a className="btn block account-site" href="/" target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={16} /> View website
          </a>
          <button type="button" ref={signOutBtn} className="btn block" onClick={signOut} disabled={busy}>
            <Icon name="logout" size={16} /> {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
