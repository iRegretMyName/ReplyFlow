import { Fragment, useRef } from 'react';
import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { ErrorState } from '../ui/States.jsx';
import OmrArt from '../OmrArt.jsx';
import Accordion from './Accordion.jsx';
import CourseCover from './CourseCover.jsx';
import CtaBand from './CtaBand.jsx';
import { CountUp, Reveal, useParallax } from './motion.jsx';
import { buildFaqs } from './faqs.js';
import { classRange, joinList } from './format.js';
import { usePageMeta } from './useSite.js';

const STEPS = [
  ['Get in touch', 'Call, message us on WhatsApp, or send an enquiry from the website.'],
  ['Talk it through', 'Ask about the courses, the batches and which one fits the student.'],
  ['Choose a course', 'Pick the course you want and ask about joining the next batch.'],
];

function Hero({ inst, pages, courses }) {
  const art = useRef(null);
  useParallax(art, 0.1);
  const headline = pages.home.headline || inst.name;
  const names = courses.map((c) => c.name);
  const sub = pages.home.subtitle || (names.length ? `Coaching for ${joinList(names)}.` : '');
  return (
    <section className="hero2" aria-labelledby="hero-h">
      <div className="hero2-bg" aria-hidden="true">
        {pages.home.heroImage
          ? <img className="hero2-photo" src={pages.home.heroImage} alt="" fetchpriority="high" decoding="async" />
          : <div className="hero2-art" ref={art}><OmrArt align="xMaxYMid" /></div>}
        <div className="hero2-fade" />
      </div>
      <div className="site-wrap hero2-inner">
        {inst.address && <p className="hero2-eyebrow stagger" style={{ '--i': 0 }}>{inst.address}</p>}
        <h1 id="hero-h" className="hero2-title">
          {headline.split(' ').map((w, k) => <Fragment key={k}><span className="w"><span style={{ '--i': k + 1 }}>{w}</span></span>{' '}</Fragment>)}
        </h1>
        {sub && <p className="hero2-sub stagger" style={{ '--i': 7 }}>{sub}</p>}
        <div className="hero2-actions stagger" style={{ '--i': 9 }}>
          <Link to="/courses" className="btn light">Explore courses <Icon name="arrow" size={16} className="btn-arrow" /></Link>
          <Link to="/contact" className="btn outline-light">Enquire now</Link>
        </div>
      </div>
      <a href="#glance" className="scroll-cue" aria-label="Scroll to the next section"><span /></a>
    </section>
  );
}

function Glance({ courses, inst }) {
  const range = classRange(courses);
  const demo = courses.some((c) => c.demoAvailability);
  const items = [
    courses.length > 0 && { k: 'Programmes', v: <CountUp to={courses.length} /> },
    range && { k: 'Classes covered', v: range },
    demo && { k: 'Demo classes', v: 'Available', text: true },
    inst.hours && { k: 'Open', v: inst.hours.split('\n')[0], text: true },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <section id="glance" className="glance" aria-label="At a glance">
      <Reveal className="site-wrap glance-row">
        {items.map((it) => <div key={it.k}><span className={`glance-v${it.text ? ' text' : ''}`}>{it.v}</span><span className="glance-k">{it.k}</span></div>)}
      </Reveal>
    </section>
  );
}

function Featured({ courses }) {
  if (!courses.length) return null;
  const flagged = courses.filter((c) => c.featured);
  const picks = flagged.length ? flagged : courses;
  const [main, ...rest] = picks;
  const more = [...rest, ...courses.filter((c) => !picks.includes(c))].slice(0, 3);
  return (
    <section className="site-section" aria-labelledby="featured-h">
      <div className="site-wrap">
        <Reveal className="section-head">
          <h2 id="featured-h" className="site-h2">{flagged.length ? 'Featured course' : 'Our courses'}</h2>
          <Link to="/courses" className="link-anim head-link">All courses <Icon name="arrow" size={15} className="btn-arrow" /></Link>
        </Reveal>
        <div className="feature">
          <Reveal className="feature-main card-hover">
            <CourseCover course={main} eager />
            <div className="feature-body">
              {main.class && <span className="tag">Class {main.class}</span>}
              <h3><Link to={`/courses/${main.slug}`} className="stretch">{main.name}</Link></h3>
              {main.description && <p>{main.description}</p>}
              {main.highlights.length > 0 && <ul className="ticks">{main.highlights.slice(0, 3).map((h) => <li key={h}><Icon name="check" size={16} />{h}</li>)}</ul>}
              <span className="more">View course <Icon name="arrow" size={15} className="btn-arrow" /></span>
            </div>
          </Reveal>
          {more.length > 0 && (
            <ul className="feature-side">
              {more.map((c, i) => (
                <Reveal as="li" key={c.id} delay={120 + i * 90} className="mini card-hover">
                  <CourseCover course={c} />
                  <div>
                    <h3><Link to={`/courses/${c.slug}`} className="stretch">{c.name}</Link></h3>
                    {c.class && <span className="mini-sub">Class {c.class}</span>}
                  </div>
                  <Icon name="arrow" size={18} className="btn-arrow mini-arrow" />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="site-section steps" aria-labelledby="steps-h">
      <div className="site-wrap">
        <Reveal><h2 id="steps-h" className="site-h2">How it works</h2></Reveal>
        <ol className="steps-list">
          {STEPS.map(([t, x], i) => (
            <Reveal as="li" key={t} delay={i * 110}>
              <span className="step-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t}</h3>
              <p>{x}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function Home({ site }) {
  const { status, data, error, reload } = site;
  const inst = data?.institute;
  const lede = data?.courses.length ? `Coaching for ${joinList(data.courses.map((c) => c.name))}.` : '';
  usePageMeta(inst?.name, [lede, inst?.address].filter(Boolean).join(' · '), inst?.name);

  if (status === 'error') return <div className="site-wrap site-section"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return <div className="hero2 hero2-loading" aria-busy="true"><span className="sr-only">Loading</span></div>;

  const faqs = buildFaqs(data).slice(0, 4);
  return (
    <>
      <Hero inst={inst} pages={data.pages} courses={data.courses} />
      <Glance courses={data.courses} inst={inst} />
      <Featured courses={data.courses} />
      <Steps />
      <section className="site-section faq-teaser" aria-labelledby="faq-h">
        <div className="site-wrap faq-teaser-grid">
          <Reveal>
            <h2 id="faq-h" className="site-h2">Common questions</h2>
            <p className="muted">Quick answers about courses, location and how to reach us.</p>
            <Link to="/faq" className="link-anim head-link">See all questions <Icon name="arrow" size={15} className="btn-arrow" /></Link>
          </Reveal>
          <Reveal delay={100}><Accordion items={faqs.map((f) => ({ id: f.id, title: f.question, content: f.answer.split('\n').map((l, i) => <p key={i}>{l}</p>) }))} /></Reveal>
        </div>
      </section>
      <CtaBand institute={inst} />
    </>
  );
}
