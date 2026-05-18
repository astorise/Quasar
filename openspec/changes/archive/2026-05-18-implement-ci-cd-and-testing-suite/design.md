# Design: Monorepo Testing Matrix & Artifact Distribution

## 1. Multi-Tier Testing Strategy
To safeguard the system's strict architectural constraints, verification is segmented into three decoupled rings:

```
+------------------------------------------------------------+
|                     E2E Testing Layer                      |
|      (Playwright: SDK Ingest -> FaaS Mesh -> UI Reflow)    |
+------------------------------+-----------------------------+
                               |
                               ▼
+------------------------------------------------------------+
|                  Integration Testing Layer                 |
|       (Rust WASI Test Harnesses & RedDB Shard Mocking)     |
+------------------------------+-----------------------------+
                               |
                               ▼
+------------------------------------------------------------+
|                     Unit Testing Layer                     |
|         (Cargo Test / Node / Workspace Check Scripts)      |
+------------------------------------------------------------+
```

* **Unit Layer:** Native `cargo test` validations for business-critical algorithms (e.g., Gorilla compression logic in `timeseries-writer`, Zstd layout diffing in `replay-writer`).
* **Integration Layer:** Validates interface mappings across WebAssembly component boundaries using WIT definitions (`ingestion.wit`, `query.wit`). Mock nodes will verify proper token verification and Row-Level Security injection.
* **E2E Layer:** Headless validation engine. It initializes the browser tracking runtime, fires a sequence of mock customer gestures (triggering a `$rage_click`), asserts proper compressed serialization, and confirms real-time numerical adjustments on `<quasar-metric-card>` components.

## 2. CI/CD Matrix & Artifact Delivery Architecture
The distribution pipeline handles heterogeneous builds concurrently via a structured GitHub Actions orchestrator (`.github/workflows/ci.yaml`):

1.  **FaaS Compilation:** Builds Rust code targeting `wasm32-wasip2` and outputs optimized byte-code components.
2.  **SDK Distribution:** Bundles tree-shaken, unified `.mjs` production files for downstream applications.
3.  **Tooling Compilation:** Packages the TypeScript node environment for `quasar-mcp` and builds the extension artifact (`.vsix`) for `quasar-vscode`.
4.  **Release Engine:** Upon successful tags, builds are compiled, sealed, and prepared for instant installation on edge cluster nodes via `tachyon apply`.