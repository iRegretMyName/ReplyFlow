// Who is signed in. The server is the source of truth. The check only runs when someone opens
// the staff sign-in page or the admin panel: visitors to the public website never trigger it.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { navigate } from './router.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // idle = not asked yet | checking | anon | authed
  const [state, setState] = useState({ status: 'idle', user: null, notice: '' });
  const asked = useRef(false);

  const check = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    setState((s) => ({ ...s, status: 'checking' }));
    api.me()
      .then(({ user }) => setState({ status: 'authed', user, notice: '' }))
      .catch((err) => setState({ status: 'anon', user: null, notice: err.network ? err.message : '' }));
  }, []);

  useEffect(() => {
    const onExpired = () => setState((s) => (s.status === 'authed'
      ? { status: 'anon', user: null, notice: 'Your session has ended. Please sign in again.' }
      : s));
    window.addEventListener('replyflow:unauthorized', onExpired);
    return () => window.removeEventListener('replyflow:unauthorized', onExpired);
  }, []);

  // login() only checks the credentials; commit() switches the app over. The sign-in
  // screen uses the gap to show its "Signed in" confirmation.
  const login = useCallback(async (username, password) => (await api.login(username, password)).user, []);
  const commit = useCallback((user) => { asked.current = true; setState({ status: 'authed', user, notice: '' }); }, []);
  const logout = useCallback(async () => {
    let notice = '';
    try { await api.logout(); } catch { notice = "Signed out on this device, but the server couldn't be reached. The session will expire on its own."; }
    navigate('/', { replace: true }); // back to the public website
    setState({ status: 'anon', user: null, notice });
  }, []);

  const value = useMemo(() => ({ ...state, check, login, commit, logout }), [state, check, login, commit, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
