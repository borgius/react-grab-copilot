import * as cp from "child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { scmChangesTool } from "../../../src/tools/scm/scmChanges";
import { createMockContext } from "../../setup";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

describe("scmChangesTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get git changes", async () => {
    (cp.exec as any).mockImplementation((cmd, opts, cb) => {
      cb(null, "diff content", "");
    });

    const result = await scmChangesTool.execute({}, mockCtx);

    expect(cp.exec).toHaveBeenCalledWith(
      "git diff HEAD",
      expect.anything(),
      expect.anything(),
    );
    expect(result.text).toBe("diff content");
  });

  it("should handle no changes", async () => {
    (cp.exec as any).mockImplementation((cmd, opts, cb) => {
      cb(null, "", "");
    });

    const result = await scmChangesTool.execute({}, mockCtx);

    expect(result.text).toBe("No changes found.");
  });

  it("should throw error on git failure", async () => {
    (cp.exec as any).mockImplementation((cmd, opts, cb) => {
      cb(new Error("Git failed"), "", "stderr");
    });

    await expect(scmChangesTool.execute({}, mockCtx)).rejects.toThrow(
      "Git error: Git failed",
    );
  });

  it("should throw error when no workspace", async () => {
    const originalFolders = vscode.workspace.workspaceFolders;
    (vscode.workspace as any).workspaceFolders = undefined;

    await expect(scmChangesTool.execute({}, mockCtx)).rejects.toThrow(
      "No workspace open",
    );

    (vscode.workspace as any).workspaceFolders = originalFolders;
  });
});
