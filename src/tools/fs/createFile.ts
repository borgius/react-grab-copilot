import * as vscode from 'vscode';
import { Tool } from '../tool';
import * as path from 'path';
import { resolvePath } from '../util/pathResolver';

export const createFileTool: Tool = {
    definition: {
        name: 'createFile',
        description: 'Create a new file with content',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'The absolute path to the file to create',
                },
                content: {
                    type: 'string',
                    description: 'The content to write to the file',
                },
            },
            required: ['filePath', 'content'],
        },
    },
    execute: async (args: { filePath: string; content: string }) => {
        const uri = await resolvePath(args.filePath, false);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(args.content));
        return `Successfully created file ${args.filePath}`;
    },
};
