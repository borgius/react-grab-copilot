import * as vscode from 'vscode';
import { Tool } from '../tool';

export const findFilesTool: Tool = {
    definition: {
        name: 'findFiles',
        description: 'Find files in the workspace using a glob pattern',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'The glob pattern to search for (e.g. **/*.ts)',
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of results to return',
                },
            },
            required: ['pattern'],
        },
    },
    execute: async (args: { pattern: string; maxResults?: number }) => {
        const files = await vscode.workspace.findFiles(args.pattern, null, args.maxResults || 50);
        return files.map(f => f.fsPath).join('\n');
    },
};
