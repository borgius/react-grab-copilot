import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { resolvePath } from "../util/pathResolver";

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

interface FilePatch {
  oldPath: string;
  newPath: string;
  hunks: Hunk[];
}

function parsePatch(patch: string): FilePatch[] {
  const files: FilePatch[] = [];
  const lines = patch.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Look for diff header
    if (lines[i].startsWith("diff ") || lines[i].startsWith("---")) {
      let oldPath = "";
      let newPath = "";

      // Skip diff --git line if present
      if (lines[i].startsWith("diff ")) {
        i++;
      }

      // Parse --- line
      if (i < lines.length && lines[i].startsWith("---")) {
        const match = lines[i].match(/^---\s+(?:a\/)?(.+?)(?:\t.*)?$/);
        if (match) {
          oldPath = match[1];
        }
        i++;
      }

      // Parse +++ line
      if (i < lines.length && lines[i].startsWith("+++")) {
        const match = lines[i].match(/^\+\+\+\s+(?:b\/)?(.+?)(?:\t.*)?$/);
        if (match) {
          newPath = match[1];
        }
        i++;
      }

      const hunks: Hunk[] = [];

      // Parse hunks
      while (i < lines.length && !lines[i].startsWith("diff ")) {
        if (lines[i].startsWith("@@")) {
          const hunkHeader = lines[i].match(
            /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/,
          );

          // Support bare @@ markers (common in LLM-generated patches)
          const isBareHunkMarker =
            !hunkHeader && /^@@\s*(?:.*)?$/.test(lines[i]);

          if (hunkHeader || isBareHunkMarker) {
            const hunk: Hunk = {
              // Use 0 as placeholder for bare markers - will be resolved later
              oldStart: hunkHeader ? parseInt(hunkHeader[1], 10) : 0,
              oldLines: hunkHeader?.[2] ? parseInt(hunkHeader[2], 10) : 1,
              newStart: hunkHeader ? parseInt(hunkHeader[3], 10) : 0,
              newLines: hunkHeader?.[4] ? parseInt(hunkHeader[4], 10) : 1,
              lines: [],
            };
            i++;

            // Collect hunk lines
            while (
              i < lines.length &&
              !lines[i].startsWith("@@") &&
              !lines[i].startsWith("diff ")
            ) {
              const line = lines[i];
              if (
                line.startsWith("+") ||
                line.startsWith("-") ||
                line.startsWith(" ") ||
                line === ""
              ) {
                hunk.lines.push(line);
              } else if (line.startsWith("\\")) {
                // Handle "\ No newline at end of file"
                // Skip this line
              } else {
                break;
              }
              i++;
            }

            hunks.push(hunk);
          } else {
            i++;
          }
        } else {
          i++;
        }
      }

      if (newPath && hunks.length > 0) {
        files.push({ oldPath, newPath, hunks });
      }
    } else {
      i++;
    }
  }

  return files;
}

/**
 * Find the line number where a hunk's removed/context lines match in the file.
 * Returns the 1-based line number, or -1 if not found.
 */
function findHunkLocation(fileLines: string[], hunk: Hunk): number {
  // Extract the lines we need to find (removed lines and context lines)
  const searchLines: string[] = [];
  for (const line of hunk.lines) {
    if (line.startsWith("-")) {
      searchLines.push(line.substring(1));
    } else if (line.startsWith(" ")) {
      searchLines.push(line.substring(1));
    }
  }

  if (searchLines.length === 0) {
    return -1;
  }

  // Search for the pattern in the file
  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (fileLines[i + j] !== searchLines[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i + 1; // Convert to 1-based
    }
  }

  return -1;
}

function applyHunksToText(text: string, hunks: Hunk[]): string {
  const lines = text.split("\n");
  let offset = 0;

  for (const hunk of hunks) {
    let startLine: number;
    let deleteCount: number;

    if (hunk.oldStart === 0) {
      // Bare @@ marker - need to find the location by searching for context
      const foundLine = findHunkLocation(lines, hunk);
      if (foundLine === -1) {
        // Try to extract what we're looking for to give a better error
        const searchLines = hunk.lines
          .filter((l) => l.startsWith("-") || l.startsWith(" "))
          .map((l) => l.substring(1))
          .slice(0, 3)
          .join("\\n");
        throw new Error(
          `Could not find matching context for hunk. Looking for: "${searchLines}..."`,
        );
      }
      startLine = foundLine - 1 + offset;
      // Count the lines to delete (removed and context lines from original)
      deleteCount = hunk.lines.filter(
        (l) => l.startsWith("-") || l.startsWith(" "),
      ).length;
    } else {
      startLine = hunk.oldStart - 1 + offset;
      deleteCount = hunk.oldLines;
    }

    const newLines: string[] = [];
    for (const line of hunk.lines) {
      if (line.startsWith("+")) {
        newLines.push(line.substring(1));
      } else if (line.startsWith(" ")) {
        newLines.push(line.substring(1));
      } else if (line === "") {
        // Empty context line
        newLines.push("");
      }
      // Lines starting with "-" are removed (not added to newLines)
    }

    lines.splice(startLine, deleteCount, ...newLines);
    offset += newLines.length - deleteCount;
  }

  return lines.join("\n");
}

export const applyPatchTool: Tool = {
  definition: {
    name: "applyPatch",
    description:
      "Apply a unified diff patch to one or more files. The patch should be in standard unified diff format (output of git diff, diff -u, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        patch: {
          type: "string",
          description:
            "The unified diff patch content to apply. Should include --- and +++ headers, @@ hunk headers, and +/- prefixed lines.",
        },
        basePath: {
          type: "string",
          description:
            "Optional base path to resolve relative file paths in the patch. If not provided, workspace root is used.",
        },
      },
      required: ["patch"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { patch, basePath } = args as {
      patch: string;
      basePath?: string;
    };

    const filePatchs = parsePatch(patch);

    if (filePatchs.length === 0) {
      throw new Error(
        "No valid patches found in the provided diff. Ensure the patch is in unified diff format with proper headers.",
      );
    }

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const filePatch of filePatchs) {
      const targetPath = filePatch.newPath;

      try {
        // Resolve the file path
        let fullPath = targetPath;
        if (basePath) {
          fullPath = `${basePath}/${targetPath}`;
        }

        const uri = await resolvePath(fullPath);

        // Read current file content
        const document = await vscode.workspace.openTextDocument(uri);
        const originalText = document.getText();

        // Apply hunks
        const newText = applyHunksToText(originalText, filePatch.hunks);

        // Create edit
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(originalText.length),
        );
        edit.replace(uri, fullRange, newText);

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
          throw new Error(`Failed to apply edit`);
        }

        // Save the document
        const doc = await vscode.workspace.openTextDocument(uri);
        await doc.save();

        successCount++;
        // Count added and removed lines
        const addedLines = filePatch.hunks.reduce(
          (sum, h) => sum + h.lines.filter((l) => l.startsWith("+")).length,
          0,
        );
        const removedLines = filePatch.hunks.reduce(
          (sum, h) => sum + h.lines.filter((l) => l.startsWith("-")).length,
          0,
        );
        // Show Copilot-style edit message with colored +/- counts
        const fileName = uri.fsPath.split("/").pop() || uri.fsPath;
        const openCommandArgs = encodeURIComponent(JSON.stringify([uri]));
        const md = new vscode.MarkdownString(
          `$(file) [${fileName}](command:vscode.open?${openCommandArgs}) <span style="color:#3fb950;">+${addedLines}</span> <span style="color:#f85149;">-${removedLines}</span>\n`,
          true,
        );
        md.supportHtml = true;
        md.isTrusted = { enabledCommands: ["vscode.open"] };
        ctx.stream.markdown(md);
        results.push(`Edited: ${uri.fsPath}`);
      } catch (error) {
        failCount++;
        const errorMsg = `Failed to patch ${targetPath}: ${error instanceof Error ? error.message : String(error)}`;
        ctx.stream.markdown(`❌ ${errorMsg}\n`);
        results.push(errorMsg);
      }
    }

    const summary = `Applied patch: ${successCount} file(s) succeeded, ${failCount} file(s) failed`;
    return { text: `${summary}\n${results.join("\n")}` };
  },
};
