/**
 * Minimal DOM / browser-API surface sufficient to exercise the Quasar SDK
 * in a plain Node.js process. Only the APIs actually used by the SDK are
 * stubbed — nothing more.
 */

export class EventEmitter {
  constructor() { this._listeners = new Map(); }
  addEventListener(type, fn, _opts) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(type) ?? [];
    this._listeners.set(type, list.filter((l) => l !== fn));
  }
  dispatchEvent(type, event) {
    for (const fn of (this._listeners.get(type) ?? [])) fn(event);
  }
}

export class MockElement extends EventEmitter {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.classList = { length: 0, [Symbol.iterator]: function*() {} };
    this.nodeType = 1;
    this.parentNode = null;
  }
  getAttribute() { return null; }
  composedPath() { return [this]; }
}

export class MockStorage {
  constructor() { this._store = new Map(); }
  getItem(k) { return this._store.has(k) ? this._store.get(k) : null; }
  setItem(k, v) { this._store.set(k, String(v)); }
  removeItem(k) { this._store.delete(k); }
  clear() { this._store.clear(); }
}

export class MockDocument extends EventEmitter {
  constructor() {
    super();
    this.readyState = 'complete';
    this.title = 'Mock Page';
  }
}

export function makeBrowserEnv({ beaconSpy } = {}) {
  const storage = new MockStorage();
  const doc = new MockDocument();
  const win = new EventEmitter();
  win.innerWidth = 1280;
  win.innerHeight = 800;
  win.location = { href: 'http://localhost/', pathname: '/' };

  const beaconCalls = [];
  const beaconFn = (url, data) => { beaconCalls.push({ url, data }); return true; };

  const fetchCalls = [];
  const fetchFn = async (url, init) => {
    fetchCalls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 202 };
  };

  return { storage, doc, win, fetchFn, beaconFn, beaconCalls, fetchCalls };
}
