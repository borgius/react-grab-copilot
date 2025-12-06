import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileTool } from '../../../src/tools/fs/createFile';
import * as vscode from 'vscode';

describe('createFileTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a file successfully', async () => {
        (vscode.workspace.fs.stat as any).mockResolvedValue({}); // Parent dir exists (mocked for resolvePath)
        
        const result = await createFileTool.execute({ filePath: '/path/to/file.txt', content: 'content' });

        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        expect(result).toContain('Successfully created file');
    });

    it('should return error if creation fails', async () => {
        (vscode.workspace.fs.createDirectory as any).mockRejectedValue(new Error('Permission denied'));

        const result = await createFileTool.execute({ filePath: '/path/to/file.txt', content: 'content' });

        expect(result).toContain('Error creating file: Permission denied');
    });
});
