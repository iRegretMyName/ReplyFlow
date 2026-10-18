import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows } from '../ui/States.jsx';
import ContactForm from './ContactForm.jsx';
import { Reveal } from './motion.jsx';
import { instagramHref, mailHref, mapsHref, telHref, webHref, whatsappHref } from './format.js';
import { usePageMeta } from './useSite.js';

export default function Contact({ site, route }) {
  const { status, data, error, reload } = site;
  const i = data?.institute;
  usePageMeta(i ? `Contact · ${i.name}` : 'Contact', i ? `Contact ${i.name}: call, WhatsApp or send an enquiry.` : '', i?.name);
  if (status === 'error') return <div className="site-wrap site-section"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return <div className="site-wrap site-section"><div className="panel"><SkeletonRows rows={5} /></div></div>;

  const rows = [
    i.address && { icon: 'pin', label: 'Visit us', body: <><span>{i.address}</span><a className="link-anim" href={mapsHref(i.address)} target="_blank" rel="noopener noreferrer">Open in Maps</a></> },
    telHref(i.phone) && { icon: 'phone', label: 'Call', body: <a className="link-anim" href={telHref(i.phone)}>{i.phone}</a> },
    whatsappHref(i.whatsapp) && { icon: 'chat', label: 'WhatsApp', body: <a className="link-anim" href={whatsappHref(i.whatsapp)} target="_blank" rel="noopener noreferrer">{i.whatsapp}</a> },
    mailHref(i.email) && { icon: 'mail', label: 'Email', body: <a className="link-anim" href={mailHref(i.email)}>{i.email}</a> },
    i.hours && { icon: 'clock', label: 'Opening hours', body: <span style={{ whiteSpace: 'pre-line' }}>{i.hours}</span> },
    instagramHref(i.instagram) && { icon: 'instagram', label: 'Instagram', body: <a className="link-anim" href={instagramHref(i.instagram)} target="_blank" rel="noopener noreferrer">{i.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, '')}</a> },
    webHref(i.facebook) && { icon: 'facebook', label: 'Facebook', body: <a className="link-anim" href={webHref(i.facebook)} target="_blank" rel="noopener noreferrer">Our Facebook page</a> },
    webHref(i.youtube) && { icon: 'youtube', label: 'YouTube', body: <a className="link-anim" href={webHref(i.youtube)} target="_blank" rel="noopener noreferrer">Our YouTube channel</a> },
  ].filter(Boolean);

  return (
    <section className="page-top contact-page">
      <div className="site-wrap">
        <p className="eyebrow">Contact</p>
        <h1 className="detail-title">Let's talk</h1>
        <p className="page-top-sub">Ask about a course, a batch or anything else. We'll reply to the number or email you give.</p>
        <div className="contact-grid">
          <Reveal as="ul" className="contact-details">
            {rows.map((r) => <li key={r.label}><Icon name={r.icon} size={20} /><div><span className="contact-label">{r.label}</span><div className="contact-body">{r.body}</div></div></li>)}
            {rows.length === 0 && <li className="muted">Contact details will be added soon. Please use the form.</li>}
          </Reveal>
          <Reveal className="form-card" delay={100}>
            <h2 className="site-h3">Send an enquiry</h2>
            <ContactForm courses={data.courses} initialCourse={route.query.get('course') || ''} hasPrivacy={data.pages.hasPrivacy} instituteName={i.name} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
