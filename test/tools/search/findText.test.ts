import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findTextTool } from '../../../src/tools/search/findText';
import { createMockContext } from '../../setup';
import * as cp from 'child_process';
import * as vscode from 'vscode';

vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

describe('findTextTool', () => {
    const mockCtx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find text using grep', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(null, 'match1\nmatch2', '');
        });

        const result = await findTextTool.execute({ query: 'search term' }, mockCtx);

        expect(cp.exec).toHaveBeenCalled();
        expect(result.text).toContain('match1');
        expect(result.text).toContain('match2');
    });

    it('should include pattern in grep command', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(null, 'match1', '');
        });

        await findTextTool.execute({ query: 'search term', includePattern: '*.ts' }, mockCtx);

        expect(cp.exec).toHaveBeenCalledWith(
            expect.stringContaining('--include="*.ts"'),
            expect.anything(),
            expect.anything()
        );
    });

    it('should handle no matches', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            const err: any = new Error('Command failed');
            err.code = 1;
            cb(err, '', '');
        });

        const result = await findTextTool.execute({ query: 'search term' }, mockCtx);

        expect(result.text).toBe('No matches found.');
    });

    it('should handle maxBuffer exceeded gracefully', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            const err: any = new Error('stdout maxBuffer length exceeded');
            cb(err, '', '');
        });

        const result = await findTextTool.execute({ query: 'search term' }, mockCtx);

        expect(result.text).toContain('Too many results');
    });

    it('should throw error on failure', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(new Error('Execution failed'), '', 'stderr output');
        });

        await expect(findTextTool.execute({ query: 'search term' }, mockCtx)).rejects.toThrow('Grep error: Execution failed');
    });

    it('should throw error when no workspace', async () => {
        const originalFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = undefined;

        await expect(findTextTool.execute({ query: 'search term' }, mockCtx)).rejects.toThrow('No workspace open');

        (vscode.workspace as any).workspaceFolders = originalFolders;
    });
});
