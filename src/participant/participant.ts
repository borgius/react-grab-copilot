import type { EventEmitter } from "node:events";
import { renderPrompt } from "@vscode/prompt-tsx";
import * as vscode from "vscode";
import { AgentSystemPrompt } from "../prompts/prompts";
import { requestImages, requestSystemPrompts } from "../server/server";
import { createScreenshotTool } from "../tools/screenshots/getScreenshot";
import type { Tool } from "../tools/tool";
import { ChatHandler } from "./chatHandler";
import { loadAgentsMdContent, loadParticipantConfig } from "./config";
import { createLogger, type Logger } from "./logger";
import { enrichQueryWithSourceContext } from "./sourceContext";

const PARTICIPANT_ID = "react-grab-copilot.participant";
const REQUEST_ID_PATTERN = /\[request-id:([a-zA-Z0-9-]+)\]/;

/**
 * Extract request ID from the prompt if present
 */
function extractRequestId(prompt: string): string | null {
  const match = prompt.match(REQUEST_ID_PATTERN);
  return match ? match[1] : null;
}

/**
 * Get model capabilities
 */
function getModelCapabilities(model: vscode.LanguageModelChat): {
  supportsVision: boolean;
  supportsTools: boolean;
} {
  const capabilities = (
    model as unknown as {
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

/**
 * Build the list of available tools, adding screenshot tool if applicable
 */
function buildAvailableTools(
  baseTools: Tool[],
  requestId: string | null,
  supportsVision: boolean,
  logger: Logger,
): Tool[] {
  const availableTools: Tool[] = [...baseTools];

  const screenshotTool = createScreenshotTool(requestId);
  if (screenshotTool && supportsVision) {
    availableTools.push(screenshotTool);
    logger.info("Added get_screenshot tool for this request");
  }

  return availableTools;
}

/**
 * Warn user if images are attached but model doesn't support vision
 */
function warnIfImagesUnsupported(
  requestId: string | null,
  supportsVision: boolean,
  modelName: string,
  stream: vscode.ChatResponseStream,
): void {
  if (!requestId) return;

  const images = requestImages.get(requestId);
  if (!images || images.length === 0) return;

  if (!supportsVision) {
    stream.markdown(
      `⚠️ *Note: The current model (${modelName}) does not support image input. Screenshots cannot be analyzed.*\n\n`,
    );
  }
}

/**
 * Create the chat request handler
 */
function createChatHandler(
  tools: Tool[],
  outputChannel: vscode.OutputChannel,
  eventEmitter: EventEmitter,
): vscode.ChatRequestHandler {
  return async (request, _context, stream, token) => {
    const config = loadParticipantConfig();
    const logger = createLogger(outputChannel, config.logLevel);

    logger.info(`Chat Request: ${request.prompt}`);

    const requestId = extractRequestId(request.prompt);
    const model = request.model;

    if (!model) {
      stream.markdown("No suitable model found.");
      return;
    }

    const { supportsVision, supportsTools } = getModelCapabilities(model);

    logger.info(
      `Using model: ${model.name} (${model.id}), family: ${model.family}, vendor: ${model.vendor}, vision: ${supportsVision}, tools: ${supportsTools}`,
    );

    // Build available tools
    const availableTools = buildAvailableTools(
      tools,
      requestId,
      supportsVision,
      logger,
    );

    // Load AGENTS.md content if enabled
    const agentsMdContent = config.useAgentsMd
      ? await loadAgentsMdContent()
      : undefined;

    // Get custom system prompt: prefer request-specific, fallback to config
    const customSystemPrompt = requestId
      ? requestSystemPrompts.get(requestId) || config.customSystemPrompt
      : config.customSystemPrompt;

    // Enrich query with source context if present
    const {
      query: userQuery,
      sourceRef,
      contextAdded,
    } = await enrichQueryWithSourceContext(request.prompt);

    if (sourceRef) {
      logger.info(
        `Found source reference: ${sourceRef.path}:${sourceRef.line}`,
      );
      if (contextAdded) {
        logger.info(`Added source context from ${sourceRef.path}`);
      } else {
        logger.warn(`Could not read source file: ${sourceRef.path}`);
      }
    }

    // Render TSX prompt
    const { messages } = await renderPrompt(
      AgentSystemPrompt,
      {
        userQuery,
        customSystemPrompt,
        agentsMdContent,
        allowMcp: config.allowMcp,
      },
      { modelMaxPromptTokens: model.maxInputTokens },
      model,
    );

    // Warn if images attached but model doesn't support vision
    warnIfImagesUnsupported(requestId, supportsVision, model.name, stream);

    // Create and run the chat handler
    const chatHandler = new ChatHandler(
      model,
      availableTools,
      stream,
      eventEmitter,
      requestId,
      logger,
      messages,
    );

    try {
      await chatHandler.run(token);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      stream.markdown(`\n\n**Error:** Error in chat loop: ${errorMessage}`);
      logger.error("Error in chat loop", err);
    }
  };
}

/**
 * Register the chat participant with VS Code
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  tools: Tool[],
  outputChannel: vscode.OutputChannel,
  eventEmitter: EventEmitter,
): void {
  const handler = createChatHandler(tools, outputChannel, eventEmitter);
  const participant = vscode.chat.createChatParticipant(
    PARTICIPANT_ID,
    handler,
  );
  context.subscriptions.push(participant);
}
