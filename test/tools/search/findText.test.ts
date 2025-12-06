import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findTextTool } from '../../../src/tools/search/findText';
import * as cp from 'child_process';
import * as vscode from 'vscode';

vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

describe('findTextTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find text using grep', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(null, 'match1\nmatch2', '');
        });

        const result = await findTextTool.execute({ query: 'search term' });

        expect(cp.exec).toHaveBeenCalled();
        expect(result).toContain('match1');
        expect(result).toContain('match2');
    });

    it('should handle no matches', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            const err: any = new Error('Command failed');
            err.code = 1;
            cb(err, '', '');
        });

        const result = await findTextTool.execute({ query: 'search term' });

        expect(result).toBe('No matches found.');
    });

    it('should handle errors', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(new Error('Execution failed'), '', 'stderr output');
        });

        const result = await findTextTool.execute({ query: 'search term' });

        expect(result).toContain('Error: Execution failed');
        expect(result).toContain('Stderr: stderr output');
    });

    it('should handle no workspace', async () => {
        const originalFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = undefined;

        const result = await findTextTool.execute({ query: 'search term' });

        expect(result).toBe('No workspace open');

        (vscode.workspace as any).workspaceFolders = originalFolders;
    });
});
