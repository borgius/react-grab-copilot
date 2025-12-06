import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceStringTool } from '../../../src/tools/edit/replaceString';
import * as vscode from 'vscode';

describe('replaceStringTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should replace a unique string', async () => {
        const mockContent = 'Hello world, hello universe';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
            positionAt: vi.fn(),
            save: vi.fn(),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.applyEdit as any).mockResolvedValue(true);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        const result = await replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'universe', 
            newString: 'galaxy' 
        });

        expect(vscode.workspace.applyEdit).toHaveBeenCalled();
        expect(mockDocument.save).toHaveBeenCalled();
        expect(result).toContain('Successfully replaced string');
    });

    it('should fail if oldString is not found', async () => {
        const mockContent = 'Hello world';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        const result = await replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'universe', 
            newString: 'galaxy' 
        });

        expect(result).toContain('Error: oldString not found');
    });

    it('should fail if oldString is not unique', async () => {
        const mockContent = 'Hello world, hello world';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        const result = await replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'world', 
            newString: 'galaxy' 
        });

        expect(result).toContain('Error: oldString is not unique');
    });
});
