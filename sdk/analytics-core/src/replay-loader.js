const REPLAY_MODULE_SPECIFIER = '@quasar/analytics-replay';

export function createReplayLoader({
  sampling = 0,
  random = Math.random,
  importModule,
  endpoint,
  fetchImpl,
  beacon,
} = {}) {
  let started = false;
  let pending = null;
  let recorder = null;

  const shouldSample = () => {
    if (sampling >= 1) return true;
    if (sampling <= 0) return false;
    return random() < sampling;
  };

  const load = async () => {
    if (recorder) return recorder;
    if (pending) return pending;
    const resolver = typeof importModule === 'function'
      ? importModule
      : (specifier) => import(/* @vite-ignore */ specifier);
    pending = (async () => {
      const mod = await resolver(REPLAY_MODULE_SPECIFIER);
      if (typeof mod.createRecorder !== 'function') {
        throw new Error('replay module does not expose createRecorder');
      }
      recorder = mod.createRecorder({ endpoint, fetchImpl, beacon });
      return recorder;
    })();
    return pending;
  };

  return {
    async maybeStart({ session, force = false } = {}) {
      if (started) return recorder;
      if (!force && !shouldSample()) return null;
      started = true;
      try {
        const instance = await load();
        if (instance && session) instance.start(session);
        return instance;
      } catch (error) {
        started = false;
        throw error;
      }
    },
    async stop() {
      if (recorder) recorder.stop();
      started = false;
    },
    get isActive() { return started && recorder !== null; },
  };
}

export { REPLAY_MODULE_SPECIFIER };
