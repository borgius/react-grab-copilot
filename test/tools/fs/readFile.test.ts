import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { readFileTool } from "../../../src/tools/fs/readFile";
import { createMockContext } from "../../setup";

describe("readFileTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should read a file successfully", async () => {
    const mockContent = "Hello, world!";
    const mockDocument = {
      getText: vi.fn().mockReturnValue(mockContent),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.fs.stat as any).mockResolvedValue({}); // File exists

    const result = await readFileTool.execute(
      { filePath: "/path/to/file.txt" },
      mockCtx,
    );

    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(result.text).toContain(mockContent);
  });

  it("should throw error if file reading fails", async () => {
    const errorMessage = "File not found";
    (vscode.workspace.fs.stat as any).mockResolvedValue({});
    (vscode.workspace.openTextDocument as any).mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(
      readFileTool.execute({ filePath: "/path/to/file.txt" }, mockCtx),
    ).rejects.toThrow(errorMessage);
  });
});
