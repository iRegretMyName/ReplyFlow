// The customer website. Needs no sign-in and makes no authentication request.
import { useEffect, useRef, useState } from 'react';
import SiteLayout from './SiteLayout.jsx';
import Home from './Home.jsx';
import CoursesPage from './CoursesPage.jsx';
import CourseDetail from './CourseDetail.jsx';
import About from './About.jsx';
import Contact from './Contact.jsx';
import FaqPage from './FaqPage.jsx';
import Legal from './Legal.jsx';
import NotFound from './NotFound.jsx';
import { useSite } from './useSite.js';

export default function PublicSite({ route }) {
  const site = useSite();
  const main = useRef(null);
  const first = useRef(true);
  const [announce, setAnnounce] = useState('');

  // After moving to another page: put keyboard and screen-reader focus at the top of the new page.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    main.current?.focus({ preventScroll: true });
    setAnnounce(document.title);
  }, [route.pathname]);

  const page = {
    home: <Home site={site} />,
    courses: <CoursesPage site={site} route={route} />,
    course: <CourseDetail site={site} slug={route.params.id} />,
    about: <About site={site} />,
    contact: <Contact site={site} route={route} />,
    faq: <FaqPage site={site} />,
    privacy: <Legal name="privacy" site={site} />,
    terms: <Legal name="terms" site={site} />,
  }[route.name] || <NotFound />;

  return (
    <SiteLayout site={site} route={route} mainRef={main}>
      <div className="page-enter" key={route.pathname}>{page}</div>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </SiteLayout>
  );
}
