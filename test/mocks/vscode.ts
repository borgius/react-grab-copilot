
const fs = require('fs');
const path = require('path');

class Uri {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  fsPath: string;

  constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = path;
  }

  static file(pathStr: string) {
    return new Uri('file', '', pathStr, '', '');
  }

  static parse(pathStr: string) {
    return new Uri('file', '', pathStr, '', '');
  }

  static joinPath(base: Uri, ...pathSegments: string[]) {
    return new Uri(base.scheme, base.authority, path.join(base.path, ...pathSegments), '', '');
  }
  
  toString() {
      return this.path;
  }
}

const workspace = {
  workspaceFolders: [{
    uri: Uri.file('/mock/workspace'),
    name: 'mock-workspace',
    index: 0
  }],
  fs: {
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    createDirectory: vi.fn(),
    readDirectory: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
  },
  openTextDocument: vi.fn(),
  applyEdit: vi.fn(),
  findFiles: vi.fn(),
  asRelativePath: vi.fn((uri) => uri.path),
};

const window = {
    createTerminal: vi.fn(() => ({
        sendText: vi.fn(),
        show: vi.fn(),
        exit: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
};

const commands = {
    executeCommand: vi.fn(),
};

const languages = {
    getDiagnostics: vi.fn(),
};

const Range = class {
    constructor(public startLine: number, public startCharacter: number, public endLine: number, public endCharacter: number) {}
};

const Position = class {
    constructor(public line: number, public character: number) {}
};

const WorkspaceEdit = class {
    replace = vi.fn();
    createFile = vi.fn();
    deleteFile = vi.fn();
    renameFile = vi.fn();
    insert = vi.fn();
};

const TextEdit = {
    replace: vi.fn(),
};

export const vscode = {
  Uri,
  workspace,
  window,
  commands,
  languages,
  Range,
  Position,
  WorkspaceEdit,
  TextEdit,
  DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
  },
  SymbolKind: {
      File: 0,
      Module: 1,
      Namespace: 2,
      Package: 3,
      Class: 4,
      Method: 5,
      Property: 6,
      Field: 7,
      Constructor: 8,
      Enum: 9,
      Interface: 10,
      Function: 11,
      Variable: 12,
      Constant: 13,
      String: 14,
      Number: 15,
      Boolean: 16,
      Array: 17,
      Object: 18,
      Key: 19,
      Null: 20,
      EnumMember: 21,
      Struct: 22,
      Event: 23,
      Operator: 24,
      TypeParameter: 25,
      0: 'File',
      1: 'Module',
      2: 'Namespace',
      3: 'Package',
      4: 'Class',
      5: 'Method',
      6: 'Property',
      7: 'Field',
      8: 'Constructor',
      9: 'Enum',
      10: 'Interface',
      11: 'Function',
      12: 'Variable',
      13: 'Constant',
      14: 'String',
      15: 'Number',
      16: 'Boolean',
      17: 'Array',
      18: 'Object',
      19: 'Key',
      20: 'Null',
      21: 'EnumMember',
      22: 'Struct',
      23: 'Event',
      24: 'Operator',
      25: 'TypeParameter',
  }
};
