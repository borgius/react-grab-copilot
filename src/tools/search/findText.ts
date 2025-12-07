import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamResult } from "../tool";
import * as cp from "child_process";

export const findTextTool: Tool = {
  definition: {
    name: "findText",
    description: "Find text in files using grep",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The text or regex to search for",
        },
        includePattern: {
          type: "string",
          description:
            'Glob pattern for files to include (e.g. "*.ts" or "*.{ts,tsx}")',
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 100)",
        },
      },
      required: ["query"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const {
      query,
      includePattern,
      maxResults: inputMaxResults,
    } = args as { query: string; includePattern?: string; maxResults?: number };
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      throw new Error("No workspace open");
    }

    const maxResults = inputMaxResults || 100;

    ctx.stream.markdown(
      `🔍 **Search:** \`${query}\`${includePattern ? ` in \`${includePattern}\`` : ""}\n`,
    );

    // Build grep command with options
    // -r: recursive, -n: line numbers, -I: ignore binary files
    let command = `grep -rn -I`;

    // Add include pattern if specified
    if (includePattern) {
      command += ` --include="${includePattern}"`;
    }

    // Exclude common non-source directories
    command += ` --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build`;

    // Add query and path, limit results with head
    command += ` "${query}" . | head -n ${maxResults}`;

    return new Promise((resolve, reject) => {
      cp.exec(
        command,
        { cwd, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            // Grep returns exit code 1 if no matches found
            if (err.code === 1 && !stderr) {
              ctx.stream.markdown(`_No matches found._\n`);
              resolve({ text: "No matches found." });
              return;
            }
            // maxBuffer exceeded - return partial results message
            if (err.message.includes("maxBuffer")) {
              const msg = `Too many results. Please use a more specific query or includePattern to narrow down the search.`;
              ctx.stream.markdown(`⚠️ ${msg}\n`);
              resolve({ text: msg });
              return;
            }
            reject(new Error(`Grep error: ${err.message}\nStderr: ${stderr}`));
          } else {
            // Truncate output if still too long
            let result = stdout;
            if (stdout.length > 50000) {
              result =
                stdout.substring(0, 50000) +
                "\n... (output truncated, use more specific query)";
            }

            const lines = stdout
              .trim()
              .split("\n")
              .filter((l) => l);
            ctx.stream.markdown(`Found ${lines.length} match(es):\n`);
            streamResult(ctx, result, 3000);

            if (lines.length >= maxResults) {
              resolve({
                text:
                  result +
                  `\n... (showing first ${maxResults} results, use maxResults parameter for more)`,
              });
            } else {
              resolve({ text: result || "No matches found." });
            }
          }
        },
      );
    });
  },
};
