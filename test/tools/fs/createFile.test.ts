import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileTool } from '../../../src/tools/fs/createFile';
import { createMockContext } from '../../setup';
import * as vscode from 'vscode';

describe('createFileTool', () => {
    const mockCtx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a file successfully', async () => {
        (vscode.workspace.fs.stat as any).mockResolvedValue({}); // Parent dir exists (mocked for resolvePath)
        
        const result = await createFileTool.execute({ filePath: '/path/to/file.txt', content: 'content' }, mockCtx);

        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        expect(result.text).toContain('Created file:');
    });

    it('should throw error if creation fails', async () => {
        (vscode.workspace.fs.createDirectory as any).mockRejectedValue(new Error('Permission denied'));

        await expect(createFileTool.execute({ filePath: '/path/to/file.txt', content: 'content' }, mockCtx)).rejects.toThrow('Permission denied');
    });
});
