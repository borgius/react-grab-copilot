import * as vscode from 'vscode';

export async function resolvePath(filePath: string, checkExists: boolean = true): Promise<vscode.Uri> {
    // If we have a workspace, try to resolve relative to it first
    // This handles the case where users provide "/src/file.ts" meaning project root,
    // even if a file technically exists at the system root.
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
        // Remove leading slash if present to join correctly
        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        const resolvedUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
        
        try {
            await vscode.workspace.fs.stat(resolvedUri);
            return resolvedUri;
        } catch {
            // Ignore and try absolute/original path
        }
    }

    let uri = vscode.Uri.file(filePath);
    
    // Try to resolve relative paths if absolute path doesn't exist
    try {
        await vscode.workspace.fs.stat(uri);
        return uri;
    } catch {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
            // Remove leading slash if present to join correctly
            const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const resolvedUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
            
            if (!checkExists) {
                // If neither exists, and it looks like an absolute path that failed, 
                // but we have a workspace, default to the workspace-relative path 
                // as that's most likely what the user intended for creation/editing.
                return resolvedUri;
            }
        }
    }

    if (checkExists) {
        throw new Error(`File not found: ${filePath}`);
    }

    return uri;
}
