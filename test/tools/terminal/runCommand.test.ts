import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTerminalCommandTool } from '../../../src/tools/terminal/runCommand';
import * as cp from 'child_process';

vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

describe('runTerminalCommandTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should run command', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(null, 'command output', '');
        });

        const result = await runTerminalCommandTool.execute({ command: 'echo hello' });

        expect(cp.exec).toHaveBeenCalledWith('echo hello', expect.anything(), expect.anything());
        expect(result).toBe('command output');
    });

    it('should throw error on failure', async () => {
        (cp.exec as any).mockImplementation((cmd, opts, cb) => {
            cb(new Error('Command failed'), '', 'stderr');
        });

        await expect(runTerminalCommandTool.execute({ command: 'fail' })).rejects.toThrow('Command failed: Command failed');
    });

    it('should throw error when no workspace', async () => {
        const vscode = await import('vscode');
        const originalFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = undefined;

        await expect(runTerminalCommandTool.execute({ command: 'echo hello' })).rejects.toThrow('No workspace open');

        (vscode.workspace as any).workspaceFolders = originalFolders;
    });
});
