import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceStringTool } from '../../../src/tools/edit/replaceString';
import { createMockContext } from '../../setup';
import * as vscode from 'vscode';

describe('replaceStringTool', () => {
    const mockCtx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should replace a unique string', async () => {
        const mockContent = 'Hello world, hello universe';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
            positionAt: vi.fn((offset) => new vscode.Position(0, offset)),
            save: vi.fn(),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.applyEdit as any).mockResolvedValue(true);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        const result = await replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'universe', 
            newString: 'galaxy' 
        }, mockCtx);

        expect(vscode.workspace.applyEdit).toHaveBeenCalled();
        expect(mockDocument.save).toHaveBeenCalled();
        expect(result.text).toContain('replaced string');
    });

    it('should fail if oldString is not found', async () => {
        const mockContent = 'Hello world';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        await expect(replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'universe', 
            newString: 'galaxy' 
        }, mockCtx)).rejects.toThrow('oldString not found');
    });

    it('should fail if oldString is not unique', async () => {
        const mockContent = 'Hello world, hello world';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        await expect(replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'world', 
            newString: 'galaxy' 
        }, mockCtx)).rejects.toThrow('oldString is not unique');
    });

    it('should match with different whitespace', async () => {
        const mockContent = 'const x =  1;'; // Two spaces
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
            positionAt: vi.fn((offset) => new vscode.Position(0, offset)),
            save: vi.fn(),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.applyEdit as any).mockResolvedValue(true);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        const result = await replaceStringTool.execute({ 
            filePath: '/path/to/file.txt', 
            oldString: 'const x = 1;', // One space
            newString: 'const x = 2;' 
        }, mockCtx);

        expect(result.text).toContain('replaced string');
    });

    it('should match when file has extra spaces but oldString does not', async () => {
        const mockContent = 'const x = { "data-accent-color" : "red" };';
        const mockDocument = {
            getText: vi.fn().mockReturnValue(mockContent),
            positionAt: vi.fn((offset) => new vscode.Position(0, offset)),
            save: vi.fn(),
        };
        (vscode.workspace.openTextDocument as any).mockResolvedValue(mockDocument);
        (vscode.workspace.applyEdit as any).mockResolvedValue(true);
        (vscode.workspace.fs.stat as any).mockResolvedValue({});

        const result = await replaceStringTool.execute({ 
            filePath: '/path/to/file.tsx', 
            oldString: '"data-accent-color":"red"', 
            newString: '"data-accent-color":"blue"' 
        }, mockCtx);

        expect(result.text).toContain('Successfully replaced string');
    });

    it('should fail if file is not found', async () => {
        (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('File not found'));

        await expect(replaceStringTool.execute({ 
            filePath: '/path/to/nonexistent.txt', 
            oldString: 'foo', 
            newString: 'bar' 
        }, mockCtx)).rejects.toThrow('File not found');
    });
});
