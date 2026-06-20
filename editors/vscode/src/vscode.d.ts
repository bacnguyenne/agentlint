// Minimal ambient declaration of the VS Code API surface this extension uses,
// so `tsc --noEmit` verifies the code offline without installing @types/vscode.
// At build/publish time the real `@types/vscode` (a devDependency) is installed.
declare module 'vscode' {
  export interface Disposable {
    dispose(): void;
  }
  export interface Uri {
    readonly fsPath: string;
  }
  export namespace Uri {
    function file(path: string): Uri;
  }
  export interface ExtensionContext {
    readonly subscriptions: { push(...items: Disposable[]): void };
  }
  export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
  }
  export class Range {
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  }
  export class Diagnostic {
    source?: string;
    code?: string | number;
    constructor(range: Range, message: string, severity?: DiagnosticSeverity);
  }
  export interface DiagnosticCollection extends Disposable {
    set(uri: Uri, diagnostics: Diagnostic[]): void;
    clear(): void;
  }
  export interface WorkspaceConfiguration {
    get<T>(section: string, defaultValue: T): T;
  }
  export interface WorkspaceFolder {
    readonly uri: Uri;
  }
  export namespace languages {
    function createDiagnosticCollection(name?: string): DiagnosticCollection;
  }
  export namespace commands {
    function registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
  }
  export namespace workspace {
    const workspaceFolders: readonly WorkspaceFolder[] | undefined;
    function onDidSaveTextDocument(listener: (doc: unknown) => unknown): Disposable;
    function getConfiguration(section?: string): WorkspaceConfiguration;
  }
}
