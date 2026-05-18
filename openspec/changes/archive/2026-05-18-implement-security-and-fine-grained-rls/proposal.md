# Proposal: Quasar Security - OIDC & Fine-Grained Wasm RLS

## Why
Now that the core analytical pipelines and developer control plane are scaffolded, Quasar requires a bulletproof, zero-trust security layer. Dashboards and reports stored as JSON must be viewable either anonymously (public access) or securely via OpenID Connect (OIDC). For authenticated views, access control must be enforced at the storage edge using Row-Level Security (RLS) dynamically compiled into the WebAssembly execution context, allowing granular filtering based on user claims (e.g., specific regions, departments, or business lines).

## What Changes
- Integrate OIDC token validation within the `telemetry-bridge` and `olap-engine` FaaS components.
- Implement dynamic Row-Level Security (RLS) filter injection inside the `olap-engine` and `view-builder` during RedDB operations.
- Update the Dashboard Manifest schema to support visibility configurations (`public`, `authenticated`, `restricted`).
- Enable OIDC authentication handling in the VanillaJS UI via the `<quasar-provider>` Web Component.

## Approach
Authentication will rely on standard OIDC identity providers. Once a JWT is received by the UI, it is passed in the Authorization header to the Tachyon mesh. The Wasm components will decode the claims and inject runtime security predicates (e.g., `region == user.claims.region`) directly into the data scan queries. If a dashboard is marked as `public`, data aggregation bypasses token checks but restricts queries to non-sensitive metrics defined by the dashboard manifest.
