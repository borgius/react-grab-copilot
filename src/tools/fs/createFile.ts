import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamSuccess } from "../tool";
import * as path from "path";
import { resolvePath } from "../util/pathResolver";

export const createFileTool: Tool = {
  definition: {
    name: "createFile",
    description: "Create a new file with content",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to create",
        },
        content: {
          type: "string",
          description: "The content to write to the file",
        },
      },
      required: ["filePath", "content"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { filePath, content } = args as { filePath: string; content: string };
    const uri = await resolvePath(filePath, false);
    await vscode.workspace.fs.createDirectory(
      vscode.Uri.file(path.dirname(uri.fsPath)),
    );
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));

    const msg = `Created file: ${uri.fsPath} (${content.length} chars)`;
    streamSuccess(ctx, msg);
    return { text: msg };
  },
};
