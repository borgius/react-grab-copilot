import * as vscode from 'vscode';
import { Tool } from '../tool';

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
    execute: async (args: { query: string }) => {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                args.query
            );

            if (!symbols || symbols.length === 0) {
                return "No symbols found.";
            }

            return symbols.map(s => `${s.name} (${vscode.SymbolKind[s.kind]}) in ${vscode.workspace.asRelativePath(s.location.uri)}`).join('\n');
        } catch (err: any) {
            return `Error searching symbols: ${err.message}`;
        }
    },
};
