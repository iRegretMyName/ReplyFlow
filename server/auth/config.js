// Authentication settings, read from environment variables with safe defaults.
const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function readAuthConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  // Cookies are only marked Secure in production (they need HTTPS). Set
  // COOKIE_SECURE=false to run a production build over plain HTTP on a trusted network.
  const secureCookies = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd;
  return {
    isProd,
    secureCookies,
    // "__Host-" makes browsers refuse the cookie unless it is Secure, set for the
    // whole site and not tied to another domain. Only valid over HTTPS.
    cookieName: secureCookies ? '__Host-rf_session' : 'rf_session',
    idleMs: num(env.SESSION_IDLE_MINUTES, 120) * 60_000,
    absoluteMs: num(env.SESSION_MAX_HOURS, 12) * 3_600_000,
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
