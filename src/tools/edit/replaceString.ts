import * as vscode from 'vscode';
import { Tool } from '../tool';
import { resolvePath } from '../util/pathResolver';

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
            const uri = await resolvePath(args.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            
            // Try exact match first
            let index = text.indexOf(args.oldString);
            let matchLength = args.oldString.length;

            if (index === -1) {
                // Try fuzzy match (ignoring whitespace differences)
                // Build a pattern that allows optional whitespace around punctuation
                let pattern = '';
                const punctuation = /[=:,;(){}\[\]+\-*\/><"']/;
                
                for (let i = 0; i < args.oldString.length; i++) {
                    const char = args.oldString[i];
                    if (/\s/.test(char)) {
                        pattern += '\\s+';
                    } else if (punctuation.test(char)) {
                        pattern += `\\s*${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`;
                    } else {
                        pattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    }
                }
                
                const regex = new RegExp(pattern, 'g');
                
                const matches = Array.from(text.matchAll(regex));
                
                if (matches.length === 0) {
                    return `Error: oldString not found in ${args.filePath} (resolved: ${uri.fsPath})`;
                }
                
                if (matches.length > 1) {
                    return `Error: oldString is not unique in ${args.filePath} (fuzzy match). Please provide more context.`;
                }
                
                index = matches[0].index!;
                matchLength = matches[0][0].length;
            } else {
                // Check for multiple occurrences (exact match)
                if (text.indexOf(args.oldString, index + 1) !== -1) {
                    return `Error: oldString is not unique in ${args.filePath}. Please provide more context.`;
                }
            }

            const startPos = document.positionAt(index);
            const endPos = document.positionAt(index + matchLength);
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
