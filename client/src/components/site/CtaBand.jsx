import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { Reveal } from './motion.jsx';
import { telHref, whatsappHref } from './format.js';

// The closing call to action. Used at the bottom of most pages.
export default function CtaBand({ institute, title = 'Have a question about a course?', text = 'Call us, message us on WhatsApp, or send an enquiry and we will get back to you.' }) {
  const call = telHref(institute?.phone);
  const wa = whatsappHref(institute?.whatsapp);
  return (
    <section className="cta-band" aria-labelledby="cta-h">
      <Reveal className="site-wrap cta-inner">
        <div>
          <h2 id="cta-h" className="site-h2">{title}</h2>
          <p>{text}</p>
        </div>
        <div className="cta-actions">
          <Link to="/contact" className="btn light">Send an enquiry <Icon name="arrow" size={16} className="btn-arrow" /></Link>
          {call && <a className="btn outline-light" href={call}><Icon name="phone" size={16} /> {institute.phone}</a>}
          {wa && <a className="btn outline-light" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} /> WhatsApp</a>}
        </div>
      </Reveal>
    </section>
  );
}
