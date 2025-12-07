import * as vscode from 'vscode';
import type { Tool, ToolContext, ToolOutput } from '../tool';
import { streamResult } from '../tool';
import { resolvePath } from '../util/pathResolver';

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
    execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
        const { filePath } = args as { filePath?: string };
        let diagnostics: [vscode.Uri, vscode.Diagnostic[]][];
        
        if (filePath) {
            const uri = await resolvePath(filePath);
            diagnostics = [[uri, vscode.languages.getDiagnostics(uri)]];
            ctx.stream.markdown(`🔴 **Errors in:** \`${filePath}\`\n`);
        } else {
            diagnostics = vscode.languages.getDiagnostics();
            ctx.stream.markdown(`🔴 **Workspace Errors**\n`);
        }

        const errors = diagnostics
            .flatMap(([uri, diags]) => 
                diags
                    .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                    .map(d => `${vscode.workspace.asRelativePath(uri)}:${d.range.start.line + 1}: ${d.message}`)
            );

        if (errors.length === 0) {
            ctx.stream.markdown(`✅ _No errors found._\n`);
            return { text: "No errors found." };
        }
        
        ctx.stream.markdown(`Found ${errors.length} error(s):\n`);
        streamResult(ctx, errors.join('\n'));
        return { text: errors.join('\n') };
    },
};
