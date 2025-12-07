import * as vscode from 'vscode';
import { Tool, ToolContext, streamResult } from '../tool';

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
    execute: async (args: { query: string }, ctx: ToolContext) => {
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            args.query
        );

        ctx.stream.markdown(`🔎 **Symbols:** \`${args.query}\`\n`);

        if (!symbols || symbols.length === 0) {
            ctx.stream.markdown(`_No symbols found._\n`);
            return "No symbols found.";
        }

        const result = symbols.map(s => `${s.name} (${vscode.SymbolKind[s.kind]}) in ${vscode.workspace.asRelativePath(s.location.uri)}`).join('\n');
        ctx.stream.markdown(`Found ${symbols.length} symbol(s):\n`);
        streamResult(ctx, result);
        
        return result;
    },
};
