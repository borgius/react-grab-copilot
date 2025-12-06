import * as vscode from 'vscode';
import { Tool } from '../tool';

export const readFileTool: Tool = {
    definition: {
        name: 'readFile',
        description: 'Read the contents of a file',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'The absolute path to the file to read',
                },
            },
            required: ['filePath'],
        },
    },
    execute: async (args: { filePath: string }) => {
        try {
            const uri = vscode.Uri.file(args.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            return document.getText();
        } catch (err: any) {
            return `Error reading file: ${err.message}`;
        }
    },
};
