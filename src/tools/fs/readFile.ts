import * as vscode from 'vscode';
import { Tool, ToolContext, streamFile, streamResult } from '../tool';
import { resolvePath } from '../util/pathResolver';

export const readFileTool: Tool = {
    definition: {
        name: 'readFile',
        description: 'Read the contents of a file',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'The absolute path to the file to read',
                },
            },
            required: ['filePath'],
        },
    },
    execute: async (args: { filePath: string }, ctx: ToolContext) => {
        const uri = await resolvePath(args.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();
        
        if (!content || content.trim().length === 0) {
            const msg = `File exists but is empty: ${uri.fsPath}`;
            ctx.stream.markdown(`📄 ${msg}\n`);
            return msg;
        }
        
        streamFile(ctx, uri.fsPath, content);
        streamResult(ctx, content, 5000);
        
        return `File: ${uri.fsPath}\nContent (${content.length} characters):\n\n${content}`;
    },
};
