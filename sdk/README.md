# Quasar Client SDK

Modular ES6 telemetry SDK for the Quasar edge-native analytics platform.

| Package | Role | Bundle target |
| --- | --- | --- |
| [`@quasar/analytics-core`](./analytics-core) | Bootstraps a tracker, owns session identity, batches and flushes telemetry to `/telemetry/ingest`, detects rage clicks, dynamically imports the replay module on demand. | < 5 KB gzipped |
| [`@quasar/analytics-replay`](./analytics-replay) | Lazy-loaded recorder. Subscribes a `MutationObserver`, samples mouse and scroll positions, ships DOM diffs to `/telemetry/replay`. | Loaded on demand |

Both packages emit production-grade native ES6 modules (`.mjs`) via a Rollup pipeline (see [`rollup.config.mjs`](./rollup.config.mjs)). No framework, no runtime dependency.

## Layout
```
sdk/
├── analytics-core/
│   ├── src/
│   └── package.json
├── analytics-replay/
│   ├── src/
│   └── package.json
├── rollup.config.mjs
└── package.json
```

## Build
```bash
npm --workspace sdk install
npm --workspace sdk run build
```

## Sending a custom event
```html
<script type="module">
  import { createTracker } from '/sdk/analytics-core/dist/quasar-core.mjs';

  const tracker = createTracker({
    endpoint: 'https://edge.quasar.example/telemetry/ingest',
    replayEndpoint: 'https://edge.quasar.example/telemetry/replay',
    replaySampling: 0.1,
  });

  tracker.capture('signup_completed', { plan: 'pro' });
</script>
```
