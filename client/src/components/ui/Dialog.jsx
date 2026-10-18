// Modal dialog on the browser's native <dialog>: focus is trapped inside, Escape closes
// it, the page behind is inert, and focus returns to what opened it. We add the exit
// animation and click-outside-to-close.
import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Dialog({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (open && !el.open) {
      el.removeAttribute('data-closing');
      el.showModal();
    }
    if (!open && el.open) {
      if (reducedMotion()) { el.close(); return undefined; }
      el.setAttribute('data-closing', '');
      const t = setTimeout(() => { el.removeAttribute('data-closing'); el.close(); }, 140);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { pressedOnBackdrop.current = e.target === ref.current; }}
      onClick={(e) => { if (e.target === ref.current && pressedOnBackdrop.current) onClose(); }}
    >
      <div className="dialog-inner">
        <header className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
