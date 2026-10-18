import { useEffect, useRef, useState } from 'react';
import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { Mark } from '../ui/Wordmark.jsx';
import { instagramHref, mailHref, telHref, webHref, whatsappHref } from './format.js';

const hoverCapable = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

function NavLink({ to, active, children, ...rest }) {
  return <Link to={to} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} {...rest}>{children}</Link>;
}

// "Courses" is a link; the small arrow beside it opens a menu of every published course.
function CoursesMenu({ courses, active }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="nav-dd" ref={wrap} onMouseEnter={() => hoverCapable() && setOpen(true)} onMouseLeave={() => hoverCapable() && setOpen(false)}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget)) setOpen(false); }}>
      <NavLink to="/courses" active={active}>Courses</NavLink>
      {courses.length > 0 && (
        <button ref={btn} type="button" className={`nav-dd-btn ${open ? 'open' : ''}`} aria-expanded={open} aria-controls="courses-menu" aria-label="Courses menu" onClick={() => setOpen((o) => (hoverCapable() ? true : !o))}>
          <Icon name="chevron" size={15} />
        </button>
      )}
      <ul id="courses-menu" className={`nav-dd-panel ${open ? 'open' : ''}`}>
        {courses.map((c) => (
          <li key={c.id}><Link to={`/courses/${c.slug}`} onClick={() => setOpen(false)}><span>{c.name}</span>{c.class && <small>Class {c.class}</small>}</Link></li>
        ))}
        <li className="nav-dd-all"><Link to="/courses" onClick={() => setOpen(false)}>All courses <Icon name="arrow" size={14} /></Link></li>
      </ul>
    </div>
  );
}

function Header({ site, route }) {
  const [menu, setMenu] = useState(false);
  const [stuck, setStuck] = useState(false);
  const panel = useRef(null);
  const menuBtn = useRef(null);
  const inst = site.data?.institute;
  const courses = site.data?.courses || [];
  const name = inst?.name || '';
  const r = route.name;

  useEffect(() => { setMenu(false); }, [route.pathname]);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (panel.current) panel.current.inert = !menu;
    document.documentElement.classList.toggle('menu-open', menu);
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setMenu(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.classList.remove('menu-open'); };
  }, [menu]);

  const links = [['/', 'Home', r === 'home'], ['/courses', 'Courses', r === 'courses' || r === 'course'], ['/about', 'About', r === 'about'], ['/faq', 'FAQ', r === 'faq'], ['/contact', 'Contact', r === 'contact']];
  const call = telHref(inst?.phone);

  return (
    <header className={`site-header ${stuck ? 'stuck' : ''}`}>
      <div className="site-wrap site-header-row">
        <Link to="/" className="site-brand" aria-label={name ? `${name}, home` : 'Home'}>
          <Mark size={26} />
          {name ? <span>{name}</span> : <span className="skeleton skeleton-brand" aria-hidden="true" />}
        </Link>
        <nav className="site-nav" aria-label="Main">
          <NavLink to="/" active={r === 'home'}>Home</NavLink>
          <CoursesMenu courses={courses} active={r === 'courses' || r === 'course'} />
          <NavLink to="/about" active={r === 'about'}>About</NavLink>
          <NavLink to="/faq" active={r === 'faq'}>FAQ</NavLink>
          <NavLink to="/contact" active={r === 'contact'}>Contact</NavLink>
        </nav>
        <Link to="/contact" className="btn primary small site-cta">Enquire now <Icon name="arrow" size={15} className="btn-arrow" /></Link>
        <button ref={menuBtn} type="button" className={`menu-btn ${menu ? 'open' : ''}`} aria-expanded={menu} aria-controls="mobile-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu((m) => !m)}>
          <span className="bars" aria-hidden="true"><i /><i /><i /></span>
        </button>
      </div>
      <div id="mobile-menu" ref={panel} className={`mobile-menu ${menu ? 'open' : ''}`}>
        <nav aria-label="Mobile">
          <ul>
            {links.map(([to, label, active], i) => (
              <li key={to} style={{ '--i': i }}><Link to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="mobile-menu-actions">
          <Link to="/contact" className="btn primary block">Enquire now</Link>
          {call && <a className="btn block" href={call}><Icon name="phone" size={16} /> Call {inst.phone}</a>}
        </div>
      </div>
    </header>
  );
}

function Announcement({ item }) {
  if (!item) return null;
  const external = /^https?:\/\//i.test(item.href);
  return (
    <div className="announce">
      <div className="site-wrap">
        <span>{item.text}</span>
        {item.href && (external
          ? <a href={webHref(item.href) || undefined} target="_blank" rel="noopener noreferrer">Learn more <Icon name="arrow" size={14} /></a>
          : <Link to={item.href}>Learn more <Icon name="arrow" size={14} /></Link>)}
      </div>
    </div>
  );
}

function Footer({ site }) {
  const d = site.data;
  const i = d?.institute || {};
  const social = [['Instagram', 'instagram', instagramHref(i.instagram)], ['Facebook', 'facebook', webHref(i.facebook)], ['YouTube', 'youtube', webHref(i.youtube)]].filter((s) => s[2]);
  return (
    <footer className="site-footer">
      <div className="site-wrap footer-grid">
        <div className="footer-brand">
          <Link to="/" className="site-brand"><Mark size={24} /><span>{i.name}</span></Link>
          {i.address && <p>{i.address}</p>}
          {social.length > 0 && (
            <ul className="social">
              {social.map(([label, icon, href]) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${i.name} on ${label}`}><Icon name={icon} size={20} /></a></li>
              ))}
            </ul>
          )}
        </div>
        <nav aria-label="Explore">
          <h2 className="footer-h">Explore</h2>
          <ul>
            {[['/', 'Home'], ['/courses', 'Courses'], ['/about', 'About us'], ['/faq', 'FAQ'], ['/contact', 'Contact']].map(([to, l]) => <li key={to}><Link to={to} className="link-anim">{l}</Link></li>)}
          </ul>
        </nav>
        {d?.courses.length > 0 && (
          <nav aria-label="Courses">
            <h2 className="footer-h">Courses</h2>
            <ul>{d.courses.slice(0, 6).map((c) => <li key={c.id}><Link to={`/courses/${c.slug}`} className="link-anim">{c.name}</Link></li>)}</ul>
          </nav>
        )}
        <div>
          <h2 className="footer-h">Get in touch</h2>
          <ul>
            {telHref(i.phone) && <li><a className="link-anim" href={telHref(i.phone)}>{i.phone}</a></li>}
            {whatsappHref(i.whatsapp) && <li><a className="link-anim" href={whatsappHref(i.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
            {mailHref(i.email) && <li><a className="link-anim" href={mailHref(i.email)}>{i.email}</a></li>}
            {i.hours && <li className="footer-hours">{i.hours}</li>}
          </ul>
        </div>
      </div>
      <div className="site-wrap footer-base">
        <p>© {new Date().getFullYear()} {i.name}</p>
        <ul className="footer-legal">
          {d?.pages.hasPrivacy && <li><Link to="/privacy" className="link-anim">Privacy</Link></li>}
          {d?.pages.hasTerms && <li><Link to="/terms" className="link-anim">Terms</Link></li>}
          <li><Link to="/staff/login" className="staff-link">Staff Login</Link></li>
        </ul>
      </div>
    </footer>
  );
}

export default function SiteLayout({ site, route, mainRef, children }) {
  return (
    <div className="site">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <Announcement item={site.data?.pages.announcement} />
      <Header site={site} route={route} />
      <main id="main" tabIndex={-1} ref={mainRef} className="site-main">{children}</main>
      <Footer site={site} />
    </div>
  );
}
