# 🌌 Quasar Analytics

[![Built on Tachyon](https://img.shields.io/badge/Built_on-Tachyon-blueviolet.svg)](#)
[![WebAssembly Native](https://img.shields.io/badge/Runtime-WebAssembly-orange.svg)](#)
[![Language: Rust](https://img.shields.io/badge/Language-Rust-red.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#)

**Quasar** is an ultra-fast, edge-native product analytics platform designed to replace the bloated `Kafka -> ClickHouse -> Redis -> PostgreSQL` data stack. Built entirely on top of the [Tachyon-Mesh](#) and powered by WebAssembly (Wasm) and Rust, Quasar pushes data ingestion, OLAP processing, and even AI inference directly to the edge.

Get PostHog-level insights, funnel analysis, and real-time dashboards with zero infrastructure bloat and built-in GDPR compliance.

## ✨ Why Quasar?

Traditional product analytics architectures decouple storage and compute, forcing massive data movements over the network for every dashboard load. Quasar reverses this paradigm using **Compute Pushdown**: we send ephemeral Wasm filters directly to the storage layer. 

By leveraging the distributed nature of the Tachyon mesh, Quasar ensures that data is ingested, compressed, and queried exactly where the user is geographically located.

## 🚀 Core Features

*   **Gorilla-Compressed Timeseries:** The ingestion record layer bufferizes and compresses telemetry events using Delta-of-Delta compression, allowing nodes to ingest millions of events per second with minimal I/O overhead.
*   **Ephemeral Wasm OLAP Engine:** Complex funnel calculations and retention matrices are executed in memory by self-destructing Wasm modules, completely isolating heavy analytics from transactional traffic.
*   **Zero-Latency Dashboards ($O(1)$ reads):** Continuous CQRS view builders listen to Change Data Capture (CDC) streams in the background. Dashboards read pre-calculated materialized views instantly from RedDB.
*   **Edge-Native AI & Local RAG:** Utilize local inference via `system-faas-model-broker` to classify user feedback or predict churn directly on the edge node. No external API calls, ensuring absolute privacy.
*   **Dynamic Geo-Pinning:** Shards are naturally pinned to the European or local nodes closest to the user, ensuring strict data sovereignty and microsecond ingestion latency.

## 🏗️ Architecture overview

Quasar relies on a suite of FaaS components running on the Tachyon WebAssembly host:

1.  **`tachyon:telemetry/custom-metrics`**: The entry point for web/mobile SDKs. Validates JSON schemas and routes payloads.
2.  **`system-faas-timeseries`**: The high-density storage engine writing chunks to RedDB.
3.  **`system-faas-olap-engine`**: The ephemeral query engine for ad-hoc funnel analysis.
4.  **`system-faas-view-builder`**: Background worker maintaining real-time JSON views for fast dashboard rendering.

## 📦 Quick Start

### Prerequisites
*   A running instance of [Tachyon-Mesh](#)
*   The `tachyon-cli` installed

### Deployment

Deploy the Quasar subsystem to your Tachyon cluster:

```bash
# 1. Deploy the storage and ingestion layer
tachyon apply -f quasar-core.yaml

# 2. Deploy the CQRS view builders and OLAP engine
tachyon apply -f quasar-analytics.yaml

# 3. Mount the real-time UI
tachyon mount quasar-ui --port 8080
```

### Sending your first event

```bash
curl -X POST https://your-tachyon-edge/telemetry/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "distinct_id": "user_12345",
    "event": "button_click",
    "properties": {
      "element_id": "signup_hero",
      "os": "linux"
    },
    "timestamp": "2026-05-17T21:32:53Z"
  }'
```

## 🧠 Smart Telemetry & AI

Quasar integrates natively with Tachyon's inference engine. By enabling the `auto_classify` feature in your project config, Quasar will spawn local LLM workers to perform sentiment analysis on free-text events (e.g., NPS surveys or bug reports) without ever sending user data to third-party providers.

## 🤝 Contributing

Quasar is an open-source project. Whether you are an expert in systems architecture, Wasm compilation, or UX design, contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a Pull Request.

---
*Built with speed, privacy, and gravity-defying performance.*