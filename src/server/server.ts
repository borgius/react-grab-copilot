import * as vscode from "vscode";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import * as crypto from "crypto";
import type { EventEmitter } from "events";

export interface ImageData {
  type: string;
  data: string;
  description?: string;
}

// Shared store for images, keyed by requestId
export const requestImages = new Map<string, ImageData[]>();

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

  // Queue for processing requests sequentially
  let requestQueue = Promise.resolve();

  app.post("/agent", async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch (e) {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { prompt, content, images, options } = body;

    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    const requestId = crypto.randomUUID();

    // Store images for the participant to retrieve
    if (images && Array.isArray(images)) {
      requestImages.set(requestId, images as ImageData[]);
    }

    const formattedPrompt = `@react-grab ${prompt}

Context:
${content}

[request-id:${requestId}]`;

    outputChannel.appendLine(
      `[${new Date().toISOString()}] Queued Request: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
    );

    return streamSSE(c, async (stream) => {
      const processRequest = async () => {
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Processing Request: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
        );
        try {
          // Set up status event listener for tool usage and thinking
          const statusHandler = async (data: { tool?: string; input?: unknown; thinking?: string }) => {
            if (data.tool) {
              await stream.writeSSE({ event: "status", data: `use tool ${data.tool}` });
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
