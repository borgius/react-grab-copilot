import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDirectoryTool } from '../../../src/tools/fs/createDirectory';
import * as vscode from 'vscode';

describe('createDirectoryTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a directory successfully', async () => {
        const result = await createDirectoryTool.execute({ dirPath: '/path/to/dir' });

        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        expect(result).toContain('Successfully created directory');
    });

    it('should return error if creation fails', async () => {
        (vscode.workspace.fs.createDirectory as any).mockRejectedValue(new Error('Failed'));

        const result = await createDirectoryTool.execute({ dirPath: '/path/to/dir' });

        expect(result).toContain('Error creating directory: Failed');
    });
});
