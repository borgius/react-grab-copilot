import type { EventEmitter } from "events";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { streamSuccess } from "../tool";

export const createGrabTaskCompletedTool = (
  eventEmitter: EventEmitter,
): Tool => ({
  definition: {
    name: "grabTaskCompleted",
    description: "Signal that the task is completed",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "The ID of the request that is completed",
        },
      },
      required: ["requestId"],
    },
  },
  execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
    const { requestId } = args as { requestId: string };
    eventEmitter.emit(requestId, "done");
    streamSuccess(ctx, "Task marked as completed.");
    return { text: "Task marked as completed." };
  },
});
