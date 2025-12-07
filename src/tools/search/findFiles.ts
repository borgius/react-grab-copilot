import * as vscode from 'vscode';
import { Tool, ToolContext, streamResult } from '../tool';

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
    execute: async (args: { pattern: string; maxResults?: number }, ctx: ToolContext) => {
        // Auto-add **/ prefix if pattern doesn't have a path component
        let pattern = args.pattern;
        if (!pattern.includes('/') && !pattern.startsWith('**/')) {
            pattern = `**/${pattern}`;
        }
        
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', args.maxResults || 50);
        
        ctx.stream.markdown(`🔍 **Find Files:** \`${pattern}\`\n`);
        
        if (files.length === 0) {
            const msg = `No files found matching pattern: ${pattern}`;
            ctx.stream.markdown(`_${msg}_\n`);
            return msg;
        }
        
        const result = files.map(f => f.fsPath).join('\n');
        ctx.stream.markdown(`Found ${files.length} file(s):\n`);
        streamResult(ctx, result);
        
        return `Found ${files.length} file(s):\n${result}`;
    },
};
