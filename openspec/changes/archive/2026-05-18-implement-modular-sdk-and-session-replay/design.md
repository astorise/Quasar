# Design: Modular Data Collection & Session Compression Architecture

## 1. Modular Client Infrastructure (`sdk/`)
The client tracking system is isolated from the main dashboard UI and organized as an ES6 monorepo package structure:
- **`@quasar/analytics-core`**: Initialized on the client application. Manages session identity, batch orchestration, storage queues, and standard telemetry (clicks, custom events).
- **`@quasar/analytics-replay`**: Lazy-loaded module. Spawns high-frequency window listeners for mouse movements/scrolling and constructs structural DOM delta patches.

## 2. Dynamic Recording & Ingestion Architecture
1. **Rage Click Validation**: Core tracker registers consecutive clicks (>3 clicks within 800ms on the same unhandled DOM element) and flags a `rage_click` event.
2. **Replay Ingestion Path**: The Tachyon mesh intercepts data aimed at `/telemetry/replay` and assigns the execution thread exclusively to the `replay-writer` FaaS.
3. **Dual-Compression Storage Logic**: 
   - Numerical data streams (timestamps, X/Y mouse coordinates) inside the replay payload are packed via Delta-of-Delta (Gorilla).
   - Structural text snapshots (HTML/JSON DOM diffs) are compressed using native Wasm-compiled `zstd` blocks before being saved into RedDB under the `replay:<session_id>` partition.

## 3. Heatmap Data Aggregation
To render click maps and scroll maps in the VanillaJS front-end, the `olap-engine` compiles atomic interaction events containing absolute coordinate values (`x_ratio`, `y_ratio` relative to viewport bounds) rather than parsing raw video playbacks, ensuring extreme performance.