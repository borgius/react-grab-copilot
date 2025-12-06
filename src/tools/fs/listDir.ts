import * as vscode from 'vscode';
import { Tool } from '../tool';
import * as fs from 'fs';

export const listDirTool: Tool = {
    definition: {
        name: 'listDir',
        description: 'List the contents of a directory',
        inputSchema: {
            type: 'object',
            properties: {
                dirPath: {
                    type: 'string',
                    description: 'The absolute path to the directory to list',
                },
            },
            required: ['dirPath'],
        },
    },
    execute: async (args: { dirPath: string }) => {
        try {
            const entries = await fs.promises.readdir(args.dirPath, { withFileTypes: true });
            return entries.map(e => `${e.name} ${e.isDirectory() ? "(dir)" : "(file)"}`).join("\n");
        } catch (err: any) {
            return `Error listing directory: ${err.message}`;
        }
    },
};
