import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './auth.jsx';
import { navigate, useRoute } from './router.jsx';
import PublicSite from './components/site/PublicSite.jsx';
import { Spinner } from './components/ui/States.jsx';

// Each area is its own download. A customer only ever fetches the public site; the sign-in
// screen and the admin panel's code load only when someone goes there.
const Login = lazy(() => import('./components/Login.jsx'));
const Shell = lazy(() => import('./components/Shell.jsx'));

function Splash({ label }) {
  return (
    <div className="splash" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const { status, check } = useAuth();
  const isAdmin = route.area === 'admin';
  const isLogin = route.area === 'login';

  useEffect(() => { if ((isAdmin || isLogin) && status === 'idle') check(); }, [isAdmin, isLogin, status, check]);

  // Not signed in and in the admin area: go to sign-in, and remember where they were headed.
  useEffect(() => {
    if (isAdmin && status === 'anon') navigate(`/staff/login?next=${encodeURIComponent(route.pathname + route.search)}`, { replace: true });
  }, [isAdmin, status, route.pathname, route.search]);

  // Already signed in but opened the sign-in page: straight to the admin panel.
  useEffect(() => { if (isLogin && status === 'authed') navigate('/admin', { replace: true }); }, [isLogin, status]);

  if (isAdmin) {
    if (status !== 'authed') return <Splash label={status === 'anon' ? 'Redirecting to sign in…' : 'Checking your session…'} />;
    return <Suspense fallback={<Splash label="Opening your desk…" />}><Shell /></Suspense>;
  }
  if (isLogin) {
    if (status !== 'anon') return <Splash label={status === 'authed' ? 'Opening the admin panel…' : 'Checking your session…'} />;
    return <Suspense fallback={<Splash label="Loading…" />}><Login /></Suspense>;
  }
  return <PublicSite route={route} />;
}
