# Implementation Tasks

## SDK Workspace & Monorepo Setup
- [x] Create the root `sdk/` directory with independent package descriptors for `@quasar/analytics-core` and `@quasar/analytics-replay`.
- [x] Configure a bundler pipeline (Vite/Rollup) outputting production-grade native ES6 modules (`.mjs`).

## Core Tracker Features (`@quasar/analytics-core`)
- [x] Implement the core telemetry client with automatic page-view detection and custom `quasar.capture()` hooks.
- [x] Add the Client Queue Manager using `localStorage` with automated batching criteria (flush every 2s or when payload counter hits 20).
- [x] Code the behavioral Rage Click algorithm monitoring high-frequency mutations.
- [x] Implement browser termination hooks via `navigator.sendBeacon` for closing frames.

## Replay Module & Heatmaps (`@quasar/analytics-replay`)
- [x] Implement the dynamic script loader inside the core bundle triggering asynchronous chunk fetching.
- [x] Build the `MutationObserver` layout wrapper recording DOM updates while filtering sensitive input values (`type="password"`, `data-quasar-mask`).
- [x] Build mouse position and scroll progression sampling workers (throttled at 50ms intervals).

## Backend Replay FaaS Engine
- [x] Scaffold `faas/replay-writer/` containing the Rust implementation framework.
- [x] Add the WASI-compliant `zstd` compression algorithm binding within `faas/replay-writer/Cargo.toml`.
- [x] Implement chunk processing logic in `faas/replay-writer/src/lib.rs` to persist compressed streams into RedDB targets.
- [x] Map the `/telemetry/replay` route path inside cluster deployment files (`manifests/quasar-core.yaml`).
