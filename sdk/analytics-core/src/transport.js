export function createTransport({
  endpoint,
  fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
  beacon = (typeof navigator !== 'undefined' && navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null),
  headers = {},
} = {}) {
  if (!endpoint) throw new Error('transport: endpoint is required');

  return {
    endpoint,
    async send(events, { reason } = {}) {
      if (!fetchImpl) return false;
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ events, reason }),
          keepalive: true,
        });
        return response.ok || response.status === 202;
      } catch {
        return false;
      }
    },
    sendBeacon(events) {
      if (!beacon) return false;
      try {
        const blob = new Blob([JSON.stringify({ events, reason: 'unload' })], {
          type: 'application/json',
        });
        return beacon(endpoint, blob);
      } catch {
        return false;
      }
    },
  };
}
