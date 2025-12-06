import * as vscode from 'vscode';

export async function resolvePath(filePath: string): Promise<vscode.Uri> {
    let uri = vscode.Uri.file(filePath);
    
    // Try to resolve relative paths if absolute path doesn't exist
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
            // Remove leading slash if present to join correctly
            const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const resolvedUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
            try {
                // Check if the resolved path exists or if we are creating a file (parent dir exists)
                // For creation, we might want to be more lenient, but for now let's check existence for read operations
                // The caller can handle the "not found" error if they intend to create it.
                // However, for consistency, we return the resolved URI if the original one didn't exist.
                // But wait, if we are creating a file, it won't exist yet.
                // So we should probably return the resolved URI if it looks like a relative path was intended.
                
                // If the original path didn't exist, and we found a match relative to workspace, use that.
                await vscode.workspace.fs.stat(resolvedUri);
                uri = resolvedUri;
            } catch {
                // If neither exists, and it looks like an absolute path that failed, 
                // but we have a workspace, maybe we should default to the workspace-relative path 
                // if we are in a "create" context? 
                // But this function is generic.
                
                // Let's stick to the logic: if it exists relative to workspace, use it.
                // If not, return the original URI (which will fail later, or be used for creation).
                
                // One edge case: creating a new file at "/src/new.ts". 
                // Original URI: /src/new.ts (root of FS). Likely wrong.
                // Workspace URI: /Users/user/project/src/new.ts. Likely right.
                
                // If the path starts with / and we are on a system where that could be root,
                // but it's not found, and we are in a workspace...
                
                if (filePath.startsWith('/') && vscode.workspace.workspaceFolders) {
                     uri = resolvedUri;
                }
            }
        }
    }
    return uri;
}
