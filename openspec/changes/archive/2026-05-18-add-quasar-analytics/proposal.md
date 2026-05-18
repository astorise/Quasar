# Proposal: Quasar - Edge-Native Product Analytics

## Why
Modern product analytics rely on heavy, centralized data stacks (Kafka, ClickHouse, Redis) which introduce latency and compliance challenges. The intent of this change is to create **Quasar**, a lightweight, edge-native product analytics platform built on the Tachyon WebAssembly mesh. It will allow instantaneous OLAP queries and CQRS materialized views executed directly at the storage edge.

## What Changes
- Setup the Quasar monorepo structure.
- Implement the telemetry ingestion pipeline via Wasm.
- Implement the ephemeral OLAP Wasm engine for funnel calculations.
- Create an MCP (Model Context Protocol) server to expose telemetry schemas.
- Create a VS Code extension for Dashboard-as-Code administration.
- Develop a VanillaJS + WebComponents frontend.

## Approach
Quasar will bypass traditional frontend frameworks, relying entirely on native Web Components, TailwindCSS, and GSAP. Administration and dashboard generation (JSON) will be delegated to the IDE via the VS Code extension and the MCP server. Security and row-level filtering will be enforced natively via OIDC tokens passed down to the Wasm storage components.
