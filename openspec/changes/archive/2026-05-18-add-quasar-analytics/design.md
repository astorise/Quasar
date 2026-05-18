# Design: Quasar Architecture

## Monorepo Layout
The project will be structured to maintain strict synchronization between Wasm components, schemas, and the UI:

*   `faas/`: Rust-based WebAssembly Edge Components.
    *   `telemetry-bridge/`: Schema validation and OIDC token processing.
    *   `timeseries-writer/`: Gorilla Delta-of-Delta compression to RedDB.
    *   `olap-engine/`: Ephemeral funnel calculation.
    *   `view-builder/`: CDC listener for CQRS materialized views.
*   `quasar-cli/`: Local CLI tool for mesh management.
*   `quasar-mcp/`: MCP Server exposing telemetry and UI specs to LLM agents.
*   `quasar-vscode/`: VS Code Extension for JSON dashboard sync.
*   `ui/`: VanillaJS frontend with Custom Web Components.
*   `wit/`: WebAssembly Component Model interfaces.
*   `manifests/`: Deployment YAMLs for Tachyon.

## Security & Rendering Paradigm
1.  **Authentication:** OIDC via standard providers. JWTs are translated into internal capability tokens (Biscuit).
2.  **Row-Level Security (RLS):** Wasm filters injected directly at the RedDB storage layer based on user claims.
3.  **UI Rendering:** $O(1)$ reads from RedDB materialized views feeding directly into `<quasar-chart>` Web Components. No VDOM overhead.