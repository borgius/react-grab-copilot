import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findFilesTool } from '../../../src/tools/search/findFiles';
import { createMockContext } from '../../setup';
import * as vscode from 'vscode';

describe('findFilesTool', () => {
    const mockCtx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find files', async () => {
        const mockFiles = [
            { fsPath: '/path/to/file1.ts' },
            { fsPath: '/path/to/file2.ts' },
        ];
        (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

        const result = await findFilesTool.execute({ pattern: '**/*.ts' }, mockCtx);

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith('**/*.ts', '**/node_modules/**', 50);
        expect(result.text).toContain('/path/to/file1.ts');
        expect(result.text).toContain('/path/to/file2.ts');
    });

    it('should throw error on failure', async () => {
        (vscode.workspace.findFiles as any).mockRejectedValue(new Error('Search failed'));

        await expect(findFilesTool.execute({ pattern: '**/*.ts' }, mockCtx)).rejects.toThrow('Search failed');
    });
});
