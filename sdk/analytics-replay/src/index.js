import { createDomRecorder } from './dom-recorder.js';
import { createInteractionSampler } from './interaction-sampler.js';

const DEFAULT_FLUSH_INTERVAL_MS = 2000;
const DEFAULT_FLUSH_THRESHOLD = 50;

export function createRecorder({
  endpoint = '/telemetry/replay',
  fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
  beacon = (typeof navigator !== 'undefined' && navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null),
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  flushThreshold = DEFAULT_FLUSH_THRESHOLD,
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  now = () => Date.now(),
} = {}) {
  let session = null;
  const queue = [];
  let timer = null;
  let started = false;

  const sendBatch = async (chunks) => {
    if (!fetchImpl) return false;
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: session?.id, chunks }),
        keepalive: true,
      });
      return response.ok || response.status === 202;
    } catch {
      return false;
    }
  };

  const flush = async (reason = 'manual') => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const payload = queue.splice(0, queue.length);
    const delivered = await sendBatch(payload);
    if (!delivered) queue.unshift(...payload);
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => { void flush('timer'); }, flushIntervalMs);
  };

  const enqueue = (chunk) => {
    queue.push(chunk);
    if (queue.length >= flushThreshold) {
      void flush('threshold');
    } else {
      schedule();
    }
  };

  const dom = createDomRecorder({
    doc,
    onPatch: (patches) => enqueue({ kind: 'dom', ts: now(), patches }),
    now,
  });

  const sampler = createInteractionSampler({
    win,
    doc,
    onSample: (samples) => enqueue({ kind: 'interaction', ts: now(), samples }),
    now,
  });

  const onUnload = () => {
    if (!beacon || queue.length === 0) return;
    try {
      const blob = new Blob(
        [JSON.stringify({ session_id: session?.id, chunks: queue.splice(0, queue.length), reason: 'unload' })],
        { type: 'application/json' },
      );
      beacon(endpoint, blob);
    } catch {
      // ignore
    }
  };

  return {
    start(sessionDescriptor) {
      if (started) return;
      started = true;
      session = sessionDescriptor || session;
      dom.start();
      sampler.start();
      if (win) {
        win.addEventListener('pagehide', onUnload);
        win.addEventListener('beforeunload', onUnload);
      }
    },
    stop() {
      dom.stop();
      sampler.stop();
      if (win) {
        win.removeEventListener('pagehide', onUnload);
        win.removeEventListener('beforeunload', onUnload);
      }
      void flush('stop');
      started = false;
    },
    flush,
    get pending() { return queue.length; },
  };
}

export { createDomRecorder, createInteractionSampler };
