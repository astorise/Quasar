const vscode = require("vscode");
const { execFile } = require("child_process");

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

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

  let manifest;
  try {
    manifest = JSON.parse(document.getText());
  } catch (error) {
    vscode.window.showErrorMessage(`Invalid dashboard JSON: ${error.message}`);
    return;
  }

  if (!manifest.id || typeof manifest.id !== "string") {
    vscode.window.showErrorMessage("Dashboard manifest must include a string id.");
    return;
  }

  await document.save();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = "$(sync~spin) Syncing Quasar dashboard";
  status.show();

  try {
    await execFileAsync("tachyon", ["config", "put", manifest.id, document.fileName]);
    status.text = "$(check) Quasar dashboard synced";
    vscode.window.showInformationMessage(`Synced dashboard ${manifest.id}`);
  } catch (error) {
    const details = (error.stderr || error.message || "").trim();
    status.text = "$(error) Quasar sync failed";
    vscode.window.showErrorMessage(`Quasar sync failed${details ? `: ${details}` : ""}`);
  } finally {
    setTimeout(() => status.dispose(), 5000);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("quasar.syncDashboard", syncDashboard),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
