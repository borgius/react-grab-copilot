import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamSuccess, streamInfo } from "../tool";
import { resolvePath } from "../util/pathResolver";

export const replaceStringTool: Tool = {
  definition: {
    name: "replaceString",
    description: "Replace a string in a file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file",
        },
        oldString: {
          type: "string",
          description: "The exact string to replace",
        },
        newString: {
          type: "string",
          description: "The new string",
        },
      },
      required: ["filePath", "oldString", "newString"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { filePath, oldString, newString } = args as {
      filePath: string;
      oldString: string;
      newString: string;
    };
    // resolvePath throws if file not found
    const uri = await resolvePath(filePath);

    streamInfo(ctx, `Replacing in: ${uri.fsPath}`);

    const document = await vscode.workspace.openTextDocument(uri);
    const text = document.getText();

    // Try exact match first
    let index = text.indexOf(oldString);
    let matchLength = oldString.length;

    if (index === -1) {
      // Try fuzzy match (ignoring whitespace differences)
      // Build a pattern that allows optional whitespace around punctuation
      let pattern = "";
      const punctuation = /[=:,;(){}\[\]+\-*\/><"']/;

      for (let i = 0; i < oldString.length; i++) {
        const char = oldString[i];
        if (/\s/.test(char)) {
          pattern += "\\s+";
        } else if (punctuation.test(char)) {
          pattern += `\\s*${char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`;
        } else {
          pattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
      }

      const regex = new RegExp(pattern, "g");

      const matches = Array.from(text.matchAll(regex));

      if (matches.length === 0) {
        throw new Error(
          `oldString not found in ${filePath}. The text you're trying to replace does not exist in the file.`,
        );
      }

      if (matches.length > 1) {
        throw new Error(
          `oldString is not unique in ${filePath} (fuzzy match). Please provide more context to identify a unique match.`,
        );
      }

      index = matches[0].index ?? 0;
      matchLength = matches[0][0].length;
    } else {
      // Check for multiple occurrences (exact match)
      if (text.indexOf(oldString, index + 1) !== -1) {
        throw new Error(
          `oldString is not unique in ${filePath}. Please provide more context to identify a unique match.`,
        );
      }
    }

    const startPos = document.positionAt(index);
    const endPos = document.positionAt(index + matchLength);
    const range = new vscode.Range(startPos, endPos);

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, range, newString);

    const success = await vscode.workspace.applyEdit(edit);
    if (!success) {
      throw new Error(`Failed to apply edit to ${filePath}`);
    }

    await document.save();

    const msg = `Replaced at line ${startPos.line + 1}: "${oldString.substring(0, 30)}${oldString.length > 30 ? "..." : ""}" → "${newString.substring(0, 30)}${newString.length > 30 ? "..." : ""}"`;
    streamSuccess(ctx, msg);
    return { text: `Successfully replaced string in ${filePath}` };
  },
};
