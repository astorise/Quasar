const SAMPLE_INTERVAL_MS = 50;

export function createInteractionSampler({
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  intervalMs = SAMPLE_INTERVAL_MS,
  onSample,
  now = () => Date.now(),
} = {}) {
  if (typeof onSample !== 'function') throw new Error('interaction-sampler: onSample is required');

  let lastPointer = null;
  let lastScroll = null;
  let timer = null;
  const cleanups = [];

  const flush = () => {
    timer = null;
    const samples = [];
    if (lastPointer) {
      samples.push({ kind: 'pointer', ts: now(), ...lastPointer });
      lastPointer = null;
    }
    if (lastScroll) {
      samples.push({ kind: 'scroll', ts: now(), ...lastScroll });
      lastScroll = null;
    }
    if (samples.length > 0) onSample(samples);
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(flush, intervalMs);
  };

  const onPointer = (event) => {
    const width = win && win.innerWidth ? win.innerWidth : 1;
    const height = win && win.innerHeight ? win.innerHeight : 1;
    lastPointer = {
      x: event.clientX,
      y: event.clientY,
      x_ratio: event.clientX / width,
      y_ratio: event.clientY / height,
    };
    schedule();
  };

  const onScroll = () => {
    const scroller = doc && doc.scrollingElement ? doc.scrollingElement : doc?.documentElement;
    const top = (scroller && scroller.scrollTop) || (win && win.scrollY) || 0;
    const height = (scroller && scroller.scrollHeight) || 1;
    lastScroll = {
      top,
      ratio: Math.min(1, top / Math.max(1, height - (win?.innerHeight ?? 0))),
    };
    schedule();
  };

  return {
    start() {
      if (!win) return;
      win.addEventListener('pointermove', onPointer, { passive: true });
      win.addEventListener('scroll', onScroll, { passive: true, capture: true });
      cleanups.push(() => win.removeEventListener('pointermove', onPointer));
      cleanups.push(() => win.removeEventListener('scroll', onScroll, { capture: true }));
    },
    stop() {
      while (cleanups.length) cleanups.pop()();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      lastPointer = null;
      lastScroll = null;
    },
  };
}

export { SAMPLE_INTERVAL_MS };
