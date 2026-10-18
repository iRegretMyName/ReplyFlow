import 'dotenv/config';
import { createApp } from './app.js';

// Staff accounts are defined in code: server/config/staff-accounts.js
let accounts = [];
try {
  accounts = (await import('./config/staff-accounts.js')).default;
} catch (err) {
  if (err?.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes('staff-accounts')) {
    console.warn('Warning: server/config/staff-accounts.js is missing, so nobody can sign in.');
  } else {
    throw err;
  }
}

let built;
try {
  built = createApp({ accounts });
} catch (err) {
  console.error(`\nCannot start: there is a problem in server/config/staff-accounts.js\n  ${err.message}\n`);
  process.exit(1);
}

const { app, directory, cfg } = built;
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`ReplyFlow API running on http://localhost:${PORT}`);
  console.log(`Staff accounts: ${directory.enabled} enabled of ${directory.total} listed.`);
  if (directory.enabled === 0) {
    console.warn('Warning: no enabled staff accounts, so nobody can sign in. See "Staff accounts" in README.md.');
  }
  if (cfg.isProd && !cfg.secureCookies) {
    console.warn('Warning: running in production with COOKIE_SECURE=false. Only do this on a trusted network, never on the public internet.');
  }
  if (!process.env.GEMINI_API_KEY) console.warn('Warning: GEMINI_API_KEY not set. AI features will show an error.');
});
