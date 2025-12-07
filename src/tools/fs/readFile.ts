import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { resolvePath } from "../util/pathResolver";

export const readFileTool: Tool = {
  definition: {
    name: "readFile",
    description: "Read the contents of a file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to read",
        },
      },
      required: ["filePath"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { filePath } = args as { filePath: string };
    const uri = await resolvePath(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const content = document.getText();

    // Show file name with clickable link inline
    ctx.stream.markdown(`Read `);
    ctx.stream.anchor(uri, uri.fsPath.split("/").pop() || uri.fsPath);
    ctx.stream.markdown(`\n`);

    if (!content || content.trim().length === 0) {
      const msg = `File exists but is empty: ${uri.fsPath}`;
      return { text: msg };
    }

    return {
      text: `File: ${uri.fsPath}\nContent (${content.length} characters):\n\n${content}`,
    };
  },
};
