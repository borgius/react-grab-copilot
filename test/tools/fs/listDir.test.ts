import { describe, it, expect, vi, beforeEach } from "vitest";
import { listDirTool } from "../../../src/tools/fs/listDir";
import { createMockContext } from "../../setup";
import * as fs from "fs";

vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
  },
}));

describe("listDirTool", () => {
  const mockCtx = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list directory contents", async () => {
    const mockEntries = [
      { name: "file.txt", isDirectory: () => false },
      { name: "dir", isDirectory: () => true },
    ];
    (fs.promises.readdir as any).mockResolvedValue(mockEntries);

    const result = await listDirTool.execute(
      { dirPath: "/path/to/dir" },
      mockCtx,
    );

    expect(fs.promises.readdir).toHaveBeenCalled();
    expect(result.text).toContain("file.txt (file)");
    expect(result.text).toContain("dir (dir)");
  });

  it("should throw error if listing fails", async () => {
    (fs.promises.readdir as any).mockRejectedValue(new Error("Access denied"));

    await expect(
      listDirTool.execute({ dirPath: "/path/to/dir" }, mockCtx),
    ).rejects.toThrow("Access denied");
  });
});
