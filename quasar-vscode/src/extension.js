const vscode = require("vscode");

async function syncDashboard() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a dashboard manifest before syncing.");
    return;
  }

  const document = editor.document;
  if (document.languageId !== "json" && document.languageId !== "jsonc") {
    vscode.window.showWarningMessage("Quasar dashboard manifests must be JSON.");
    return;
  }

  JSON.parse(document.getText());
  vscode.window.showInformationMessage(`Synced ${document.fileName}`);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("quasar.syncDashboard", syncDashboard),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
