// In-memory sessions. The browser holds a random token in an HttpOnly cookie; the
// server keeps only a SHA-256 of it, so reading server memory never reveals a
// usable token.
//   - idle timeout: a session ends after a stretch with no activity, and every
//     request renews it (sliding window)
//   - absolute timeout: a session ends after a fixed time however busy it is
// Sessions disappear when the server restarts, which means everyone signs in
// again after you change the accounts file. That is intentional.
import { randomBytes, createHash } from 'node:crypto';

const digest = (token) => createHash('sha256').update(token).digest('hex');

export function createSessionStore({ idleMs, absoluteMs, now = Date.now } = {}) {
  const sessions = new Map(); // digest -> { userId, createdAt, lastSeenAt }

  const isLive = (s, t) => t - s.lastSeenAt < idleMs && t - s.createdAt < absoluteMs;

  function sweep() {
    const t = now();
    for (const [key, s] of sessions) if (!isLive(s, t)) sessions.delete(key);
  }
  const timer = setInterval(sweep, 60_000);
  timer.unref?.();

  return {
    create(userId) {
      const token = randomBytes(32).toString('base64url');
      const t = now();
      sessions.set(digest(token), { userId, createdAt: t, lastSeenAt: t });
      return token;
    },
    // Returns the session and renews its idle window, or null if missing/expired.
    touch(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null;
      const key = digest(token);
      const s = sessions.get(key);
      if (!s) return null;
      const t = now();
      if (!isLive(s, t)) { sessions.delete(key); return null; }
      s.lastSeenAt = t;
      return { userId: s.userId, remainingMs: Math.min(absoluteMs - (t - s.createdAt), idleMs) };
    },
    destroy(token) {
      if (typeof token === 'string') sessions.delete(digest(token));
    },
    destroyAllFor(userId) {
      for (const [key, s] of sessions) if (s.userId === userId) sessions.delete(key);
    },
    sweep,
    get size() { return sessions.size; },
    stop() { clearInterval(timer); },
  };
}
