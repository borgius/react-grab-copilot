import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findFilesTool } from '../../../src/tools/search/findFiles';
import * as vscode from 'vscode';

describe('findFilesTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find files', async () => {
        const mockFiles = [
            { fsPath: '/path/to/file1.ts' },
            { fsPath: '/path/to/file2.ts' },
        ];
        (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

        const result = await findFilesTool.execute({ pattern: '**/*.ts' });

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith('**/*.ts', null, 50);
        expect(result).toContain('/path/to/file1.ts');
        expect(result).toContain('/path/to/file2.ts');
    });

    it('should handle errors', async () => {
        (vscode.workspace.findFiles as any).mockRejectedValue(new Error('Search failed'));

        const result = await findFilesTool.execute({ pattern: '**/*.ts' });

        expect(result).toContain('Error finding files: Search failed');
    });
});
