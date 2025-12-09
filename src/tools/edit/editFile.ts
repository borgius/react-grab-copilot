import * as path from "path";
import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamInfo, streamSuccess } from "../tool";
import { resolvePath } from "../util/pathResolver";

export const editFileTool: Tool = {
  definition: {
    name: "editFile",
    description: "Edit a file by replacing its content",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to edit",
        },
        newContent: {
          type: "string",
          description: "The new content of the file",
        },
      },
      required: ["filePath", "newContent"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { filePath, newContent } = args as {
      filePath: string;
      newContent: string;
    };
    const uri = await resolvePath(filePath, false);
    await vscode.workspace.fs.createDirectory(
      vscode.Uri.file(path.dirname(uri.fsPath)),
    );

    streamInfo(ctx, `Editing: ${uri.fsPath}`);

    const edit = new vscode.WorkspaceEdit();
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      );
      edit.replace(uri, fullRange, newContent);
    } catch {
      edit.createFile(uri, { overwrite: true });
      edit.insert(uri, new vscode.Position(0, 0), newContent);
    }

    const success = await vscode.workspace.applyEdit(edit);
    if (!success) {
      throw new Error(`Failed to edit ${filePath}`);
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    await doc.save();

    const msg = `Edited: ${uri.fsPath} (${newContent.length} chars)`;
    streamSuccess(ctx, msg);
    return { text: msg };
  },
};
