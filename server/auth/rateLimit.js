// Failed-sign-in limiter. Counts failures per key inside a time window; once the
// limit is hit the key is blocked for blockMs. In memory, which is enough for a
// single-server staff tool, and the map is size-capped so attackers who invent
// endless usernames cannot grow it without bound.
export function createLimiter({ max, windowMs, blockMs, now = Date.now, maxKeys = 10_000 }) {
  const entries = new Map(); // key -> { count, windowStart, blockedUntil }

  function current(key) {
    const e = entries.get(key);
    if (!e) return null;
    const t = now();
    if (e.blockedUntil > t) return e;
    if (t - e.windowStart >= windowMs) { entries.delete(key); return null; }
    return e;
  }

  return {
    // { allowed: true } or { allowed: false, retryAfterSec }
    check(key) {
      const e = current(key);
      const t = now();
      if (e && e.blockedUntil > t) {
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((e.blockedUntil - t) / 1000)) };
      }
      return { allowed: true };
    },
    fail(key) {
      const t = now();
      let e = current(key);
      if (!e) {
        if (entries.size >= maxKeys) entries.delete(entries.keys().next().value);
        e = { count: 0, windowStart: t, blockedUntil: 0 };
        entries.set(key, e);
      }
      e.count += 1;
      if (e.count >= max) e.blockedUntil = t + blockMs;
    },
    reset(key) { entries.delete(key); },
    get size() { return entries.size; },
  };
}
