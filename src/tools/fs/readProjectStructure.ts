import * as vscode from 'vscode';
import type { Tool, ToolContext, ToolOutput } from '../tool';
import { streamResult } from '../tool';
import * as fs from 'fs';
import * as path from 'path';

export const readProjectStructureTool: Tool = {
    definition: {
        name: 'readProjectStructure',
        description: 'Get a recursive tree view of the project structure',
        inputSchema: {
            type: 'object',
            properties: {
                maxDepth: {
                    type: 'number',
                    description: 'Maximum depth to traverse (default: 3)',
                },
            },
        },
    },
    execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
        const { maxDepth: inputMaxDepth } = args as { maxDepth?: number };
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
            throw new Error("No workspace open");
        }

        const maxDepth = inputMaxDepth || 3;

        async function walk(dir: string, depth: number): Promise<string> {
            if (depth > maxDepth) return '';
            
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            let result = '';
            
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
                
                const indent = '  '.repeat(depth);
                result += `${indent}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;
                
                if (entry.isDirectory()) {
                    result += await walk(path.join(dir, entry.name), depth + 1);
                }
            }
            return result;
        }

        const result = await walk(root, 0);
        ctx.stream.markdown(`🗂️ **Project Structure** (depth: ${maxDepth})\n`);
        streamResult(ctx, result);
        
        return { text: result };
    },
};
