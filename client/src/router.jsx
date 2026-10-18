// A tiny History-API router, so every screen has a real URL (refresh, back button,
// bookmarks and links all work) without adding a dependency.
//
// Three areas:
//   public  /, /courses, /courses/:id   the customer website (no sign-in, ever)
//   login   /staff/login                staff sign-in
//   admin   /admin/...                  the management panel (needs a session)
import { useSyncExternalStore } from 'react';

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => window.location.pathname + window.location.search; // hash is not part of the route

export function navigate(to, { replace = false } = {}) {
  if (to === snapshot() && !to.includes('#')) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
  emit();
  // After the new page renders: jump to its #section if it has one, otherwise to the top.
  requestAnimationFrame(() => {
    const id = window.location.hash.slice(1);
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
  });
}

const ROUTES = [
  ['home', 'public', /^\/$/],
  ['courses', 'public', /^\/courses\/?$/],
  ['course', 'public', /^\/courses\/([^/]+)\/?$/],
  ['about', 'public', /^\/about\/?$/],
  ['contact', 'public', /^\/contact\/?$/],
  ['faq', 'public', /^\/faq\/?$/],
  ['privacy', 'public', /^\/privacy\/?$/],
  ['terms', 'public', /^\/terms\/?$/],
  ['login', 'login', /^\/staff\/login\/?$/],
  ['dashboard', 'admin', /^\/admin\/?$/],
  ['leads', 'admin', /^\/admin\/leads\/?$/],
  ['lead', 'admin', /^\/admin\/leads\/([^/]+)\/?$/],
  ['followups', 'admin', /^\/admin\/followups\/?$/],
  ['enquiries', 'admin', /^\/admin\/enquiries\/?$/],
  ['website', 'admin', /^\/admin\/website\/?$/],
  ['w-courses', 'admin', /^\/admin\/website\/courses\/?$/],
  ['w-faqs', 'admin', /^\/admin\/website\/faqs\/?$/],
  ['w-pages', 'admin', /^\/admin\/website\/pages\/?$/],
  ['w-institute', 'admin', /^\/admin\/website\/institute\/?$/],
];

export function useRoute() {
  const full = useSyncExternalStore(subscribe, snapshot);
  const [pathname, search = ''] = full.split('?');
  const base = { pathname, search: search ? `?${search}` : '', query: new URLSearchParams(search) };
  for (const [name, area, re] of ROUTES) {
    const m = re.exec(pathname);
    if (m) return { ...base, name, area, params: { id: m[1] ? decodeURIComponent(m[1]) : undefined } };
  }
  const area = pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/staff') ? 'login' : 'public';
  return { ...base, name: 'notfound', area, params: {} };
}

export function Link({ to, onClick, children, ...rest }) {
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest}>{children}</a>;
}

// Only ever follow a "?next=" that points inside the admin panel, so the sign-in page
// can't be used to bounce someone to another site.
export function safeNext(value) {
  return typeof value === 'string' && /^\/admin(\/[\w\-./?=&%]*)?$/.test(value) && !value.includes('//') ? value : '/admin';
}
