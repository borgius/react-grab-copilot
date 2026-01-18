import { serve } from "@hono/node-server";
import * as crypto from "crypto";
import type { EventEmitter } from "events";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import * as vscode from "vscode";
import type { Logger } from "../participant/logger";
import { buildEnrichedQuery } from "../participant/queryBuilder";
import {
  detectAppPorts,
  getWorkspaceName,
  getWorkspacePaths,
  type DetectedAppPort,
} from "./appPortDetector";

export interface ImageData {
  type: string;
  data: string;
  description?: string;
}

/**
 * Request body for the /agent endpoint
 */
export interface AgentRequestBody {
  prompt: string;
  content?: string;
  images?: ImageData[];
  systemPrompt?: string;
  options?: {
    model?: string;
  };
  /** Send directly to LM API without @react-grab participant (fire-and-forget) */
  directMessage?: boolean;
  /** If true, run silently without opening chat panel (only applies to directMessage=true) */
  background?: boolean;
}

// Shared store for images, keyed by requestId
export const requestImages = new Map<string, ImageData[]>();

// Shared store for custom system prompts, keyed by requestId
export const requestSystemPrompts = new Map<string, string>();

export function startServer(
  context: vscode.ExtensionContext,
  eventEmitter: EventEmitter,
  outputChannel: vscode.OutputChannel,
  statusBarItem: vscode.StatusBarItem,
  logger: Logger,
): any {
  const config = vscode.workspace.getConfiguration("reactGrabCopilot");
  const port = config.get<number>("port", 6567);

  logger.info(`Initializing HTTP server on port ${port}`);

  statusBarItem.text = `$(radio-tower) Copilot Agent: ${port}`;
  statusBarItem.show();

  const app = new Hono();
  app.use("/*", cors());

  // Cache for detected app ports (refresh every 30 seconds)
  let cachedAppPorts: {
    ports: DetectedAppPort[];
    primaryPort: number | null;
    timestamp: number;
  } | null = null;
  const APP_PORT_CACHE_TTL = 30000; // 30 seconds

  async function getAppPortInfo() {
    const now = Date.now();
    if (cachedAppPorts && now - cachedAppPorts.timestamp < APP_PORT_CACHE_TTL) {
      return cachedAppPorts;
    }
    const result = await detectAppPorts();
    cachedAppPorts = { ...result, timestamp: now };
    return cachedAppPorts;
  }

  // Health check endpoint with app port detection
  app.get("/health", async (c) => {
    logger.debug("Health check requested");
    try {
      const appPortInfo = await getAppPortInfo();
      const workspaceName = getWorkspaceName();
      const workspacePaths = getWorkspacePaths();

      return c.json({
        status: "ok",
        serverPort: port,
        workspaceName,
        workspacePaths,
        appPort: appPortInfo.primaryPort,
        detectedPorts: appPortInfo.ports,
      });
    } catch (err) {
      logger.error("Health check error", err);
      return c.json({
        status: "ok",
        serverPort: port,
        appPort: null,
        detectedPorts: [],
      });
    }
  });

  // Screenshot endpoint - get screenshots by requestId
  app.get("/screenshot/:requestId", (c) => {
    const { requestId } = c.req.param();
    logger.debug(`Screenshot requested for request ID: ${requestId}`);
    const images = requestImages.get(requestId);

    if (!images || images.length === 0) {
      logger.warn(`No screenshots found for request ID: ${requestId}`);
      return c.json({ error: "No screenshots found for this request" }, 404);
    }

    logger.debug(
      `Returning ${images.length} screenshots for request ID: ${requestId}`,
    );
    // Return metadata about available screenshots
    return c.json({
      requestId,
      count: images.length,
      screenshots: images.map((img, index) => ({
        index,
        type: img.type,
        description: img.description,
        // Include base64 data for each image
        data: img.data,
      })),
    });
  });

  // Screenshot endpoint - get specific screenshot by index
  app.get("/screenshot/:requestId/:index", (c) => {
    const { requestId, index } = c.req.param();
    logger.debug(`Screenshot ${index} requested for request ID: ${requestId}`);
    const images = requestImages.get(requestId);

    if (!images || images.length === 0) {
      logger.warn(`No screenshots found for request ID: ${requestId}`);
      return c.json({ error: "No screenshots found for this request" }, 404);
    }

    const idx = Number.parseInt(index, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= images.length) {
      logger.warn(
        `Invalid screenshot index ${index} for request ID: ${requestId}`,
      );
      return c.json(
        { error: `Invalid index. Available: 0-${images.length - 1}` },
        400,
      );
    }

    const image = images[idx];
    logger.debug(`Returning screenshot ${idx} for request ID: ${requestId}`);

    // Return the image as binary with proper content type
    const imageBuffer = Buffer.from(image.data, "base64");
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": image.type,
        "Content-Disposition": `inline; filename="screenshot-${idx}.png"`,
      },
    });
  });

  // Models endpoint - list available Copilot models and capabilities
  app.get("/models", async (c) => {
    logger.debug("Models list requested");
    try {
      // Get all available Copilot models
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      logger.info(`Found ${models.length} Copilot models`);

      const modelList = models.map((model) => {
        // Extract capabilities from the model
        const capabilities = (
          model as unknown as {
            capabilities?: {
              supportsImageToText?: boolean;
              supportsToolCalling?: boolean;
            };
          }
        ).capabilities;

        return {
          id: model.id,
          name: model.name,
          vendor: model.vendor,
          family: model.family,
          version: model.version,
          maxInputTokens: model.maxInputTokens,
          capabilities: {
            supportsVision: capabilities?.supportsImageToText ?? false,
            supportsTools: capabilities?.supportsToolCalling ?? true,
          },
        };
      });

      return c.json({ models: modelList });
    } catch (err: unknown) {
      logger.error("Failed to fetch models", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: msg }, 500);
    }
  });

  // Prompt improvement endpoint
  app.post("/prompt", async (c) => {
    logger.debug("Prompt improvement requested");
    let body: {
      prompt?: string;
      content?: string;
      systemPrompt?: string;
      options?: { model?: string };
    };
    try {
      body = await c.req.json();
    } catch (_e) {
      logger.warn("Invalid JSON in /prompt request");
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { prompt, content, systemPrompt, options } = body;

    if (!prompt) {
      logger.warn("Prompt improvement request missing prompt");
      return c.json({ error: "Prompt is required" }, 400);
    }

    logger.info(
      `Generating prompt variants for: ${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}`,
    );

    try {
      // Select the language model
      const modelSelector: vscode.LanguageModelChatSelector = {
        vendor: "copilot",
        family: options?.model || "gpt-4o",
      };

      const [model] = await vscode.lm.selectChatModels(modelSelector);

      if (!model) {
        logger.error("No suitable model found for prompt improvement");
        return c.json({ error: "No suitable model found" }, 500);
      }

      logger.debug(`Using model: ${model.name} (${model.id})`);

      // Build the analysis prompt
      const contextInfo = content ? `\n\nContext:\n${content}` : "";
      const systemPromptInfo = systemPrompt
        ? `\n\nSystem prompt guidelines:\n${systemPrompt}`
        : "";
      const analysisPrompt = `You are an expert prompt engineer specialized in software development. Analyze the following user prompt and context, then generate 3 improved variants that:
1. Are more specific and actionable
2. Include relevant technical details from the context
3. Are optimized for code generation/modification tasks
4. Follow best practices for clarity and precision${systemPrompt ? "\n5. Align with the provided system prompt guidelines" : ""}

User's original prompt: "${prompt}"${contextInfo}${systemPromptInfo}

Return ONLY a JSON array with 3 prompt variants. Each variant should be a complete, standalone prompt that could replace the original. Format:
[
  "First improved prompt variant",
  "Second improved prompt variant",
  "Third improved prompt variant"
]

IMPORTANT: Return ONLY the JSON array, no other text or explanations.`;

      const messages = [vscode.LanguageModelChatMessage.User(analysisPrompt)];

      const chatRequest = await model.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token,
      );

      let responseText = "";
      for await (const fragment of chatRequest.text) {
        responseText += fragment;
      }

      // Parse the JSON response
      let variants: string[];
      try {
        // Try to extract JSON array from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          variants = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON array found in response");
        }

        if (!Array.isArray(variants) || variants.length !== 3) {
          throw new Error("Expected array of 3 variants");
        }

        logger.info("Successfully generated 3 prompt variants");
      } catch (_parseErr) {
        logger.warn(
          `Failed to parse prompt variants, using fallback. Response: ${responseText.substring(0, 100)}`,
        );
        // Fallback: return original prompt with slight variations
        variants = [
          `${prompt} (Please provide detailed implementation)`,
          `${prompt} (Include error handling and edge cases)`,
          `${prompt} (Follow project conventions and best practices)`,
        ];
      }

      return c.json({ variants });
    } catch (err: unknown) {
      logger.error("Failed to generate prompt variants", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: msg }, 500);
    }
  });

  // Queue for processing requests sequentially
  let requestQueue = Promise.resolve();

  app.post("/agent", async (c) => {
    logger.debug("Agent request received");
    let body: AgentRequestBody;
    try {
      body = await c.req.json();
    } catch (e) {
      logger.warn("Invalid JSON in /agent request");
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const {
      prompt,
      content,
      images,
      systemPrompt,
      options,
      directMessage,
      background,
    } = body;

    if (!prompt) {
      logger.warn("Agent request missing prompt");
      return c.json({ error: "Prompt is required" }, 400);
    }

    const requestId = crypto.randomUUID();
    const promptPreview = `${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`;

    logger.info(
      `${directMessage ? "Direct" : "Participant"} request ${requestId}: ${promptPreview}`,
    );
    if (images && Array.isArray(images) && images.length > 0) {
      logger.debug(`Request ${requestId} includes ${images.length} image(s)`);
    }
    if (systemPrompt) {
      logger.debug(`Request ${requestId} includes custom system prompt`);
    }

    // Handle direct message mode (fire-and-forget)
    // Sends to VS Code chat window without @react-grab participant
    if (directMessage) {
      logger.info(
        `Starting direct message ${requestId} (background: ${background ?? true})`,
      );
      // Store images for the screenshot endpoint to serve
      if (images && Array.isArray(images) && images.length > 0) {
        requestImages.set(requestId, images as ImageData[]);
        logger.debug(`Stored ${images.length} images for request ${requestId}`);
      }

      return streamSSE(c, async (stream) => {
        try {
          // Build screenshot info with descriptions
          const screenshotInfo =
            images && images.length > 0
              ? {
                  requestId,
                  port,
                  screenshots: images.map((img, index) => ({
                    index,
                    description: img.description,
                  })),
                }
              : undefined;

          // Build enriched query with default system prompt + request system prompt + source context
          const { query: enrichedQuery } = await buildEnrichedQuery({
            prompt,
            content,
            requestSystemPrompt: systemPrompt,
            screenshotInfo,
          });

          logger.debug(`Opening chat panel for request ${requestId}`);
          // Open chat panel (background flag controls focus behavior)
          await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: enrichedQuery,
          });

          logger.info(`Direct message ${requestId} started successfully`);
          // Fire and forget - emit status then done and close connection
          await stream.writeSSE({
            event: "status",
            data: `started direct message ${requestId}`,
          });
          await stream.writeSSE({ event: "done", data: "" });
        } catch (err: unknown) {
          logger.error(`Direct message ${requestId} failed`, err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          await stream.writeSSE({ event: "error", data: msg });
        }
      });
    }

    // Standard @react-grab participant flow
    // Store images for the participant to retrieve
    if (images && Array.isArray(images)) {
      requestImages.set(requestId, images as ImageData[]);
      logger.debug(`Stored ${images.length} images for request ${requestId}`);
    }

    // Store custom system prompt for the participant to retrieve
    if (systemPrompt && typeof systemPrompt === "string") {
      requestSystemPrompts.set(requestId, systemPrompt);
      logger.debug(`Stored custom system prompt for request ${requestId}`);
    }

    const formattedPrompt = `@react-grab ${prompt}

Context:
${content}

[request-id:${requestId}]`;

    logger.info(`Queued participant request ${requestId}`);

    return streamSSE(c, async (stream) => {
      const processRequest = async () => {
        logger.info(`Processing participant request ${requestId}`);
        try {
          // Set up status event listener for tool usage and thinking
          const statusHandler = async (data: {
            tool?: string;
            input?: unknown;
            thinking?: string;
          }) => {
            if (data.tool) {
              logger.debug(`Request ${requestId} using tool: ${data.tool}`);
              await stream.writeSSE({
                event: "status",
                data: `use tool ${data.tool}`,
              });
            } else if (data.thinking) {
              logger.debug(`Request ${requestId} thinking`);
              await stream.writeSSE({ event: "status", data: data.thinking });
            }
          };
          eventEmitter.on(`${requestId}:status`, statusHandler);

          logger.debug(`Opening chat panel for request ${requestId}`);
          await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: formattedPrompt,
          });

          await new Promise<void>((resolve) => {
            const handler = () => {
              resolve();
              clearTimeout(timeout);
            };
            eventEmitter.once(requestId, handler);
            const timeout = setTimeout(() => {
              logger.warn(`Request ${requestId} timed out after 60s`);
              eventEmitter.off(requestId, handler);
              resolve();
            }, 60000);
          });

          // Clean up status listener and stored images
          eventEmitter.off(`${requestId}:status`, statusHandler);
          requestImages.delete(requestId);
          requestSystemPrompts.delete(requestId);
          logger.info(`Request ${requestId} completed successfully`);

          await stream.writeSSE({ event: "done", data: "" });
        } catch (err: any) {
          logger.error(`Request ${requestId} failed`, err);
          const msg = err.message || "Unknown error";
          await stream.writeSSE({ event: "error", data: msg });
        }
      };

      // Chain the request
      const currentTask = requestQueue.then(processRequest);
      // Update queue to wait for this task (handling errors to keep queue alive)
      requestQueue = currentTask.catch(() => {});

      await currentTask;
    });
  });

  try {
    logger.info(`Starting HTTP server on port ${port}`);
    const server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        logger.info(`HTTP server started successfully on port ${info.port}`);
        statusBarItem.tooltip = `Listening on port ${info.port}`;
      },
    );
    return server;
  } catch (e: any) {
    logger.error(`Failed to start HTTP server on port ${port}`, e);
    vscode.window.showErrorMessage(
      `Failed to start React Grab Copilot server: ${e.message}`,
    );
    return null;
  }
}
