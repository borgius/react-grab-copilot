import * as cp from "child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runTerminalCommandTool } from "../../../src/tools/terminal/runCommand";
import { createMockContext } from "../../setup";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

describe("runTerminalCommandTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run command", async () => {
    (cp.exec as any).mockImplementation((cmd, opts, cb) => {
      cb(null, "command output", "");
    });

    const result = await runTerminalCommandTool.execute(
      { command: "echo hello" },
      mockCtx,
    );

    expect(cp.exec).toHaveBeenCalledWith(
      "echo hello",
      expect.anything(),
      expect.anything(),
    );
    expect(result.text).toBe("command output");
  });

  it("should throw error on failure", async () => {
    (cp.exec as any).mockImplementation((cmd, opts, cb) => {
      cb(new Error("Command failed"), "", "stderr");
    });

    await expect(
      runTerminalCommandTool.execute({ command: "fail" }, mockCtx),
    ).rejects.toThrow("Command failed: Command failed");
  });

  it("should throw error when no workspace", async () => {
    const vscode = await import("vscode");
    const originalFolders = vscode.workspace.workspaceFolders;
    (vscode.workspace as any).workspaceFolders = undefined;

    await expect(
      runTerminalCommandTool.execute({ command: "echo hello" }, mockCtx),
    ).rejects.toThrow("No workspace open");

    (vscode.workspace as any).workspaceFolders = originalFolders;
  });
});
