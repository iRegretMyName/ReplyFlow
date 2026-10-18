// Turns the raw list in server/config/staff-accounts.js into a validated lookup.
// Anything wrong makes the server refuse to start, with a message that says which
// account and what to fix, rather than silently letting the wrong people in.
import { parseHash, MIN_N } from './passwords.js';

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/i;
const USERNAME_RE = /^[^\s@]+(@[^\s@]+\.[^\s@]+)?$/; // a simple name, or an email address
const ROLES = ['admin', 'staff'];

export const normaliseUsername = (value) => String(value).trim().toLowerCase();

export function buildAccountDirectory(rawList, { allowWeakHashes = false } = {}) {
  if (!Array.isArray(rawList)) {
    throw new Error('staff-accounts.js must export an array of accounts.');
  }

  const byId = new Map();
  const byUsername = new Map();

  rawList.forEach((raw, index) => {
    const where = `account #${index + 1}${raw?.id ? ` ("${raw.id}")` : ''}`;
    const fail = (msg) => { throw new Error(`${where}: ${msg}`); };
    if (!raw || typeof raw !== 'object') fail('must be an object.');

    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) {
      fail('"id" must be 2-40 letters, numbers, dashes or underscores.');
    }
    if (typeof raw.username !== 'string' || raw.username.length > 100 || !USERNAME_RE.test(raw.username.trim())) {
      fail('"username" must be a single word (or an email address) with no spaces.');
    }
    if (typeof raw.displayName !== 'string' || !raw.displayName.trim() || raw.displayName.length > 80) {
      fail('"displayName" is required (up to 80 characters).');
    }
    const role = raw.role ?? 'staff';
    if (!ROLES.includes(role)) fail(`"role" must be one of: ${ROLES.join(', ')}.`);
    const enabled = raw.enabled ?? true;
    if (typeof enabled !== 'boolean') fail('"enabled" must be true or false.');

    const parsed = parseHash(raw.passwordHash);
    if (!parsed) {
      fail('"passwordHash" is missing or not valid. Create one with:  npm run staff:hash');
    }
    if (parsed.N < MIN_N && !allowWeakHashes) {
      fail('"passwordHash" uses settings that are too weak. Create a new one with:  npm run staff:hash');
    }

    const account = Object.freeze({
      id: raw.id.toLowerCase(),
      username: normaliseUsername(raw.username),
      displayName: raw.displayName.trim(),
      role,
      enabled,
      passwordHash: raw.passwordHash,
    });

    if (byId.has(account.id)) fail('this id is used by another account.');
    if (byUsername.has(account.username)) fail('this username is used by another account.');
    byId.set(account.id, account);
    byUsername.set(account.username, account);
  });

  return {
    byId,
    byUsername,
    total: byId.size,
    enabled: [...byId.values()].filter((a) => a.enabled).length,
  };
}

// The only shape of an account that ever leaves the server. No hash.
export const publicUser = (account) => ({
  id: account.id,
  username: account.username,
  displayName: account.displayName,
  role: account.role,
});
