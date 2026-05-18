# Design: Quasar Control Plane Architecture

## 1. The MCP Server (`quasar-mcp`)
The MCP server acts as the bridge between LLM coding agents (like Claude Code or Codex-CLI) and the Quasar project structure.
* **Resources:** Exposes `schemas/` directory contents.
* **Tools:**
    * `list_schemas`: Returns available schema definitions.
    * `get_telemetry_schema`: Returns the exact expected payload for edge events.
    * `validate_dashboard`: A tool for the LLM to verify if its generated JSON dashboard matches the Quasar specification before saving.

## 2. The VS Code Extension (`quasar-vscode`)
A lightweight TypeScript extension focused on Developer Experience (DX).
* **Contributions:** Registers the `quasar.syncDashboard` command.
* **Validation:** Automatically binds the `dashboard-manifest.schema.json` to any file matching `*.dashboard.json` for native IDE intellisense.
* **Deployment Flow:** When "Sync Dashboard" is triggered, the extension reads the active JSON editor, authenticates with the local Tachyon CLI, and pushes the manifest to the `system-faas-view-builder` configuration space.