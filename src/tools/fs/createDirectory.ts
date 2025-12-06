import * as vscode from 'vscode';
import { Tool } from '../tool';
import { resolvePath } from '../util/pathResolver';

export const createDirectoryTool: Tool = {
    definition: {
        name: 'createDirectory',
        description: 'Create a new directory',
        inputSchema: {
            type: 'object',
            properties: {
                dirPath: {
                    type: 'string',
                    description: 'The absolute path to the directory to create',
                },
            },
            required: ['dirPath'],
        },
    },
    execute: async (args: { dirPath: string }) => {
        const uri = await resolvePath(args.dirPath, false);
        await vscode.workspace.fs.createDirectory(uri);
        return `Successfully created directory ${args.dirPath}`;
    },
};
