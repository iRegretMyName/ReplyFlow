// The signed-in application frame: navigation, account menu and the page area.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Link, navigate, useRoute } from '../router.jsx';
import AccountMenu from './AccountMenu.jsx';
import Icon from './ui/Icon.jsx';
import Wordmark from './ui/Wordmark.jsx';
import Dashboard from './Dashboard.jsx';
import LeadList from './LeadList.jsx';
import LeadDetail from './LeadDetail.jsx';
import FollowUps from './FollowUps.jsx';
import Institute from './Settings.jsx';
import Courses from './Courses.jsx';
import Faqs from './Faqs.jsx';
import SitePages from './SitePages.jsx';
import Enquiries from './Enquiries.jsx';
import { EmptyState } from './ui/States.jsx';

const NAV = [
  { id: 'dashboard', to: '/admin', label: 'Today', icon: 'today' },
  { id: 'leads', to: '/admin/leads', label: 'Leads', icon: 'leads' },
  { id: 'followups', to: '/admin/followups', label: 'Follow-ups', icon: 'clock' },
  { id: 'enquiries', to: '/admin/enquiries', label: 'Enquiries', icon: 'inbox' },
  { id: 'website', to: '/admin/website/courses', label: 'Website', icon: 'globe' },
];

const TITLES = { dashboard: 'Today', leads: 'Leads', lead: 'Lead', followups: 'Follow-ups', enquiries: 'Enquiries', website: 'Website', 'w-courses': 'Courses', 'w-faqs': 'FAQs', 'w-pages': 'Pages', 'w-institute': 'Institute', notfound: 'Page not found' };
// Old addresses from before the Website section existed.
const MOVED = { '/admin/courses': '/admin/website/courses', '/admin/institute': '/admin/website/institute' };

// Follow-ups due by the end of today (including overdue): the same definition as the Today page.
function useDueCount() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    api.followups()
      .then((items) => {
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        setCount(items.filter((f) => f.status === 'pending' && new Date(f.scheduledFor) <= endOfDay).length);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener('replyflow:followups-changed', refresh);
    const timer = setInterval(refresh, 5 * 60_000);
    return () => { window.removeEventListener('replyflow:followups-changed', refresh); clearInterval(timer); };
  }, [refresh]);
  return count;
}

// Number of website enquiries nobody has looked at yet.
function useNewEnquiries(routeKey) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => { api.enquiryCounts().then((c) => setCount(c.new)).catch(() => {}); }, []);
  useEffect(() => { refresh(); }, [refresh, routeKey]); // also whenever the staff member moves to another screen
  useEffect(() => {
    window.addEventListener('replyflow:enquiries-changed', refresh);
    const timer = setInterval(refresh, 2 * 60_000);
    return () => { window.removeEventListener('replyflow:enquiries-changed', refresh); clearInterval(timer); };
  }, [refresh]);
  return count;
}

function NavItem({ item, active, due, newEnq, variant }) {
  const count = item.id === 'followups' ? due : item.id === 'enquiries' ? newEnq : 0;
  const showBadge = count > 0;
  return (
    <li>
      <Link to={item.to} className={`${variant} ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
        <Icon name={item.icon} size={variant === 'tab' ? 22 : 18} />
        <span className={variant === 'tab' ? 'tab-label' : 'nav-label'}>{item.label}</span>
        {showBadge && (
          <span className="badge" aria-label={item.id === 'enquiries' ? `${count} new` : `${count} due today or overdue`}>{count}</span>
        )}
      </Link>
    </li>
  );
}

function Page({ route }) {
  switch (route.name) {
    case 'dashboard': return <Dashboard />;
    case 'leads': return <LeadList query={route.query} />;
    case 'lead': return <LeadDetail leadId={route.params.id} />;
    case 'followups': return <FollowUps />;
    case 'enquiries': return <Enquiries />;
    case 'w-courses': return <Courses />;
    case 'w-faqs': return <Faqs />;
    case 'w-pages': return <SitePages />;
    case 'w-institute': return <Institute />;
    default:
      return (
        <section>
          <header className="page-head"><h1>Page not found</h1></header>
          <div className="panel">
            <EmptyState icon="search" title="There's nothing at this address.">
              <Link to="/admin" className="link">Go to Today</Link>
            </EmptyState>
          </div>
        </section>
      );
  }
}

export default function Shell() {
  const route = useRoute();
  const due = useDueCount();
  const newEnq = useNewEnquiries(route.pathname);
  const main = useRef(null);
  const first = useRef(true);
  const [announce, setAnnounce] = useState('');

  // Tell screen-reader users the screen changed, and keep the tab title in step.
  useEffect(() => {
    const title = TITLES[route.name] || 'ReplyFlow';
    if (route.name !== 'lead') document.title = `${title} · ReplyFlow`;
    if (first.current) { first.current = false; return; }
    setAnnounce(`${title} page`);
  }, [route.name]);

  const activeId = route.name === 'lead' ? 'leads' : route.name.startsWith('w-') ? 'website' : route.name;

  // Send old addresses and the bare /admin/website to their new home.
  useEffect(() => {
    const to = MOVED[route.pathname.replace(/\/$/, '')] || (route.name === 'website' ? '/admin/website/courses' : null);
    if (to) navigate(to, { replace: true });
  }, [route.pathname, route.name]);

  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => { e.preventDefault(); main.current?.focus(); }}
      >
        Skip to content
      </a>

      <aside className="rail">
        <Link to="/admin" className="rail-brand" aria-label="ReplyFlow, go to Today"><Wordmark /></Link>
        <nav className="rail-nav" aria-label="Main">
          <ul>{NAV.map((item) => <NavItem key={item.id} item={item} active={activeId === item.id} due={due} newEnq={newEnq} variant="nav-item" />)}</ul>
        </nav>
        <div className="rail-foot"><AccountMenu placement="up" /></div>
      </aside>

      <header className="topbar">
        <Link to="/admin" className="rail-brand" aria-label="ReplyFlow, go to Today"><Wordmark /></Link>
        <AccountMenu compact placement="down" />
      </header>

      <main id="main" ref={main} tabIndex={-1} className="stage">
        <div className="page" key={route.name === 'lead' ? `lead-${route.params.id}` : route.name}>
          <Page route={route} />
        </div>
      </main>

      <nav className="tabbar" aria-label="Main">
        <ul>{NAV.map((item) => <NavItem key={item.id} item={item} active={activeId === item.id} due={due} newEnq={newEnq} variant="tab" />)}</ul>
      </nav>

      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
}
