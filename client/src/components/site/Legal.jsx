import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Link } from '../../router.jsx';
import { SkeletonRows } from '../ui/States.jsx';
import { paragraphs } from './faqs.js';
import { usePageMeta } from './useSite.js';

const TITLE = { privacy: 'Privacy policy', terms: 'Terms and conditions' };

// Shows the policy text exactly as the administrator wrote it. No legal text ships with the product.
export default function Legal({ name, site }) {
  const [state, setState] = useState({ status: 'loading', text: '' });
  useEffect(() => {
    setState({ status: 'loading', text: '' });
    api.publicLegal(name).then((r) => setState({ status: 'ready', text: r.text })).catch((e) => setState({ status: e.status === 404 ? 'missing' : 'error', text: '' }));
  }, [name]);
  const inst = site.data?.institute;
  usePageMeta(inst ? `${TITLE[name]} · ${inst.name}` : TITLE[name], '', inst?.name);
  return (
    <section className="page-top">
      <div className="site-wrap legal">
        <h1 className="detail-title">{TITLE[name]}</h1>
        {state.status === 'loading' && <SkeletonRows rows={4} />}
        {state.status === 'ready' && paragraphs(state.text).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-line' }}>{p}</p>)}
        {state.status === 'missing' && <p>This page hasn't been published yet. <Link to="/contact" className="link">Contact us</Link> if you have questions.</p>}
        {state.status === 'error' && <p>We couldn't load this page. Please try again.</p>}
      </div>
    </section>
  );
}
