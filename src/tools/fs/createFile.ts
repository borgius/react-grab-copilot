import * as vscode from 'vscode';
import { Tool, ToolContext, streamSuccess } from '../tool';
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
    execute: async (args: { filePath: string; content: string }, ctx: ToolContext) => {
        const uri = await resolvePath(args.filePath, false);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(args.content));
        
        const msg = `Created file: ${uri.fsPath} (${args.content.length} chars)`;
        streamSuccess(ctx, msg);
        return msg;
    },
};
