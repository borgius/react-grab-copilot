import * as vscode from 'vscode';
import { Tool } from '../tool';

export const getErrorsTool: Tool = {
    definition: {
        name: 'getErrors',
        description: 'Get compile or lint errors in the workspace',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'Optional absolute path to a specific file to check',
                },
            },
        },
    },
    execute: async (args: { filePath?: string }) => {
        try {
            let diagnostics: [vscode.Uri, vscode.Diagnostic[]][];
            
            if (args.filePath) {
                const uri = vscode.Uri.file(args.filePath);
                diagnostics = [[uri, vscode.languages.getDiagnostics(uri)]];
            } else {
                diagnostics = vscode.languages.getDiagnostics();
            }

            const errors = diagnostics
                .flatMap(([uri, diags]) => 
                    diags
                        .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                        .map(d => `${vscode.workspace.asRelativePath(uri)}:${d.range.start.line + 1}: ${d.message}`)
                );

            if (errors.length === 0) {
                return "No errors found.";
            }
            return errors.join('\n');
        } catch (err: any) {
            return `Error getting diagnostics: ${err.message}`;
        }
    },
};
