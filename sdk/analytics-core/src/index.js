import { createSessionManager } from './session.js';
import { createQueueManager } from './queue.js';
import { createTransport } from './transport.js';
import { createRageClickDetector } from './rage-click.js';
import { createReplayLoader } from './replay-loader.js';

const DEFAULT_ENDPOINT = '/telemetry/ingest';
const DEFAULT_REPLAY_ENDPOINT = '/telemetry/replay';

function describeTarget(element) {
  if (!element || element.nodeType !== 1) return null;
  const id = element.id ? `#${element.id}` : '';
  const tag = element.tagName ? element.tagName.toLowerCase() : 'unknown';
  const cls = element.classList && element.classList.length > 0
    ? '.' + Array.from(element.classList).slice(0, 3).join('.')
    : '';
  return `${tag}${id}${cls}`;
}

export function createTracker(options = {}) {
  const {
    endpoint = DEFAULT_ENDPOINT,
    replayEndpoint = DEFAULT_REPLAY_ENDPOINT,
    replaySampling = 0,
    headers = {},
    win = typeof window !== 'undefined' ? window : null,
    doc = typeof document !== 'undefined' ? document : null,
    storage = typeof localStorage !== 'undefined' ? localStorage : null,
    fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
    importReplay,
    now = () => Date.now(),
  } = options;

  const transport = createTransport({ endpoint, fetchImpl, headers });
  const replayTransport = createTransport({ endpoint: replayEndpoint, fetchImpl, headers });
  const sessions = createSessionManager({ storage, now });
  const queue = createQueueManager({ storage, transport });
  const rage = createRageClickDetector();
  const replay = createReplayLoader({
    sampling: replaySampling,
    importModule: importReplay,
    endpoint: replayEndpoint,
    fetchImpl,
    beacon: replayTransport.sendBeacon.bind(replayTransport),
  });

  const baseProperties = () => {
    if (!win) return {};
    const location = win.location || {};
    return {
      page_url: location.href,
      page_path: location.pathname,
      page_title: doc ? doc.title : undefined,
    };
  };

  const buildEvent = (eventName, properties) => {
    const session = sessions.touch();
    return {
      distinct_id: properties?.distinct_id ?? session.id,
      event: eventName,
      timestamp: new Date(now()).toISOString(),
      session_id: session.id,
      properties: { ...baseProperties(), ...properties },
    };
  };

  const capture = (eventName, properties = {}) => {
    if (!eventName) return;
    const evt = buildEvent(eventName, properties);
    queue.enqueue(evt);
  };

  const onClick = (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const target = path.find((node) => node && node.nodeType === 1) || event.target;
    capture('$click', {
      element: describeTarget(target),
      x: event.clientX,
      y: event.clientY,
      x_ratio: win && win.innerWidth ? event.clientX / win.innerWidth : undefined,
      y_ratio: win && win.innerHeight ? event.clientY / win.innerHeight : undefined,
    });
    const unhandled = !event.defaultPrevented;
    const session = sessions.get();
    const rageEvent = rage.record({ target, timestamp: now(), unhandled });
    if (rageEvent) {
      queue.enqueue({
        distinct_id: session.id,
        event: '$rage_click',
        timestamp: new Date(now()).toISOString(),
        session_id: session.id,
        properties: {
          element: describeTarget(rageEvent.target),
          count: rageEvent.count,
          window_ms: rageEvent.windowMs,
        },
      });
    }
  };

  const onUnload = () => {
    queue.flushSync((events) => transport.sendBeacon(events));
  };

  let pageviewSeen = false;
  const recordPageview = () => {
    if (pageviewSeen) return;
    pageviewSeen = true;
    capture('$pageview', {});
    void replay.maybeStart({ session: sessions.get() }).catch(() => { /* swallow */ });
  };

  const listeners = [];
  const bindListeners = () => {
    if (!win) return;
    const click = (event) => onClick(event);
    win.addEventListener('click', click, { capture: true });
    listeners.push(() => win.removeEventListener('click', click, { capture: true }));

    const beforeUnload = () => onUnload();
    win.addEventListener('pagehide', beforeUnload);
    win.addEventListener('beforeunload', beforeUnload);
    listeners.push(() => {
      win.removeEventListener('pagehide', beforeUnload);
      win.removeEventListener('beforeunload', beforeUnload);
    });

    if (doc) {
      if (doc.readyState === 'complete' || doc.readyState === 'interactive') {
        recordPageview();
      } else {
        const onReady = () => recordPageview();
        doc.addEventListener('DOMContentLoaded', onReady, { once: true });
        listeners.push(() => doc.removeEventListener('DOMContentLoaded', onReady));
      }
    }
  };

  bindListeners();

  return {
    capture,
    flush: () => queue.flush('manual'),
    session: () => sessions.get(),
    enableReplay: (force = true) => replay.maybeStart({ session: sessions.get(), force }),
    teardown() {
      while (listeners.length) listeners.pop()();
    },
  };
}

export {
  createSessionManager,
  createQueueManager,
  createTransport,
  createRageClickDetector,
  createReplayLoader,
};
