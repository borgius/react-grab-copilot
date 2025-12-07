import * as vscode from 'vscode';
import type { Tool, ToolContext, ToolOutput } from '../tool';
import { streamResult } from '../tool';

export const searchWorkspaceSymbolsTool: Tool = {
    definition: {
        name: 'searchWorkspaceSymbols',
        description: 'Search for symbols (functions, classes, etc.) in the workspace',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The symbol name to search for',
                },
            },
            required: ['query'],
        },
    },
    execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
        const { query } = args as { query: string };
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            query
        );

        ctx.stream.markdown(`🔎 **Symbols:** \`${query}\`\n`);

        if (!symbols || symbols.length === 0) {
            ctx.stream.markdown(`_No symbols found._\n`);
            return { text: "No symbols found." };
        }

        const result = symbols.map(s => `${s.name} (${vscode.SymbolKind[s.kind]}) in ${vscode.workspace.asRelativePath(s.location.uri)}`).join('\n');
        ctx.stream.markdown(`Found ${symbols.length} symbol(s):\n`);
        streamResult(ctx, result);
        
        return { text: result };
    },
};
