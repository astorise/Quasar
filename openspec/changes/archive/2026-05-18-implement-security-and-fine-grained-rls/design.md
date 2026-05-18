# Design: OIDC and WebAssembly Row-Level Security

## 1. Token Translation & Claims Extraction
When a request hits a Tachyon node running Quasar components:
1. The `telemetry-bridge` or `olap-engine` intercepts the `Authorization: Bearer <JWT>` header.
2. The component extracts custom claims from the token, specifically:
   - `roles`: Authorization groups (e.g., `admin`, `viewer`).
   - `scope_filters`: Key-value pairs defining data boundaries (e.g., `region: "nouvelle-aquitaine"`, `department: "electronics"`).

## 2. Compute Pushdown RLS Injection
Instead of checking permissions after reading rows from RedDB, security filters are pushed directly into the NVMe data stream:
- The `olap-engine` receives an ad-hoc query from the UI (e.g., "Calculate conversion funnel").
- If the user's `scope_filters` contain a restriction, the engine modifies the internal AST (Abstract Syntax Tree) of the query *before* execution.
- A mandatory filtering clause is appended to the Wasm filter module sent to the storage node, ensuring unauthorized rows never leave the physical disk node.

## 3. UI Multi-Mode Visibility
The `<quasar-provider>` will manage the application's global security state:
- **Anonymous Mode:** Fetches manifests marked `visibility: "public"`. If a metric query requires higher privileges, the backend returns an empty dataset or an obfuscated aggregate.
- **Authenticated Mode:** Redirects to the OIDC provider, maintains token renewal, and automatically appends the bearer token to all subsequent data fetches.