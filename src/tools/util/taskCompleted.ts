import * as vscode from 'vscode';
import { Tool } from '../tool';
import { EventEmitter } from 'events';

export const createGrabTaskCompletedTool = (eventEmitter: EventEmitter): Tool => ({
    definition: {
        name: 'grabTaskCompleted',
        description: 'Signal that the task is completed',
        inputSchema: {
            type: 'object',
            properties: {
                requestId: {
                    type: 'string',
                    description: 'The ID of the request that is completed'
                }
            },
            required: ['requestId']
        }
    },
    execute: async (args: { requestId: string }) => {
        eventEmitter.emit(args.requestId, "done");
        return "Task marked as completed.";
    }
});
