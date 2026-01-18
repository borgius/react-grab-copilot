import { EventEmitter } from "node:events";
import * as vscode from "vscode";
import { createLogger, type Logger } from "./participant/logger";
import { registerChatParticipant } from "./participant/participant";
import { startServer } from "./server/server";
import { getTools } from "./tools";

const eventEmitter = new EventEmitter();

let server: any;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let logger: Logger;

export function activate(context: vscode.ExtensionContext) {
  // Create output channel and show it immediately
  outputChannel = vscode.window.createOutputChannel("React Grab Copilot");
  context.subscriptions.push(outputChannel);
  outputChannel.show(true); // Show the output channel (true = preserveFocus)

  // Create logger with configured log level
  const config = vscode.workspace.getConfiguration("reactGrabCopilot");
  const logLevel = config.get<"DEBUG" | "INFO" | "WARN" | "ERROR">(
    "logLevel",
    "INFO",
  );
  logger = createLogger(outputChannel, logLevel);

  logger.info("Extension activation started");
  logger.debug(`Log level: ${logLevel}`);

  context.subscriptions.push(
    vscode.commands.registerCommand("react-grab-copilot.showHistory", () => {
      logger.debug("Show history command invoked");
      outputChannel.show();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "react-grab-copilot.helloWorld",
      async () => {
        try {
          logger.info("Hello World command invoked");

          await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: "@react-grab Hello from command",
          });

          logger.info("Successfully opened chat with query");
        } catch (err: unknown) {
          logger.error("Failed to open chat", err);
          const message = err instanceof Error ? err.message : "Unknown error";
          vscode.window.showErrorMessage(`Error opening chat: ${message}`);
        }
      },
    ),
  );

  try {
    logger.info("Initializing tools");
    const tools = getTools(eventEmitter);
    logger.debug(`Loaded ${tools.length} tools`);

    logger.info("Registering chat participant");
    registerChatParticipant(context, tools, outputChannel, eventEmitter);
    logger.info("Chat participant registered successfully");

    logger.info("Creating status bar item");
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    context.subscriptions.push(statusBarItem);

    logger.info("Starting HTTP server");
    server = startServer(
      context,
      eventEmitter,
      outputChannel,
      statusBarItem,
      logger,
    );

    if (server) {
      logger.info("Extension activation completed successfully");
    } else {
      logger.error("Server failed to start");
    }
  } catch (err: unknown) {
    logger.error("Extension activation failed", err);
    throw err;
  }
}

export function deactivate() {
  logger?.info("Extension deactivation started");

  if (server) {
    try {
      server.close();
      logger?.info("Server closed successfully");
    } catch (err: unknown) {
      logger?.error("Failed to close server", err);
    }
  }

  logger?.info("Extension deactivation completed");
}
