import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamResult } from "../tool";
import * as cp from "child_process";

export const scmChangesTool: Tool = {
  definition: {
    name: "scmChanges",
    description: "Get git diffs of changed files",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  execute: async (_args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    return new Promise((resolve, reject) => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) {
        reject(new Error("No workspace open"));
        return;
      }

      ctx.stream.markdown(`📝 **Git Changes**\n`);

      cp.exec("git diff HEAD", { cwd }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Git error: ${err.message}\n${stderr}`));
        } else {
          if (!stdout) {
            ctx.stream.markdown(`_No changes found._\n`);
            resolve({ text: "No changes found." });
          } else {
            const lines = stdout.split("\n").length;
            ctx.stream.markdown(`Found changes (${lines} lines):\n`);
            streamResult(ctx, stdout, 3000);
            resolve({ text: stdout });
          }
        }
      });
    });
  },
};
