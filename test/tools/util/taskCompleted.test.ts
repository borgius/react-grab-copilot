import { describe, it, expect, vi } from 'vitest';
import { createGrabTaskCompletedTool } from '../../../src/tools/util/taskCompleted';
import { createMockContext } from '../../setup';
import { EventEmitter } from 'events';

describe('createGrabTaskCompletedTool', () => {
    const mockCtx = createMockContext();

    it('should emit event on execution', async () => {
        const eventEmitter = new EventEmitter();
        const emitSpy = vi.spyOn(eventEmitter, 'emit');
        const tool = createGrabTaskCompletedTool(eventEmitter);

        const result = await tool.execute({ requestId: 'req-123' }, mockCtx);

        expect(emitSpy).toHaveBeenCalledWith('req-123', 'done');
        expect(result.text).toBe('Task marked as completed.');
    });
});
