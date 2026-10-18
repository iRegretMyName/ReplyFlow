import { Link } from '../../router.jsx';
import { usePageMeta } from './useSite.js';

export default function NotFound() {
  usePageMeta('Page not found');
  return (
    <section className="page-top notfound">
      <div className="site-wrap">
        <p className="nf-code" aria-hidden="true">4<span className="nf-bubble" />4</p>
        <h1 className="detail-title">We can't find that page</h1>
        <p className="page-top-sub">The address may be mistyped, or the page may have moved.</p>
        <div className="hero-actions">
          <Link to="/" className="btn primary">Go to the homepage</Link>
          <Link to="/courses" className="btn">Browse courses</Link>
          <Link to="/contact" className="btn">Contact us</Link>
        </div>
      </div>
    </section>
  );
}
