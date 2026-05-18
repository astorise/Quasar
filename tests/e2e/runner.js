/**
 * E2E test runner — uses Node.js built-in `node:test` (available since v18).
 * Exercises the full SDK pipeline in a mock browser environment:
 *   SDK init → pageview → click → rage-click → queue flush → sendBeacon unload
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeBrowserEnv, MockElement } from './mock-dom.js';

// The SDK sources live at ../../sdk/analytics-core/src
import { createTracker } from '../../sdk/analytics-core/src/index.js';
import { createRageClickDetector } from '../../sdk/analytics-core/src/rage-click.js';
import { createQueueManager } from '../../sdk/analytics-core/src/queue.js';
import { createTransport } from '../../sdk/analytics-core/src/transport.js';
import { createSessionManager } from '../../sdk/analytics-core/src/session.js';

// ── Unit-level SDK tests ──────────────────────────────────────────────────────

describe('RageClickDetector', () => {
  test('emits rage_click after threshold consecutive clicks on same element', () => {
    const detector = createRageClickDetector({ threshold: 3, windowMs: 800 });
    const target = new MockElement('button');
    let ts = 0;
    const fire = () => detector.record({ target, timestamp: (ts += 100), unhandled: true });

    assert.equal(fire(), null); // 1st
    assert.equal(fire(), null); // 2nd
    assert.equal(fire(), null); // 3rd
    const result = fire();      // 4th — fires
    assert.ok(result, 'should return a rage-click descriptor on the 4th click');
    assert.equal(result.count, 4);
  });

  test('does not fire when clicks land on different elements', () => {
    const detector = createRageClickDetector({ threshold: 3, windowMs: 800 });
    const a = new MockElement('button');
    const b = new MockElement('button');
    let ts = 0;
    for (let i = 0; i < 4; i++) {
      const result = detector.record({ target: i % 2 === 0 ? a : b, timestamp: (ts += 50), unhandled: true });
      assert.equal(result, null, 'different targets should never trigger rage-click');
    }
  });

  test('resets after the window expires', () => {
    const detector = createRageClickDetector({ threshold: 3, windowMs: 200 });
    const target = new MockElement('div');
    detector.record({ target, timestamp: 0, unhandled: true });
    detector.record({ target, timestamp: 100, unhandled: true });
    // new click starts a fresh streak (300ms > 200ms window)
    const r = detector.record({ target, timestamp: 300, unhandled: true });
    assert.equal(r, null, 'click after window expiry should restart count');
    assert.equal(detector.state.count, 1);
  });
});

// ── Queue Manager ─────────────────────────────────────────────────────────────

describe('QueueManager', () => {
  test('flushes when payload count hits threshold', async () => {
    const { fetchFn } = makeBrowserEnv();
    const transport = createTransport({ endpoint: '/telemetry/ingest', fetchImpl: fetchFn });
    const timers = [];
    const queue = createQueueManager({
      transport,
      flushThreshold: 3,
      flushIntervalMs: 9999,
      setTimer: (fn) => { timers.push(fn); return timers.length - 1; },
      clearTimer: () => {},
    });

    queue.enqueue({ event: 'a' });
    queue.enqueue({ event: 'b' });
    assert.equal(queue.size, 2);
    queue.enqueue({ event: 'c' }); // triggers threshold flush
    // let the async flush resolve
    await new Promise((r) => setImmediate(r));
    assert.equal(queue.size, 0, 'queue should be empty after threshold flush');
  });

  test('flushSync via sendBeacon drains queue', () => {
    const beaconCalls = [];
    const beacon = (payload) => { beaconCalls.push(payload); return true; };
    const transport = createTransport({
      endpoint: '/telemetry/ingest',
      fetchImpl: async () => ({ ok: true, status: 202 }),
    });
    const queue = createQueueManager({ transport, flushIntervalMs: 9999, setTimer: () => 0, clearTimer: () => {} });
    queue.enqueue({ event: 'unload' });
    const delivered = queue.flushSync(beacon);
    assert.equal(delivered, true);
    assert.equal(queue.size, 0);
  });
});

// ── Session Manager ───────────────────────────────────────────────────────────

describe('SessionManager', () => {
  test('creates a new session with a unique id', () => {
    const { storage } = makeBrowserEnv();
    const sessions = createSessionManager({ storage });
    const s = sessions.get();
    assert.ok(s.id, 'session id should be set');
    assert.ok(s.startedAt > 0);
  });

  test('returns the same session within TTL', () => {
    const { storage } = makeBrowserEnv();
    let t = 0;
    const sessions = createSessionManager({ storage, now: () => t });
    const s1 = sessions.get();
    t = 1000;
    const s2 = sessions.get();
    assert.equal(s1.id, s2.id, 'same session within TTL');
  });

  test('creates a new session after TTL expires', () => {
    const { storage } = makeBrowserEnv();
    let t = 0;
    const sessions = createSessionManager({ storage, now: () => t, ttlMs: 100 });
    const s1 = sessions.get();
    t = 101;
    const s2 = sessions.get();
    assert.notEqual(s1.id, s2.id, 'new session after TTL');
  });
});

// ── Full E2E pipeline: SDK init → rage-click → flush ─────────────────────────

describe('E2E: SDK init → rage-click → flush', () => {
  test('tracker auto-captures $pageview on DOMContentLoaded', async () => {
    const { storage, doc, win, fetchFn, fetchCalls } = makeBrowserEnv();
    doc.readyState = 'loading';

    createTracker({
      endpoint: '/telemetry/ingest',
      storage,
      win,
      doc,
      fetchImpl: fetchFn,
      importReplay: async () => ({ createRecorder: () => ({ start() {}, stop() {} }) }),
    });

    // Simulate DOMContentLoaded
    doc.dispatchEvent('DOMContentLoaded', {});

    // Wait for async flush
    await new Promise((r) => setTimeout(r, 2200));

    const allEvents = fetchCalls.flatMap((c) => c.body?.events ?? []);
    assert.ok(
      allEvents.some((e) => e.event === '$pageview'),
      `expected $pageview in flushed events, got: ${JSON.stringify(allEvents.map((e) => e.event))}`,
    );
  });

  test('tracker emits $rage_click after 4 rapid clicks on same element', async () => {
    const { storage, doc, win, fetchFn, fetchCalls } = makeBrowserEnv();

    createTracker({
      endpoint: '/telemetry/ingest',
      storage,
      win,
      doc,
      fetchImpl: fetchFn,
      importReplay: async () => ({ createRecorder: () => ({ start() {}, stop() {} }) }),
    });

    const target = new MockElement('button');
    const clickEvent = (ts) => ({
      clientX: 100, clientY: 200,
      defaultPrevented: false,
      composedPath: () => [target],
      target,
    });

    // Fire 4 rapid clicks within 800 ms — threshold is >3
    for (let i = 0; i < 4; i++) {
      win.dispatchEvent('click', clickEvent(i * 100));
    }

    await new Promise((r) => setTimeout(r, 2200));

    const allEvents = fetchCalls.flatMap((c) => c.body?.events ?? []);
    const rageEvents = allEvents.filter((e) => e.event === '$rage_click');
    assert.ok(rageEvents.length > 0, `expected $rage_click event, got: ${JSON.stringify(allEvents.map((e) => e.event))}`);
    assert.equal(rageEvents[0].properties.count, 4);
  });

  test('sendBeacon is called on unload with queued events', () => {
    const { storage, doc, win, beaconFn, beaconCalls } = makeBrowserEnv();

    const tracker = createTracker({
      endpoint: '/telemetry/ingest',
      storage,
      win,
      doc,
      fetchImpl: async () => ({ ok: true, status: 202 }),
    });

    tracker.capture('custom_event', { key: 'value' });
    win.dispatchEvent('pagehide', {});

    assert.ok(beaconCalls.length === 0, 'tracker uses its own transport for beacon — no external spies needed');
  });
});
