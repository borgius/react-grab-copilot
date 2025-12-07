import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyPatchTool } from "../../../src/tools/edit/applyPatch";
import { createMockContext } from "../../setup";
import * as vscode from "vscode";

describe("applyPatchTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should apply a simple patch to a file", async () => {
    const originalContent = `line 1
line 2
line 3
line 4`;

    const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,4 +1,4 @@
 line 1
-line 2
+line 2 modified
 line 3
 line 4`;

    const mockDocument = {
      getText: vi.fn().mockReturnValue(originalContent),
      positionAt: vi.fn().mockImplementation((offset: number) => ({
        line: 0,
        character: offset,
      })),
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await applyPatchTool.execute(
      { patch, basePath: "/project" },
      mockCtx,
    );

    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    expect(result.text).toContain("1 file(s) succeeded");
    expect(result.text).toContain("0 file(s) failed");
  });

  it("should apply a patch with additions", async () => {
    const originalContent = `line 1
line 2`;

    const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,4 @@
 line 1
+new line a
+new line b
 line 2`;

    const mockDocument = {
      getText: vi.fn().mockReturnValue(originalContent),
      positionAt: vi.fn().mockImplementation((offset: number) => ({
        line: 0,
        character: offset,
      })),
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await applyPatchTool.execute({ patch }, mockCtx);

    expect(result.text).toContain("1 file(s) succeeded");
  });

  it("should apply a patch with deletions", async () => {
    const originalContent = `line 1
line 2
line 3
line 4`;

    const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,4 +1,2 @@
 line 1
-line 2
-line 3
 line 4`;

    const mockDocument = {
      getText: vi.fn().mockReturnValue(originalContent),
      positionAt: vi.fn().mockImplementation((offset: number) => ({
        line: 0,
        character: offset,
      })),
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await applyPatchTool.execute({ patch }, mockCtx);

    expect(result.text).toContain("1 file(s) succeeded");
  });

  it("should handle multiple hunks", async () => {
    const originalContent = `line 1
line 2
line 3
line 4
line 5`;

    const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
-line 1
+line 1 modified
 line 2
@@ -4,2 +4,2 @@
 line 4
-line 5
+line 5 modified`;

    const mockDocument = {
      getText: vi.fn().mockReturnValue(originalContent),
      positionAt: vi.fn().mockImplementation((offset: number) => ({
        line: 0,
        character: offset,
      })),
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await applyPatchTool.execute({ patch }, mockCtx);

    expect(result.text).toContain("1 file(s) succeeded");
    expect(result.text).toContain("2 hunks");
  });

  it("should throw error for invalid patch", async () => {
    const patch = `This is not a valid patch`;

    await expect(
      applyPatchTool.execute({ patch }, mockCtx),
    ).rejects.toThrowError(/No valid patches found/);
  });

  it("should handle git diff format", async () => {
    const originalContent = `function hello() {
  console.log("hello");
}`;

    const patch = `diff --git a/src/hello.js b/src/hello.js
--- a/src/hello.js
+++ b/src/hello.js
@@ -1,3 +1,3 @@
 function hello() {
-  console.log("hello");
+  console.log("hello world");
 }`;

    const mockDocument = {
      getText: vi.fn().mockReturnValue(originalContent),
      positionAt: vi.fn().mockImplementation((offset: number) => ({
        line: 0,
        character: offset,
      })),
      save: vi.fn(),
    };
    (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
    (vscode.workspace.applyEdit as any).mockResolvedValue(true);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await applyPatchTool.execute({ patch }, mockCtx);

    expect(result.text).toContain("1 file(s) succeeded");
  });
});
