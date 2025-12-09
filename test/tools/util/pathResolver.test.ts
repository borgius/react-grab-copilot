import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { resolvePath } from "../../../src/tools/util/pathResolver";

describe("resolvePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset workspace folders to default
    (vscode.workspace as any).workspaceFolders = [
      {
        uri: vscode.Uri.file("/mock/workspace"),
        name: "mock-workspace",
        index: 0,
      },
    ];
  });

  it("should resolve workspace-relative path when input starts with /", async () => {
    const input = "/src/file.ts";
    const expectedPath = "/mock/workspace/src/file.ts";

    (vscode.workspace.fs.stat as any).mockImplementation(async (uri: any) => {
      if (uri.fsPath === expectedPath) return {};
      throw new Error("File not found");
    });

    const result = await resolvePath(input);
    expect(result.fsPath).toBe(expectedPath);
  });

  it("should resolve workspace-relative path when input is relative", async () => {
    const input = "src/file.ts";
    const expectedPath = "/mock/workspace/src/file.ts";

    (vscode.workspace.fs.stat as any).mockImplementation(async (uri: any) => {
      if (uri.fsPath === expectedPath) return {};
      throw new Error("File not found");
    });

    const result = await resolvePath(input);
    expect(result.fsPath).toBe(expectedPath);
  });

  it("should resolve absolute path if not found in workspace", async () => {
    const input = "/tmp/file.ts";

    (vscode.workspace.fs.stat as any).mockImplementation(async (uri: any) => {
      if (uri.fsPath === input) return {};
      throw new Error("File not found");
    });

    const result = await resolvePath(input);
    expect(result.fsPath).toBe(input);
  });

  it("should fallback to workspace path if file does not exist anywhere and checkExists is false", async () => {
    const input = "/src/new.ts";
    const expectedPath = "/mock/workspace/src/new.ts";

    (vscode.workspace.fs.stat as any).mockRejectedValue(
      new Error("File not found"),
    );

    const result = await resolvePath(input, false);
    expect(result.fsPath).toBe(expectedPath);
  });

  it("should throw if file does not exist and checkExists is true", async () => {
    const input = "/src/nonexistent.ts";

    (vscode.workspace.fs.stat as any).mockRejectedValue(
      new Error("File not found"),
    );

    await expect(resolvePath(input, true)).rejects.toThrow("File not found");
  });

  it("should handle no workspace folders", async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const input = "/tmp/file.ts";

    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await resolvePath(input);
    expect(result.fsPath).toBe(input);
  });
});
