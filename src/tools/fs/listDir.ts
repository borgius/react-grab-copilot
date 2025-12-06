import * as vscode from 'vscode';
import { Tool } from '../tool';
import * as fs from 'fs';
import { resolvePath } from '../util/pathResolver';

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
        const uri = await resolvePath(args.dirPath);
        const entries = await fs.promises.readdir(uri.fsPath, { withFileTypes: true });
        return entries.map(e => `${e.name} ${e.isDirectory() ? "(dir)" : "(file)"}`).join("\n");
    },
};
