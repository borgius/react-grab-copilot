import { vi } from "vitest";
import { vscode } from "./mocks/vscode";

vi.mock("vscode", () => vscode);

// Mock ToolContext for testing
export const createMockContext = () => ({
  stream: {
    markdown: vi.fn(),
    reference: vi.fn(),
  },
});
