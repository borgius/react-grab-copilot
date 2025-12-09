import * as fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { readProjectStructureTool } from "../../../src/tools/fs/readProjectStructure";
import { createMockContext } from "../../setup";

vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
  },
}));

describe("readProjectStructureTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should read project structure", async () => {
    // Mock root directory
    (fs.promises.readdir as any).mockImplementation(async (path: string) => {
      if (path === "/mock/workspace") {
        return [
          { name: "src", isDirectory: () => true },
          { name: "package.json", isDirectory: () => false },
        ];
      }
      if (path.endsWith("src")) {
        return [{ name: "index.ts", isDirectory: () => false }];
      }
      return [];
    });

    const result = await readProjectStructureTool.execute({}, mockCtx);

    expect(result.text).toContain("src/");
    expect(result.text).toContain("package.json");
    expect(result.text).toContain("index.ts");
  });

  it("should throw error when no workspace", async () => {
    // Temporarily remove workspace folders
    const originalFolders = vscode.workspace.workspaceFolders;
    (vscode.workspace as any).workspaceFolders = undefined;

    await expect(readProjectStructureTool.execute({}, mockCtx)).rejects.toThrow(
      "No workspace open",
    );

    // Restore
    (vscode.workspace as any).workspaceFolders = originalFolders;
  });
});
