import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDirectoryTool } from '../../../src/tools/fs/createDirectory';
import { createMockContext } from '../../setup';
import * as vscode from 'vscode';

describe('createDirectoryTool', () => {
    const mockCtx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a directory successfully', async () => {
        const result = await createDirectoryTool.execute({ dirPath: '/path/to/dir' }, mockCtx);

        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        expect(result.text).toContain('Created directory:');
    });

    it('should throw error if creation fails', async () => {
        (vscode.workspace.fs.createDirectory as any).mockRejectedValue(new Error('Failed'));

        await expect(createDirectoryTool.execute({ dirPath: '/path/to/dir' }, mockCtx)).rejects.toThrow('Failed');
    });
});
