import { Link } from '../router.jsx';

const TABS = [
  ['w-courses', '/admin/website/courses', 'Courses'],
  ['w-faqs', '/admin/website/faqs', 'FAQs'],
  ['w-pages', '/admin/website/pages', 'Pages'],
  ['w-institute', '/admin/website/institute', 'Institute'],
];

// The sections of the public website that staff manage.
export default function WebsiteTabs({ current }) {
  return (
    <nav className="subtabs" aria-label="Website sections">
      {TABS.map(([id, to, label]) => (
        <Link key={id} to={to} className={id === current ? 'active' : ''} aria-current={id === current ? 'page' : undefined}>{label}</Link>
      ))}
      <a className="subtabs-view" href="/" target="_blank" rel="noopener noreferrer">View website ↗</a>
    </nav>
  );
}
