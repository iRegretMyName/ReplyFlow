import { ErrorState, SkeletonRows } from '../ui/States.jsx';
import Accordion from './Accordion.jsx';
import CtaBand from './CtaBand.jsx';
import { buildFaqs } from './faqs.js';
import { usePageMeta } from './useSite.js';

export default function FaqPage({ site }) {
  const { status, data, error, reload } = site;
  usePageMeta(data ? `FAQ · ${data.institute.name}` : 'FAQ', data ? `Frequently asked questions about ${data.institute.name}` : '', data?.institute.name);
  if (status === 'error') return <div className="site-wrap site-section"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return <div className="site-wrap site-section"><div className="panel"><SkeletonRows rows={5} /></div></div>;
  const faqs = buildFaqs(data);
  return (
    <>
      <section className="page-top">
        <div className="site-wrap faq-page">
          <p className="eyebrow">FAQ</p>
          <h1 className="detail-title">Frequently asked questions</h1>
          <p className="page-top-sub">If you can't find what you need, send us an enquiry and we'll help.</p>
          <Accordion items={faqs.map((f) => ({ id: f.id, title: f.question, content: f.answer.split('\n').map((l, i) => <p key={i}>{l}</p>) }))} defaultOpen={faqs[0]?.id} />
        </div>
      </section>
      <CtaBand institute={data.institute} title="Still have a question?" />
    </>
  );
}
