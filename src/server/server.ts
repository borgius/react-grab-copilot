import { serve } from "@hono/node-server";
import * as crypto from "crypto";
import type { EventEmitter } from "events";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import * as vscode from "vscode";
import { buildEnrichedQuery } from "../participant/queryBuilder";

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
): any {
  const config = vscode.workspace.getConfiguration("reactGrabCopilot");
  const port = config.get<number>("port", 6567);

  statusBarItem.text = `$(radio-tower) Copilot Agent: ${port}`;
  statusBarItem.show();

  const app = new Hono();
  app.use("/*", cors());

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  // Models endpoint - list available Copilot models and capabilities
  app.get("/models", async (c) => {
    try {
      // Get all available Copilot models
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });

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
      console.error("Error fetching models:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      outputChannel.appendLine(
        `[${new Date().toISOString()}] Error in /models endpoint: ${msg}`,
      );
      return c.json({ error: msg }, 500);
    }
  });

  // Prompt improvement endpoint
  app.post("/prompt", async (c) => {
    let body: {
      prompt?: string;
      content?: string;
      systemPrompt?: string;
      options?: { model?: string };
    };
    try {
      body = await c.req.json();
    } catch (_e) {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { prompt, content, systemPrompt, options } = body;

    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    try {
      // Select the language model
      const modelSelector: vscode.LanguageModelChatSelector = {
        vendor: "copilot",
        family: options?.model || "gpt-4o",
      };

      const [model] = await vscode.lm.selectChatModels(modelSelector);

      if (!model) {
        return c.json({ error: "No suitable model found" }, 500);
      }

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
      } catch (_parseErr) {
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Failed to parse prompt variants: ${responseText}`,
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
      console.error("Error generating prompt variants:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      outputChannel.appendLine(
        `[${new Date().toISOString()}] Error in /prompt endpoint: ${msg}`,
      );
      return c.json({ error: msg }, 500);
    }
  });

  // Queue for processing requests sequentially
  let requestQueue = Promise.resolve();

  app.post("/agent", async (c) => {
    let body: AgentRequestBody;
    try {
      body = await c.req.json();
    } catch (e) {
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
      return c.json({ error: "Prompt is required" }, 400);
    }

    const requestId = crypto.randomUUID();

    outputChannel.appendLine(
      `[${new Date().toISOString()}] ${directMessage ? "Direct" : "Participant"} Request: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
    );

    // Handle direct message mode (fire-and-forget)
    // Sends to VS Code chat window without @react-grab participant
    if (directMessage) {
      return streamSSE(c, async (stream) => {
        try {
          // Build enriched query with default system prompt + request system prompt + source context
          const { query: enrichedQuery } = await buildEnrichedQuery({
            prompt,
            content,
            requestSystemPrompt: systemPrompt,
          });

          // Open chat panel (background flag controls focus behavior)
          await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: enrichedQuery,
          });

          // Fire and forget - emit status then done and close connection
          await stream.writeSSE({
            event: "status",
            data: `started direct message ${requestId}`,
          });
          await stream.writeSSE({ event: "done", data: "" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await stream.writeSSE({ event: "error", data: msg });
        }
      });
    }

    // Standard @react-grab participant flow
    // Store images for the participant to retrieve
    if (images && Array.isArray(images)) {
      requestImages.set(requestId, images as ImageData[]);
    }

    // Store custom system prompt for the participant to retrieve
    if (systemPrompt && typeof systemPrompt === "string") {
      requestSystemPrompts.set(requestId, systemPrompt);
    }

    const formattedPrompt = `@react-grab ${prompt}

Context:
${content}

[request-id:${requestId}]`;

    outputChannel.appendLine(
      `[${new Date().toISOString()}] Queued Participant Request: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
    );

    return streamSSE(c, async (stream) => {
      const processRequest = async () => {
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Processing Request: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
        );
        try {
          // Set up status event listener for tool usage and thinking
          const statusHandler = async (data: {
            tool?: string;
            input?: unknown;
            thinking?: string;
          }) => {
            if (data.tool) {
              await stream.writeSSE({
                event: "status",
                data: `use tool ${data.tool}`,
              });
            } else if (data.thinking) {
              await stream.writeSSE({ event: "status", data: data.thinking });
            }
          };
          eventEmitter.on(`${requestId}:status`, statusHandler);

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
              eventEmitter.off(requestId, handler);
              resolve();
            }, 60000);
          });

          // Clean up status listener and stored images
          eventEmitter.off(`${requestId}:status`, statusHandler);
          requestImages.delete(requestId);
          requestSystemPrompts.delete(requestId);
          outputChannel.appendLine(
            `[${new Date().toISOString()}] Done: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
          );

          await stream.writeSSE({ event: "done", data: "" });
        } catch (err: any) {
          console.error("Error sending request to Copilot:", err);
          const msg = err.message || "Unknown error";
          await stream.writeSSE({ event: "error", data: msg });
          outputChannel.appendLine(
            `[${new Date().toISOString()}] Error: ${msg}`,
          );
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
    const server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`React Grab Copilot server listening on port ${info.port}`);
        statusBarItem.tooltip = `Listening on port ${info.port}`;
      },
    );
    return server;
  } catch (e: any) {
    vscode.window.showErrorMessage(
      `Failed to start React Grab Copilot server: ${e.message}`,
    );
    return null;
  }
}
