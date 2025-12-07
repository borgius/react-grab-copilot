import type * as vscode from "vscode";
import type { EventEmitter } from "events";

export interface ToolContext {
  stream: vscode.ChatResponseStream;
  eventEmitter?: EventEmitter;
  requestId?: string | null;
}

export interface Tool {
  definition: vscode.LanguageModelChatTool;
  execute(args: unknown, ctx: ToolContext): Promise<ToolOutput>;
}

// Tool output that can include both text and TSX content
export interface ToolOutput {
  // Plain text result for the LLM
  text: string;
  // Optional TSX element to render (for richer output)
  tsx?: unknown;
}

// Helper to create simple text output
export function textResult(text: string): ToolOutput {
  return { text };
}

// Helper functions for stream output
export function streamMarkdown(ctx: ToolContext, content: string) {
  ctx.stream.markdown(content);
}

export function streamFile(
  ctx: ToolContext,
  filePath: string,
  content: string,
) {
  const lines = content.split("\n").length;
  ctx.stream.markdown(
    `📄 **${filePath}** _(${lines} lines, ${content.length} chars)_\n`,
  );
}

export function streamResult(
  ctx: ToolContext,
  result: string,
  maxLength: number = 2000,
) {
  const displayResult =
    result.length > maxLength
      ? result.substring(0, maxLength) +
        `\n... (${result.length - maxLength} more chars)`
      : result;
  ctx.stream.markdown(`\`\`\`\n${displayResult}\n\`\`\`\n`);
}

export function streamError(ctx: ToolContext, message: string) {
  ctx.stream.markdown(`❌ **Error:** ${message}\n`);
}

export function streamInfo(ctx: ToolContext, message: string) {
  ctx.stream.markdown(`ℹ️ ${message}\n`);
}

export function streamSuccess(ctx: ToolContext, message: string) {
  ctx.stream.markdown(`✅ ${message}\n`);
}
