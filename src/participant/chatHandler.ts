import type { EventEmitter } from "node:events";
import * as vscode from "vscode";
import type { Tool, ToolContext, ToolOutput } from "../tools/tool";
import type { Logger } from "./logger";

/**
 * Model capabilities extracted from the language model
 */
export interface ModelCapabilities {
  supportsVision: boolean;
  supportsTools: boolean;
}

/**
 * Response stream fragment types
 */
type ResponsePart =
  | vscode.LanguageModelTextPart
  | vscode.LanguageModelToolCallPart;

/**
 * Handles the chat conversation loop with the language model
 */
export class ChatHandler {
  private readonly messages: vscode.LanguageModelChatMessage[];
  private readonly toolContext: ToolContext;
  private readonly modelCapabilities: ModelCapabilities;
  private thinkingBuffer = "";

  constructor(
    private readonly model: vscode.LanguageModelChat,
    private readonly availableTools: Tool[],
    private readonly stream: vscode.ChatResponseStream,
    private readonly eventEmitter: EventEmitter,
    private readonly requestId: string | null,
    private readonly logger: Logger,
    initialMessages: vscode.LanguageModelChatMessage[],
  ) {
    this.messages = [...initialMessages];
    this.toolContext = {
      stream,
      eventEmitter,
      requestId,
      outputChannel: undefined, // Logger handles output now
    };
    this.modelCapabilities = this.extractModelCapabilities();
  }

  /**
   * Extract model capabilities from the model object
   */
  private extractModelCapabilities(): ModelCapabilities {
    const capabilities = (
      this.model as unknown as {
        capabilities?: {
          supportsImageToText?: boolean;
          supportsToolCalling?: boolean;
        };
      }
    ).capabilities;
    return {
      supportsVision: capabilities?.supportsImageToText ?? false,
      supportsTools: capabilities?.supportsToolCalling ?? true,
    };
  }

  get supportsVision(): boolean {
    return this.modelCapabilities.supportsVision;
  }

  /**
   * Check if any message contains images
   */
  hasImages(): boolean {
    return this.messages.some((msg) =>
      msg.content.some(
        (part) => part.constructor.name === "LanguageModelDataPart",
      ),
    );
  }

  /**
   * Run the chat loop until completion or cancellation
   */
  async run(token: vscode.CancellationToken): Promise<void> {
    const toolDefinitions = this.availableTools.map((t) => t.definition);

    try {
      while (!token.isCancellationRequested) {
        const requestOptions = this.buildRequestOptions(toolDefinitions);

        this.logger.logLLMRequest(
          { name: this.model.name, id: this.model.id },
          this.messages,
          requestOptions,
        );

        const chatRequest = await this.model.sendRequest(
          this.messages,
          requestOptions,
          token,
        );

        const { responseParts, toolCalls } = await this.processResponseStream(
          chatRequest.stream,
        );

        // Add assistant response to conversation
        this.messages.push(
          vscode.LanguageModelChatMessage.Assistant(responseParts),
        );

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          break;
        }

        // Execute tools and add results to conversation
        const toolResults = await this.executeToolCalls(toolCalls);
        this.messages.push(vscode.LanguageModelChatMessage.User(toolResults));
      }
    } finally {
      this.signalCompletion();
    }
  }

  /**
   * Build request options for the language model
   */
  private buildRequestOptions(
    toolDefinitions: vscode.LanguageModelChatTool[],
  ): vscode.LanguageModelChatRequestOptions {
    const options: vscode.LanguageModelChatRequestOptions = {
      tools: toolDefinitions,
    };

    if (this.hasImages()) {
      options.modelOptions = { "Copilot-Vision-Request": "true" };
    }

    return options;
  }

  /**
   * Process the response stream from the language model
   */
  private async processResponseStream(
    responseStream: AsyncIterable<unknown>,
  ): Promise<{
    responseParts: ResponsePart[];
    toolCalls: vscode.LanguageModelToolCallPart[];
  }> {
    const responseParts: ResponsePart[] = [];
    const toolCalls: vscode.LanguageModelToolCallPart[] = [];
    let hasShownThinking = false;

    for await (const fragment of responseStream) {
      if (fragment instanceof vscode.LanguageModelTextPart) {
        hasShownThinking = this.handleTextFragment(fragment, hasShownThinking);
        responseParts.push(fragment);
      } else if (fragment instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push(fragment);
        responseParts.push(fragment);
      }
    }

    // Flush buffered thinking content to SSE clients
    this.flushThinkingBuffer();

    // Add spacing after thinking if there were tool calls
    if (hasShownThinking && toolCalls.length > 0) {
      this.stream.markdown("\n");
    }

    return { responseParts, toolCalls };
  }

  /**
   * Handle a text fragment from the response stream
   */
  private handleTextFragment(
    fragment: vscode.LanguageModelTextPart,
    hasShownThinking: boolean,
  ): boolean {
    if (!hasShownThinking && fragment.value.trim()) {
      hasShownThinking = true;
    }

    this.stream.markdown(fragment.value);

    // Buffer text for SSE clients - will be flushed at end of stream
    if (this.requestId) {
      this.thinkingBuffer += fragment.value;
    }

    return hasShownThinking;
  }

  /**
   * Flush buffered thinking content to SSE clients
   */
  private flushThinkingBuffer(): void {
    if (this.requestId && this.thinkingBuffer.trim()) {
      this.eventEmitter.emit(`${this.requestId}:status`, {
        thinking: this.thinkingBuffer.trim(),
      });
    }
    this.thinkingBuffer = "";
  }

  /**
   * Execute all tool calls and collect results
   */
  private async executeToolCalls(
    toolCalls: vscode.LanguageModelToolCallPart[],
  ): Promise<vscode.LanguageModelToolResultPart[]> {
    const results: vscode.LanguageModelToolResultPart[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeSingleToolCall(toolCall);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single tool call
   */
  private async executeSingleToolCall(
    toolCall: vscode.LanguageModelToolCallPart,
  ): Promise<vscode.LanguageModelToolResultPart> {
    this.stream.markdown(`\n🔧 Using **${toolCall.name}**\n`);

    // Emit status event for SSE clients
    if (this.requestId) {
      this.eventEmitter.emit(`${this.requestId}:status`, {
        tool: toolCall.name,
        input: toolCall.input,
      });
    }

    const result = await this.runTool(toolCall);
    this.stream.markdown("\n");

    return this.buildToolResultPart(toolCall.callId, result);
  }

  /**
   * Run a tool and handle errors
   */
  private async runTool(
    toolCall: vscode.LanguageModelToolCallPart,
  ): Promise<ToolOutput> {
    const tool = this.availableTools.find(
      (t) => t.definition.name === toolCall.name,
    );

    if (!tool) {
      this.stream.markdown("❌ **Error:** Tool not found\n");
      return { text: "Tool not found" };
    }

    try {
      const result = await tool.execute(toolCall.input, this.toolContext);

      if (!result || !result.text) {
        return { text: "Tool returned no result" };
      }

      this.logger.info(
        `Tool ${toolCall.name} result length: ${result.text.length}`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.stream.markdown(`❌ **Error:** ${errorMessage}\n`);
      this.logger.error(`Tool ${toolCall.name} error`, err);
      return { text: `Error executing tool: ${errorMessage}` };
    }
  }

  /**
   * Build a tool result part with optional image data
   */
  private buildToolResultPart(
    callId: string,
    result: ToolOutput,
  ): vscode.LanguageModelToolResultPart {
    const resultContent: (
      | vscode.LanguageModelTextPart
      | vscode.LanguageModelDataPart
    )[] = [new vscode.LanguageModelTextPart(result.text)];

    // Include image if returned and model supports vision
    if (result.image && this.supportsVision) {
      const imageData = Buffer.from(result.image.data, "base64");
      resultContent.push(
        vscode.LanguageModelDataPart.image(imageData, result.image.mimeType),
      );
      this.logger.info(
        `Including image in tool result: ${result.image.description || "screenshot"}`,
      );
    }

    return new vscode.LanguageModelToolResultPart(callId, resultContent);
  }

  /**
   * Signal completion of the request
   */
  private signalCompletion(): void {
    if (this.requestId) {
      this.eventEmitter.emit(this.requestId, "done");
      this.logger.info(`Emitted completion for request: ${this.requestId}`);
    }
  }
}
