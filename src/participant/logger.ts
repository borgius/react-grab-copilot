import type * as vscode from "vscode";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Structured logger for the chat participant.
 * Provides consistent formatting and log level filtering.
 */
export class Logger {
  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly logLevel: LogLevel = "INFO",
  ) {}

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string): string {
    return `[${new Date().toISOString()}] [${level}] ${message}`;
  }

  debug(message: string, data?: unknown): void {
    if (!this.shouldLog("DEBUG")) return;
    this.outputChannel.appendLine(this.formatMessage("DEBUG", message));
    if (data !== undefined) {
      this.outputChannel.appendLine(
        typeof data === "string" ? data : JSON.stringify(data, null, 2),
      );
    }
  }

  info(message: string): void {
    if (!this.shouldLog("INFO")) return;
    this.outputChannel.appendLine(this.formatMessage("INFO", message));
  }

  warn(message: string): void {
    if (!this.shouldLog("WARN")) return;
    this.outputChannel.appendLine(this.formatMessage("WARN", message));
  }

  error(message: string, error?: unknown): void {
    if (!this.shouldLog("ERROR")) return;
    const errorDetail =
      error instanceof Error ? error.message : String(error ?? "");
    const fullMessage = errorDetail ? `${message}: ${errorDetail}` : message;
    this.outputChannel.appendLine(this.formatMessage("ERROR", fullMessage));
  }

  /**
   * Log LLM request details (only at DEBUG level)
   */
  logLLMRequest(
    model: { name: string; id: string },
    messages: vscode.LanguageModelChatMessage[],
    requestOptions: vscode.LanguageModelChatRequestOptions,
  ): void {
    if (!this.shouldLog("DEBUG")) return;

    this.outputChannel.appendLine(
      this.formatMessage("DEBUG", "=== LLM Request ==="),
    );
    this.outputChannel.appendLine(
      this.formatMessage("DEBUG", `Model: ${model.name} (${model.id})`),
    );
    this.outputChannel.appendLine(
      this.formatMessage(
        "DEBUG",
        `Request Options: ${JSON.stringify(requestOptions, null, 2)}`,
      ),
    );
    this.outputChannel.appendLine(
      this.formatMessage("DEBUG", `Messages (${messages.length}):`),
    );

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const role = this.getRoleName(msg.role);
      const contentPreview = this.formatMessageContent(msg.content);
      this.outputChannel.appendLine(
        this.formatMessage("DEBUG", `  [${i}] ${role}: ${contentPreview}`),
      );
    }

    this.outputChannel.appendLine(
      this.formatMessage("DEBUG", "=== End LLM Request ==="),
    );
  }

  private getRoleName(role: vscode.LanguageModelChatMessageRole): string {
    // VS Code API: 1 = User, 2 = Assistant
    return role === 1 ? "User" : "Assistant";
  }

  private formatMessageContent(content: readonly unknown[]): string {
    return content
      .map((part) => {
        const partType = (part as object).constructor.name;
        if (
          part &&
          typeof part === "object" &&
          "value" in part &&
          typeof (part as { value: unknown }).value === "string"
        ) {
          const value = (part as { value: string }).value;
          return `Text(${value.length} chars): ${value.substring(0, 500)}${value.length > 500 ? "..." : ""}`;
        }
        if (part && typeof part === "object" && "name" in part) {
          const p = part as { name: string; input?: unknown };
          return `ToolCall: ${p.name}(${JSON.stringify(p.input ?? {})})`;
        }
        if (part && typeof part === "object" && "callId" in part) {
          return `ToolResult: callId=${(part as { callId: string }).callId}`;
        }
        if (partType === "LanguageModelDataPart") {
          return "DataPart: image";
        }
        return `Unknown: ${partType}`;
      })
      .join(", ");
  }
}

/**
 * Create a logger instance from VS Code configuration
 */
export function createLogger(
  outputChannel: vscode.OutputChannel,
  logLevel?: string,
): Logger {
  const level = (logLevel?.toUpperCase() ?? "INFO") as LogLevel;
  const validLevel = LOG_LEVEL_PRIORITY[level] !== undefined ? level : "INFO";
  return new Logger(outputChannel, validLevel);
}
