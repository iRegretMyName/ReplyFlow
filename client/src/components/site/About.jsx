import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows } from '../ui/States.jsx';
import OmrArt from '../OmrArt.jsx';
import CtaBand from './CtaBand.jsx';
import { Reveal } from './motion.jsx';
import { paragraphs } from './faqs.js';
import { classRange, joinList, mapsHref, telHref } from './format.js';
import { usePageMeta } from './useSite.js';

export default function About({ site }) {
  const { status, data, error, reload } = site;
  const inst = data?.institute;
  usePageMeta(inst ? `About · ${inst.name}` : 'About', inst ? `About ${inst.name}` : '', inst?.name);
  if (status === 'error') return <div className="site-wrap site-section"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return <div className="site-wrap site-section"><div className="panel"><SkeletonRows rows={4} /></div></div>;

  const { about } = data.pages;
  const names = data.courses.map((c) => c.name);
  const range = classRange(data.courses);
  // What we can say without the administrator having written anything: only facts on file.
  const derived = names.length ? `${inst.name} offers coaching for ${joinList(names)}${range ? `, for Classes ${range}` : ''}.` : `Welcome to ${inst.name}.`;
  const paras = paragraphs(about.story);
  const lede = paras[0] || derived;
  const rest = paras.slice(1);
  const map = mapsHref(inst.address);
  const call = telHref(inst.phone);

  return (
    <>
      <section className="page-top about-top">
        <div className="site-wrap">
          <p className="eyebrow">About us</p>
          <h1 className="detail-title">{about.headline || `About ${inst.name}`}</h1>
          <p className="about-lede">{lede}</p>
        </div>
      </section>

      <section className="site-section about-split">
        <div className="site-wrap about-grid">
          <Reveal className="about-text">
            {rest.length > 0 ? rest.map((p, i) => <p key={i}>{p}</p>) : (
              <p className="muted">{names.length ? 'Browse our courses to see what we teach, and get in touch with any questions.' : 'Please get in touch to learn more about us.'}</p>
            )}
            <div className="hero-actions"><Link to="/courses" className="btn primary">See our courses <Icon name="arrow" size={16} className="btn-arrow" /></Link><Link to="/contact" className="btn">Contact us</Link></div>
          </Reveal>
          <Reveal className="about-visual" delay={120}>
            {about.image ? <img src={about.image} alt="" loading="lazy" decoding="async" width="800" height="600" /> : <div className="about-art" aria-hidden="true"><OmrArt align="xMidYMid" /></div>}
          </Reveal>
        </div>
      </section>

      {about.values.length > 0 && (
        <section className="site-section values" aria-labelledby="values-h">
          <div className="site-wrap">
            <Reveal><h2 id="values-h" className="site-h2">How we work</h2></Reveal>
            <ol className="values-list">
              {about.values.map((v, i) => (
                <Reveal as="li" key={`${v.title}${i}`} delay={i * 80}>
                  <span className="step-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{v.title}</h3>{v.text && <p>{v.text}</p>}
                </Reveal>
              ))}
            </ol>
          </div>
        </section>
      )}

      {data.courses.length > 0 && (
        <section className="site-section teach" aria-labelledby="teach-h">
          <div className="site-wrap">
            <Reveal><h2 id="teach-h" className="site-h2">What we teach</h2></Reveal>
            <ul className="teach-list">
              {data.courses.map((c, i) => (
                <Reveal as="li" key={c.id} delay={i * 70}>
                  <Link to={`/courses/${c.slug}`} className="teach-link"><span>{c.name}</span>{c.class && <small>Class {c.class}</small>}<Icon name="arrow" size={18} className="btn-arrow" /></Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {(inst.address || inst.hours) && (
        <section className="site-section visit" aria-labelledby="visit-h">
          <div className="site-wrap visit-grid">
            <Reveal><h2 id="visit-h" className="site-h2">Visit us</h2></Reveal>
            <Reveal delay={80} className="visit-info">
              {inst.address && <p><Icon name="pin" size={18} /><span>{inst.address}</span></p>}
              {inst.hours && <p><Icon name="clock" size={18} /><span style={{ whiteSpace: 'pre-line' }}>{inst.hours}</span></p>}
              <div className="hero-actions">
                {map && <a className="btn" href={map} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> Open in Maps</a>}
                {call && <a className="btn" href={call}><Icon name="phone" size={16} /> Call</a>}
              </div>
            </Reveal>
          </div>
        </section>
      )}
      <CtaBand institute={inst} />
    </>
  );
}
