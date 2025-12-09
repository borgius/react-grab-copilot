import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";
import { createGrabTaskCompletedTool } from "../../../src/tools/util/taskCompleted";
import { createMockContext } from "../../setup";

describe("createGrabTaskCompletedTool", () => {
  const mockCtx = createMockContext();

  it("should emit event on execution", async () => {
    const eventEmitter = new EventEmitter();
    const emitSpy = vi.spyOn(eventEmitter, "emit");
    const tool = createGrabTaskCompletedTool(eventEmitter);

    const result = await tool.execute({ requestId: "req-123" }, mockCtx);

    expect(emitSpy).toHaveBeenCalledWith("req-123", "done");
    expect(result.text).toBe("Task marked as completed.");
  });
});
