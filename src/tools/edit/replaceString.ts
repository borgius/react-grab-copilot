import * as vscode from 'vscode';
import { Tool } from '../tool';

export const replaceStringTool: Tool = {
    definition: {
        name: 'replaceString',
        description: 'Replace a string in a file',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'The absolute path to the file',
                },
                oldString: {
                    type: 'string',
                    description: 'The exact string to replace',
                },
                newString: {
                    type: 'string',
                    description: 'The new string',
                },
            },
            required: ['filePath', 'oldString', 'newString'],
        },
    },
    execute: async (args: { filePath: string; oldString: string; newString: string }) => {
        try {
            const uri = vscode.Uri.file(args.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            
            const index = text.indexOf(args.oldString);
            if (index === -1) {
                return `Error: oldString not found in ${args.filePath}`;
            }
            
            // Check for multiple occurrences
            if (text.indexOf(args.oldString, index + 1) !== -1) {
                return `Error: oldString is not unique in ${args.filePath}. Please provide more context.`;
            }

            const startPos = document.positionAt(index);
            const endPos = document.positionAt(index + args.oldString.length);
            const range = new vscode.Range(startPos, endPos);
            
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, range, args.newString);
            
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
                return `Successfully replaced string in ${args.filePath}`;
            } else {
                return `Failed to apply edit to ${args.filePath}`;
            }
        } catch (err: any) {
            return `Error replacing string: ${err.message}`;
        }
    },
};
