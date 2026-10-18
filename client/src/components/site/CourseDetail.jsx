import { Link } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows } from '../ui/States.jsx';
import CourseCover from './CourseCover.jsx';
import CtaBand from './CtaBand.jsx';
import { Reveal } from './motion.jsx';
import { filledFacts, telHref, whatsappHref } from './format.js';
import { usePageMeta } from './useSite.js';

export default function CourseDetail({ site, slug }) {
  const { status, data, error, reload } = site;
  const course = data?.courses.find((c) => c.slug === slug || c.id === slug);
  const inst = data?.institute;
  usePageMeta(course ? `${course.name} · ${inst.name}` : inst?.name, course?.description || (course ? `${course.name} at ${inst.name}` : ''), inst?.name);

  if (status === 'error') return <div className="site-wrap site-section"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return <div className="site-wrap site-section"><div className="panel"><SkeletonRows rows={4} /></div></div>;
  if (!course) {
    return (
      <>
        <section className="site-section"><div className="site-wrap site-missing">
          <p className="eyebrow">Course</p><h1 className="detail-title">Course not found</h1>
          <p>This course isn't available any more. <Link to="/courses" className="link">See all courses</Link></p>
        </div></section>
        <CtaBand institute={inst} />
      </>
    );
  }

  const facts = filledFacts(course);
  const call = telHref(inst.phone);
  const wa = whatsappHref(inst.whatsapp);
  const others = data.courses.filter((c) => c.id !== course.id).slice(0, 3);
  const ask = `/contact?course=${encodeURIComponent(course.slug)}`;

  return (
    <>
      <section className="detail-hero">
        <div className="site-wrap detail-hero-grid">
          <div>
            <nav aria-label="Breadcrumb" className="crumbs"><Link to="/courses" className="link-anim">Courses</Link><span aria-hidden="true">/</span><span aria-current="page">{course.name}</span></nav>
            <div className="course-title"><h1 className="detail-title">{course.name}</h1>{course.class && <span className="tag">Class {course.class}</span>}</div>
            {course.description && <p className="detail-desc">{course.description}</p>}
            <div className="hero-actions">
              <Link to={ask} className="btn primary">Ask about this course <Icon name="arrow" size={16} className="btn-arrow" /></Link>
              {call && <a className="btn" href={call}><Icon name="phone" size={16} /> Call {inst.phone}</a>}
            </div>
          </div>
          <div className="detail-cover"><CourseCover course={course} eager /></div>
        </div>
      </section>

      <section className="site-section detail-body">
        <div className="site-wrap detail-grid">
          <div className="detail-main">
            {course.highlights.length > 0 && (
              <Reveal as="section" aria-labelledby="hl-h"><h2 id="hl-h" className="site-h3">What you get</h2>
                <ul className="ticks big">{course.highlights.map((h) => <li key={h}><Icon name="check" size={18} />{h}</li>)}</ul></Reveal>
            )}
            {course.curriculum.length > 0 && (
              <Reveal as="section" aria-labelledby="cu-h"><h2 id="cu-h" className="site-h3">Curriculum</h2>
                <ol className="curriculum">{course.curriculum.map((t, i) => <li key={t}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{t}</li>)}</ol></Reveal>
            )}
            {course.eligibility && (
              <Reveal as="section" aria-labelledby="el-h"><h2 id="el-h" className="site-h3">Who it's for</h2><p>{course.eligibility}</p></Reveal>
            )}
            {!course.highlights.length && !course.curriculum.length && !course.eligibility && (
              <p className="muted">More details about this course will be added soon. Please get in touch with any questions.</p>
            )}
          </div>
          <aside className="detail-aside" aria-label="Course facts">
            <div className="aside-card">
              <h2 className="site-h3">At a glance</h2>
              {facts.length > 0 ? (
                <dl className="aside-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              ) : <p className="muted small">Fees, batch timings and demo classes: please get in touch.</p>}
              <Link to={ask} className="btn primary block">Enquire about {course.name}</Link>
              {wa && <a className="btn block" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} /> WhatsApp us</a>}
            </div>
          </aside>
        </div>
      </section>

      {others.length > 0 && (
        <section className="site-section others" aria-labelledby="oth-h">
          <div className="site-wrap">
            <Reveal><h2 id="oth-h" className="site-h2">Other courses</h2></Reveal>
            <ul className="others-list">
              {others.map((c, i) => (
                <Reveal as="li" key={c.id} delay={i * 80} className="mini card-hover">
                  <CourseCover course={c} />
                  <div><h3><Link to={`/courses/${c.slug}`} className="stretch">{c.name}</Link></h3>{c.class && <span className="mini-sub">Class {c.class}</span>}</div>
                  <Icon name="arrow" size={18} className="btn-arrow mini-arrow" />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CtaBand institute={inst} title={`Interested in ${course.name}?`} />
    </>
  );
}
