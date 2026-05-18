# Proposal: Quasar AI Control Plane (MCP & VS Code)

## Why
With the core FaaS analytics engine scaffolded, Quasar needs its administration interface. Instead of a traditional monolithic web UI for configuration, Quasar relies on a "Dashboard-as-Code" paradigm. The intent of this change is to build the Model Context Protocol (MCP) server and the VS Code extension, allowing AI agents to seamlessly read telemetry schemas and autonomously generate dashboard manifests directly within the IDE.

## What Changes
- Implement the `quasar-mcp` Node.js server with tools to list and read JSON schemas.
- Implement the `quasar-vscode` extension to handle dashboard manifest validation and lifecycle.
- Integrate the VS Code extension with the `tachyon-cli` to sync JSON manifests directly to the RedDB storage edge.

## Approach
The control plane is decoupled from the visualization layer. The MCP server will expose our custom JSON schemas (`telemetry-event` and `dashboard-manifest`) as resources/tools. The VS Code extension will provide syntax highlighting, validation, and a command to deploy the JSON files to the Tachyon mesh, adhering strictly to the developer-first, lightweight ethos of the project.
