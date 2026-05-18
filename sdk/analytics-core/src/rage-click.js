export const RAGE_CLICK_THRESHOLD = 3;
export const RAGE_CLICK_WINDOW_MS = 800;

export function createRageClickDetector({
  threshold = RAGE_CLICK_THRESHOLD,
  windowMs = RAGE_CLICK_WINDOW_MS,
} = {}) {
  let lastTarget = null;
  let count = 0;
  let firstTimestamp = 0;

  const reset = (target, timestamp) => {
    lastTarget = target;
    firstTimestamp = timestamp;
    count = 1;
  };

  return {
    /**
     * Record a click and return a rage-click descriptor when the threshold is exceeded.
     * Returns null otherwise.
     */
    record({ target, timestamp = Date.now(), unhandled = true }) {
      if (!unhandled || !target) {
        lastTarget = null;
        count = 0;
        return null;
      }
      if (target !== lastTarget || timestamp - firstTimestamp > windowMs) {
        reset(target, timestamp);
        return null;
      }
      count += 1;
      if (count > threshold) {
        const result = {
          target,
          count,
          windowMs: timestamp - firstTimestamp,
          firstTimestamp,
          lastTimestamp: timestamp,
        };
        // After firing, consume the streak so a single extra click doesn't refire.
        reset(target, timestamp);
        return result;
      }
      return null;
    },
    reset() {
      lastTarget = null;
      count = 0;
      firstTimestamp = 0;
    },
    get state() {
      return { lastTarget, count, firstTimestamp };
    },
  };
}
