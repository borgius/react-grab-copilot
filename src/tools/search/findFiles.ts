import * as vscode from 'vscode';
import type { Tool, ToolContext, ToolOutput } from '../tool';
import { streamResult } from '../tool';

export const findFilesTool: Tool = {
    definition: {
        name: 'findFiles',
        description: 'Find files in the workspace using a glob pattern. Use **/ prefix to search recursively (e.g., **/index.ts)',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'The glob pattern to search for. Use **/ for recursive search (e.g., **/index.ts, **/*.tsx, src/**/*.ts)',
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 50)',
                },
            },
            required: ['pattern'],
        },
    },
    execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
        const { pattern: inputPattern, maxResults: inputMaxResults } = args as { pattern: string; maxResults?: number };
        // Auto-add **/ prefix if pattern doesn't have a path component
        let pattern = inputPattern;
        if (!pattern.includes('/') && !pattern.startsWith('**/')) {
            pattern = `**/${pattern}`;
        }
        
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', inputMaxResults || 50);
        
        ctx.stream.markdown(`🔍 **Find Files:** \`${pattern}\`\n`);
        
        if (files.length === 0) {
            const msg = `No files found matching pattern: ${pattern}`;
            ctx.stream.markdown(`_${msg}_\n`);
            return { text: msg };
        }
        
        const result = files.map(f => f.fsPath).join('\n');
        ctx.stream.markdown(`Found ${files.length} file(s):\n`);
        streamResult(ctx, result);
        
        return { text: `Found ${files.length} file(s):\n${result}` };
    },
};
