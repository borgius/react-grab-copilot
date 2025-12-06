import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileTool } from '../../../src/tools/fs/readFile';
import * as vscode from 'vscode';

describe('readFileTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should read a file successfully', async () => {
        const mockContent = 'Hello, world!';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.fs.stat as any).mockResolvedValue({}); // File exists

        const result = await readFileTool.execute({ filePath: '/path/to/file.txt' });

        expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
        expect(result).toBe(mockContent);
    });

    it('should return error message if file reading fails', async () => {
        const errorMessage = 'File not found';
        (vscode.workspace.fs.stat as any).mockRejectedValue(new Error(errorMessage));
        // resolvePath will try to resolve relative to workspace if stat fails, 
        // but if that also fails or if openTextDocument fails, it should catch.
        
        // Let's mock openTextDocument to fail directly to simulate read failure after resolution
        (vscode.workspace.fs.stat as any).mockResolvedValue({});
        (vscode.workspace.openTextDocument as any).mockRejectedValue(new Error(errorMessage));

        const result = await readFileTool.execute({ filePath: '/path/to/file.txt' });

        expect(result).toContain(`Error reading file: ${errorMessage}`);
    });
});
