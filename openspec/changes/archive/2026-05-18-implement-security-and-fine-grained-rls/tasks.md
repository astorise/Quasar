# Implementation Tasks

## Phase 1: Schema & Manifest Updates
- [x] Update `schemas/dashboard-manifest.schema.json` to include the `security` block (`visibility`, `allowed_roles`, `enforced_filters`).
- [x] Create a sample secured dashboard manifest (`manifests/regional-sales.dashboard.json`).

## Phase 2: FaaS Security Core (Rust/Wasm)
- [x] Add JWT parsing and verification logic to `faas/olap-engine/Cargo.toml` and `faas/telemetry-bridge/Cargo.toml`.
- [x] Implement token claims extraction helper inside a shared module or directly within `wit/`.
- [x] Refactor `faas/olap-engine/src/lib.rs` to intercept the query payload and inject the authorization predicates based on user `scope_filters`.
- [x] Update `faas/view-builder/src/lib.rs` to ensure multi-tenant isolation when building materialized views for restricted profiles.

## Phase 3: Frontend Integration (VanillaJS)
- [x] Update `ui/src/components/quasar-provider.js` to support OIDC configuration parameters (client_id, authority).
- [x] Implement token storage (sessionStorage) and automated silent token refresh in the provider.
- [x] Modify the data fetching mechanism inside `<quasar-timeseries-chart>` to dynamically include the token from the parent provider.
- [x] Handle `401 Unauthorized` and `403 Forbidden` error states gracefully with GSAP visual transitions on the UI cards.
