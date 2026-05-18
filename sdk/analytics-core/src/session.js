const SESSION_STORAGE_KEY = 'quasar:session';
const SESSION_TTL_MS = 30 * 60 * 1000;

const cryptoRef = globalThis.crypto;

function randomId() {
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSessionManager({ storage, now = () => Date.now(), ttlMs = SESSION_TTL_MS } = {}) {
  const persistent = storage ?? null;
  let cached = null;

  const persist = (session) => {
    cached = session;
    if (persistent) {
      try {
        persistent.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } catch {
        // storage may be unavailable (private mode, quota, SSR) — fall back to in-memory only.
      }
    }
  };

  const load = () => {
    if (cached) return cached;
    if (!persistent) return null;
    try {
      const raw = persistent.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      cached = parsed;
      return parsed;
    } catch {
      return null;
    }
  };

  const isExpired = (session) => now() - session.lastSeen > ttlMs;

  return {
    get() {
      const existing = load();
      if (existing && !isExpired(existing)) {
        existing.lastSeen = now();
        persist(existing);
        return existing;
      }
      const next = { id: randomId(), startedAt: now(), lastSeen: now() };
      persist(next);
      return next;
    },
    touch() {
      const session = this.get();
      session.lastSeen = now();
      persist(session);
      return session;
    },
    reset() {
      cached = null;
      if (persistent) {
        try { persistent.removeItem(SESSION_STORAGE_KEY); } catch { /* ignore */ }
      }
    },
  };
}

export { randomId, SESSION_STORAGE_KEY, SESSION_TTL_MS };
