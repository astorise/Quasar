# Implementation Tasks

- [x] Scaffold the `quasar` monorepo directory structure as defined in `design.md`.
- [x] Define the base Wasm Interface Types (`wit/ingestion.wit`, `wit/query.wit`).
- [x] Create JSON Schemas for Telemetry Events and Dashboard Manifests in `schemas/`.
- [x] Implement the `telemetry-bridge` FaaS component in Rust.
- [x] Implement the `timeseries-writer` FaaS component with basic chunking logic.
- [x] Implement the `view-builder` FaaS component to consume CDC streams from RedDB.
- [x] Build the `quasar-mcp` Node.js server to expose JSON schemas to AI coding agents.
- [x] Develop the `quasar-vscode` extension for dashboard manifest synchronization.
- [x] Setup the VanillaJS UI build pipeline (Vite, Tailwind).
- [x] Implement core Web Components (`<quasar-provider>`, `<quasar-timeseries-chart>`).
- [x] Integrate OIDC authentication and map claims to Wasm RLS execution.
