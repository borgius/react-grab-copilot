import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scmChangesTool } from '../../../src/tools/scm/scmChanges';
import * as cp from 'child_process';
import * as vscode from 'vscode';

vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

describe('scmChangesTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should get git changes', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(null, 'diff content', '');
        });

        const result = await scmChangesTool.execute({});

        expect(cp.exec).toHaveBeenCalledWith('git diff HEAD', expect.anything(), expect.anything());
        expect(result).toBe('diff content');
    });

    it('should handle no changes', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(null, '', '');
        });

        const result = await scmChangesTool.execute({});

        expect(result).toBe('No changes found.');
    });

    it('should throw error on git failure', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(new Error('Git failed'), '', 'stderr');
        });

        await expect(scmChangesTool.execute({})).rejects.toThrow('Git error: Git failed');
    });

    it('should throw error when no workspace', async () => {
        const originalFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = undefined;

        await expect(scmChangesTool.execute({})).rejects.toThrow('No workspace open');

        (vscode.workspace as any).workspaceFolders = originalFolders;
    });
});
