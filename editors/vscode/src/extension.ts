import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import * as path from 'node:path';

/** Shape of a finding in `agentlint --format json` output (see agentlint-core). */
interface Finding {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
}
interface LintResult {
  findings: Finding[];
}

let collection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext): void {
  collection = vscode.languages.createDiagnosticCollection('agentlint');
  context.subscriptions.push(collection);
  context.subscriptions.push(
    vscode.commands.registerCommand('agentlint.lintWorkspace', () => lintAll()),
    vscode.workspace.onDidSaveTextDocument(() => {
      const cfg = vscode.workspace.getConfiguration('agentlint');
      if (cfg.get<boolean>('runOnSave', true)) lintAll();
    }),
  );
  lintAll();
}

function lintAll(): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;
  for (const folder of folders) runLint(folder.uri.fsPath);
}

function severityOf(s: Finding['severity']): vscode.DiagnosticSeverity {
  if (s === 'error') return vscode.DiagnosticSeverity.Error;
  if (s === 'warning') return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
}

function runLint(root: string): void {
  const cfg = vscode.workspace.getConfiguration('agentlint');
  const command = cfg.get<string>('command', 'npx');
  const args =
    command === 'npx'
      ? ['-y', 'agentlint', '--format', 'json', '.']
      : ['--format', 'json', '.'];

  // agentlint exits 1 when it finds errors — that is a normal result on stdout,
  // not a spawn failure, so we parse stdout regardless of the exit code.
  execFile(command, args, { cwd: root, maxBuffer: 16 * 1024 * 1024 }, (_err, stdout) => {
    let result: LintResult;
    try {
      result = JSON.parse(stdout) as LintResult;
    } catch {
      return; // no parseable output (e.g. agentlint not installed) — leave diagnostics as-is
    }
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const f of result.findings ?? []) {
      const abs = path.resolve(root, f.file);
      const ln = Math.max(0, (f.line ?? 1) - 1);
      const col = Math.max(0, (f.column ?? 1) - 1);
      const range = new vscode.Range(ln, col, ln, col + 1);
      const diag = new vscode.Diagnostic(range, f.message, severityOf(f.severity));
      diag.source = 'agentlint';
      diag.code = f.ruleId;
      const list = byFile.get(abs) ?? [];
      list.push(diag);
      byFile.set(abs, list);
    }
    collection.clear();
    for (const [file, list] of byFile) collection.set(vscode.Uri.file(file), list);
  });
}

export function deactivate(): void {
  collection?.dispose();
}
