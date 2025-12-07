import { describe, it, expect, vi, beforeEach } from "vitest";
import { editFileTool } from "../../../src/tools/edit/editFile";
import { createMockContext } from "../../setup";
import * as vscode from "vscode";

describe("editFileTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should edit an existing file", async () => {
    const mockDocument = {
      getText: vi.fn().mockReturnValue("old content"),
      positionAt: vi.fn(),
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await editFileTool.execute(
      { filePath: "/path/to/file.txt", newContent: "new content" },
      mockCtx,
    );

    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    expect(mockDocument.save).toHaveBeenCalled();
    expect(result.text).toContain("Edited:");
  });

  it("should create a new file if it does not exist", async () => {
    // First openTextDocument fails
    (vscode.workspace.openTextDocument as any).mockRejectedValueOnce(
      new Error("File not found"),
    );
    // Second openTextDocument succeeds (after creation)
    const mockDocument = {
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await editFileTool.execute(
      { filePath: "/path/to/newfile.txt", newContent: "content" },
      mockCtx,
    );

    // Should try to create file via WorkspaceEdit
    // Note: The implementation calls edit.createFile and edit.insert
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    expect(result.text).toContain("Edited:");
  });
});
