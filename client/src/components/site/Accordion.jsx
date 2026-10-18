// Accessible accordion: real buttons with aria-expanded, regions labelled by their headings, arrow-key
// movement between headings, and a smooth height animation that needs no measuring.
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';

function Item({ id, title, open, onToggle, children }) {
  const panel = useRef(null);
  // Collapsed content must not be reachable by Tab or screen readers.
  useEffect(() => { if (panel.current) panel.current.inert = !open; }, [open]);
  return (
    <div className={`acc-item ${open ? 'open' : ''}`}>
      <h3>
        <button type="button" className="acc-btn" id={`${id}-b`} aria-expanded={open} aria-controls={`${id}-p`} onClick={onToggle}>
          <span>{title}</span>
          <span className="acc-icon" aria-hidden="true"><Icon name="plus" size={18} /></span>
        </button>
      </h3>
      <div className="acc-panel" id={`${id}-p`} role="region" aria-labelledby={`${id}-b`} ref={panel}>
        <div className="acc-inner"><div className="acc-body">{children}</div></div>
      </div>
    </div>
  );
}

export default function Accordion({ items, defaultOpen = null }) {
  const base = useId();
  const root = useRef(null);
  const [open, setOpen] = useState(() => new Set(defaultOpen ? [defaultOpen] : []));
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const onKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const btns = [...root.current.querySelectorAll('.acc-btn')];
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
    btns[next].focus();
  };

  return (
    <div className="accordion" ref={root} onKeyDown={onKeyDown}>
      {items.map((it) => (
        <Item key={it.id} id={`${base}-${it.id}`} title={it.title} open={open.has(it.id)} onToggle={() => toggle(it.id)}>{it.content}</Item>
      ))}
    </div>
  );
}
