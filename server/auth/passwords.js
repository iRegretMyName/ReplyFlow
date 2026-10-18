// Password hashing with scrypt (built into Node, so no extra dependency).
// scrypt is a deliberately slow, memory-hungry password hash. Each hash gets its
// own random salt, and the cost settings are stored inside the hash string, so
// they can be raised later without breaking existing accounts.
//
// Stored format:  scrypt$N$r$p$salt$key   (salt and key are base64url)
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

// 64 MiB of memory per hash, in line with OWASP's scrypt guidance.
export const DEFAULT_PARAMS = Object.freeze({ N: 2 ** 16, r: 8, p: 2 });
export const MIN_N = 2 ** 14; // hashes weaker than this are rejected when accounts load
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const HASH_RE = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

// Same Unicode normalisation on hashing and on login, so "é" typed two different
// ways still matches.
const prepare = (password) => String(password).normalize('NFKC');

const maxmem = ({ N, r }) => 128 * N * r * 2 + 1024 * 1024;

export function parseHash(stored) {
  const m = typeof stored === 'string' ? HASH_RE.exec(stored) : null;
  if (!m) return null;
  const N = Number(m[1]);
  const r = Number(m[2]);
  const p = Number(m[3]);
  const isPow2 = N > 1 && (N & (N - 1)) === 0;
  if (!isPow2 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return null;
  const salt = Buffer.from(m[4], 'base64url');
  const key = Buffer.from(m[5], 'base64url');
  if (salt.length < 8 || key.length < 16) return null;
  return { N, r, p, salt, key };
}

export async function hashPassword(password, params = DEFAULT_PARAMS) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(prepare(password), salt, KEY_LENGTH, {
    N: params.N, r: params.r, p: params.p, maxmem: maxmem(params),
  });
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const key = await scrypt(prepare(password), parsed.salt, parsed.key.length, {
    N: parsed.N, r: parsed.r, p: parsed.p, maxmem: maxmem(parsed),
  });
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

// Used for unknown usernames, so a missing account takes as long to reject as a
// real one with a wrong password (otherwise response time reveals who exists).
let dummy;
export function dummyHash() {
  dummy ??= hashPassword(randomBytes(24).toString('hex'));
  return dummy;
}
