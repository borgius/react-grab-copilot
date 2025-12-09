import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { getErrorsTool } from "../../../src/tools/diagnostics/getErrors";
import { createMockContext } from "../../setup";

describe("getErrorsTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get errors for all files", async () => {
    const mockDiagnostics = [
      [
        { path: "/path/to/file.ts" },
        [
          {
            severity: vscode.DiagnosticSeverity.Error,
            message: "Error message",
            range: { start: { line: 0 } },
          },
          {
            severity: vscode.DiagnosticSeverity.Warning,
            message: "Warning message",
            range: { start: { line: 1 } },
          },
        ],
      ],
    ];
    (vscode.languages.getDiagnostics as any).mockReturnValue(mockDiagnostics);

    const result = await getErrorsTool.execute({}, mockCtx);

    expect(vscode.languages.getDiagnostics).toHaveBeenCalled();
    expect(result.text).toContain("Error message");
    expect(result.text).not.toContain("Warning message");
  });

  it("should get errors for specific file", async () => {
    const mockDiagnostics = [
      {
        severity: vscode.DiagnosticSeverity.Error,
        message: "Specific error",
        range: { start: { line: 5 } },
      },
    ];
    (vscode.languages.getDiagnostics as any).mockReturnValue(mockDiagnostics);
    (vscode.workspace.fs.stat as any).mockResolvedValue({});

    const result = await getErrorsTool.execute(
      { filePath: "/path/to/file.ts" },
      mockCtx,
    );

    expect(vscode.languages.getDiagnostics).toHaveBeenCalled();
    expect(result.text).toContain("Specific error");
  });

  it("should handle no errors", async () => {
    (vscode.languages.getDiagnostics as any).mockReturnValue([]);

    const result = await getErrorsTool.execute({}, mockCtx);

    expect(result.text).toBe("No errors found.");
  });
});
