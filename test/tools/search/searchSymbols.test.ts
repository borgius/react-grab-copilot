import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchWorkspaceSymbolsTool } from '../../../src/tools/search/searchSymbols';
import { createMockContext } from '../../setup';
import * as vscode from 'vscode';

describe('searchWorkspaceSymbolsTool', () => {
    const mockCtx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find symbols', async () => {
        const mockSymbols = [
            {
                name: 'MyClass',
                kind: vscode.SymbolKind.Class,
                location: { uri: { path: '/path/to/file.ts' } },
            },
        ];
        (vscode.commands.executeCommand as any).mockResolvedValue(mockSymbols);

        const result = await searchWorkspaceSymbolsTool.execute({ query: 'MyClass' }, mockCtx);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.executeWorkspaceSymbolProvider', 'MyClass');
        expect(result.text).toContain('MyClass (Class) in /path/to/file.ts'); // 4 is Class kind in mock
    });

    it('should handle no symbols found', async () => {
        (vscode.commands.executeCommand as any).mockResolvedValue([]);

        const result = await searchWorkspaceSymbolsTool.execute({ query: 'NonExistent' }, mockCtx);

        expect(result.text).toBe('No symbols found.');
    });

    it('should throw error on failure', async () => {
        (vscode.commands.executeCommand as any).mockRejectedValue(new Error('Command failed'));

        await expect(searchWorkspaceSymbolsTool.execute({ query: 'MyClass' }, mockCtx)).rejects.toThrow('Command failed');
    });
});
