# Proposal: Modular ES6 Telemetry SDK & Dedicated Session Replay Engine

## Why
Quasar already ships a backend ingestion pipeline, an OIDC-secured query path, a control plane and a VanillaJS UI, but it still lacks the actual data-collection layer that closes the loop with real-world web applications. To deliver advanced Microsoft Clarity-like capabilities (Session Replay, Heatmaps, Rage Clicks tracking) without compromising on bundle size or ingestion performance, the client SDK must be split into modular ES6 packages with lazy-loading, and the backend needs a dedicated WebAssembly FaaS component (`replay-writer`) that handles heavy structural DOM snapshots using text-optimized compression (Zstd) so primary telemetry stays fast.

## What Changes
- Setup the modular ES6 tracking codebase under `sdk/` divided into `@quasar/analytics-core` and `@quasar/analytics-replay`.
- Implement automated behavioral tracking (Pageviews, Autocapture, and Rage Clicks detection).
- Create the `faas/replay-writer/` Rust/Wasm component optimized for heavy string-based DOM diff streaming.
- Establish the edge routing policy for `/telemetry/replay` within Tachyon manifests.

## Approach
The core tracker package will remain below 5KB gzipped, capturing only atomic interactions and routing them to `/telemetry/ingest`. If session recording is active or sampled, the core tracker dynamically loads the replay ES6 module via a native `import()`. This module captures DOM mutations via a customized `MutationObserver` loop. Payload delivery utilizes browser storage queueing and `navigator.sendBeacon` for zero-data-loss page unloads. On the backend, `/telemetry/replay` is mounted on the Tachyon mesh and isolated onto the `replay-writer` FaaS, which streams Zstd-compressed DOM diffs directly into the `replay:<session_id>` partition of RedDB.
