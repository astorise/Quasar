const QUEUE_STORAGE_KEY = 'quasar:queue';

export const DEFAULT_FLUSH_INTERVAL_MS = 2000;
export const DEFAULT_FLUSH_THRESHOLD = 20;

export function createQueueManager({
  storage,
  transport,
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  flushThreshold = DEFAULT_FLUSH_THRESHOLD,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
} = {}) {
  if (!transport) throw new Error('queue: transport is required');

  const buffer = [];
  let timer = null;

  const persistedStorage = storage ?? null;
  const restore = () => {
    if (!persistedStorage) return;
    try {
      const raw = persistedStorage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) buffer.push(...parsed);
    } catch {
      // ignore — corrupted snapshot, drop it.
    }
  };

  const persist = () => {
    if (!persistedStorage) return;
    try {
      persistedStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(buffer));
    } catch {
      // quota — keep going, in-memory queue still works.
    }
  };

  const scheduleFlush = () => {
    if (timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      void flush('timer');
    }, flushIntervalMs);
  };

  const flush = async (reason = 'manual') => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (buffer.length === 0) return { reason, sent: 0 };
    const payload = buffer.splice(0, buffer.length);
    persist();
    const ok = await transport.send(payload, { reason });
    if (!ok) {
      buffer.unshift(...payload);
      persist();
      scheduleFlush();
      return { reason, sent: 0, requeued: payload.length };
    }
    return { reason, sent: payload.length };
  };

  restore();
  if (buffer.length > 0) scheduleFlush();

  return {
    enqueue(event) {
      buffer.push(event);
      persist();
      if (buffer.length >= flushThreshold) {
        void flush('threshold');
      } else {
        scheduleFlush();
      }
    },
    flush,
    flushSync(beaconSender) {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      if (buffer.length === 0) return false;
      const payload = buffer.splice(0, buffer.length);
      persist();
      const delivered = beaconSender(payload);
      if (!delivered) {
        buffer.unshift(...payload);
        persist();
      }
      return delivered;
    },
    get size() { return buffer.length; },
    get pending() { return buffer.slice(); },
  };
}

export { QUEUE_STORAGE_KEY };
