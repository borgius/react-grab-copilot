import * as vscode from 'vscode';
import { Tool } from '../tool';
import * as path from 'path';
import { resolvePath } from '../util/pathResolver';

export const editFileTool: Tool = {
    definition: {
        name: 'editFile',
        description: 'Edit a file by replacing its content',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'The absolute path to the file to edit',
                },
                newContent: {
                    type: 'string',
                    description: 'The new content of the file',
                },
            },
            required: ['filePath', 'newContent'],
        },
    },
    execute: async (args: { filePath: string; newContent: string }) => {
        try {
            const uri = await resolvePath(args.filePath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
            
            const edit = new vscode.WorkspaceEdit();
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                );
                edit.replace(uri, fullRange, args.newContent);
            } catch {
                edit.createFile(uri, { overwrite: true });
                edit.insert(uri, new vscode.Position(0, 0), args.newContent);
            }
            
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                const doc = await vscode.workspace.openTextDocument(uri);
                await doc.save();
                return `Successfully edited ${args.filePath}`;
            } else {
                return `Failed to edit ${args.filePath}`;
            }
        } catch (err: any) {
            return `Error editing file: ${err.message}`;
        }
    },
};
