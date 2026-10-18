import { useEffect, useMemo, useState } from 'react';
import { Link, navigate } from '../../router.jsx';
import Icon from '../ui/Icon.jsx';
import { EmptyState, ErrorState, SkeletonRows } from '../ui/States.jsx';
import CourseCover from './CourseCover.jsx';
import CtaBand from './CtaBand.jsx';
import { Reveal } from './motion.jsx';
import { usePageMeta } from './useSite.js';

export default function CoursesPage({ site, route }) {
  const { status, data, error, reload } = site;
  const [q, setQ] = useState(route.query.get('q') || '');
  const [cls, setCls] = useState(route.query.get('class') || '');
  usePageMeta(data ? `Courses · ${data.institute.name}` : 'Courses', data ? `Courses at ${data.institute.name}` : '', data?.institute.name);

  // Keep the address bar in step with the filters, so a filtered view can be shared or reloaded.
  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (cls) p.set('class', cls);
    const qs = p.toString();
    navigate(`/courses${qs ? `?${qs}` : ''}`, { replace: true });
  }, [q, cls]);

  const courses = data?.courses || [];
  const classes = useMemo(() => [...new Set(courses.map((c) => c.class).filter(Boolean))].sort(), [courses]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return courses.filter((c) => (!cls || c.class === cls) && (!t || [c.name, c.description, ...c.highlights, ...c.curriculum].join(' ').toLowerCase().includes(t)));
  }, [courses, q, cls]);

  return (
    <>
      <section className="page-top">
        <div className="site-wrap">
          <p className="eyebrow">Courses</p>
          <h1 className="detail-title">Find the right course</h1>
          {data && <p className="page-top-sub">{courses.length === 1 ? 'One programme' : `${courses.length} programmes`} to choose from. Open any course for its details and to ask about joining.</p>}
        </div>
      </section>

      <section className="site-section courses-section">
        <div className="site-wrap">
          {status === 'error' && <ErrorState message={error} onRetry={reload} />}
          {status === 'loading' && <div className="panel"><SkeletonRows rows={3} /></div>}
          {data && courses.length === 0 && <EmptyState icon="book" title="Courses coming soon" action={<Link to="/contact" className="btn primary">Contact us</Link>}>We're still adding our courses. Please get in touch for details.</EmptyState>}
          {courses.length > 0 && (
            <>
              <div className="filters" role="search">
                <div className="search">
                  <Icon name="search" size={16} />
                  <input type="search" aria-label="Search courses" placeholder="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {classes.length > 1 && (
                  <div className="chips" role="group" aria-label="Filter by class">
                    <button type="button" className={`chip ${cls === '' ? 'active' : ''}`} aria-pressed={cls === ''} onClick={() => setCls('')}>All classes</button>
                    {classes.map((c) => <button key={c} type="button" className={`chip ${cls === c ? 'active' : ''}`} aria-pressed={cls === c} onClick={() => setCls(c)}>Class {c}</button>)}
                  </div>
                )}
              </div>
              <p className="results-count" aria-live="polite">{shown.length === courses.length ? `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}` : `${shown.length} of ${courses.length} courses`}</p>

              {shown.length === 0 ? (
                <EmptyState icon="search" title="No courses match" action={<button type="button" className="btn" onClick={() => { setQ(''); setCls(''); }}>Clear filters</button>}>Try a different word, or clear the filters.</EmptyState>
              ) : (
                <ol className="crows">
                  {shown.map((c, i) => (
                    <Reveal as="li" key={c.id} delay={Math.min(i, 4) * 70} className="crow card-hover">
                      <CourseCover course={c} eager={i === 0} />
                      <div className="crow-body">
                        <div className="course-title"><h2><Link to={`/courses/${c.slug}`} className="stretch">{c.name}</Link></h2>{c.class && <span className="tag">Class {c.class}</span>}</div>
                        {c.description && <p>{c.description}</p>}
                        <ul className="chips-static">
                          {c.duration && <li>{c.duration}</li>}{c.batchTimings && <li>{c.batchTimings}</li>}{c.fee && <li>{c.fee}</li>}
                        </ul>
                        <span className="more">View details <Icon name="arrow" size={15} className="btn-arrow" /></span>
                      </div>
                    </Reveal>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </section>
      {data && <CtaBand institute={data.institute} />}
    </>
  );
}
