import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamSuccess } from "../tool";
import { resolvePath } from "../util/pathResolver";

export const createDirectoryTool: Tool = {
  definition: {
    name: "createDirectory",
    description: "Create a new directory",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the directory to create",
        },
      },
      required: ["dirPath"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { dirPath } = args as { dirPath: string };
    const uri = await resolvePath(dirPath, false);
    await vscode.workspace.fs.createDirectory(uri);

    const msg = `Created directory: ${uri.fsPath}`;
    streamSuccess(ctx, msg);
    return { text: msg };
  },
};
