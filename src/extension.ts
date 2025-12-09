import { EventEmitter } from "events";
import * as vscode from "vscode";
import { registerChatParticipant } from "./participant/participant";
import { startServer } from "./server/server";
import { getTools } from "./tools";

const eventEmitter = new EventEmitter();

let server: any;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log("React Grab Copilot is now active!");

  outputChannel = vscode.window.createOutputChannel("React Grab Copilot");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand("react-grab-copilot.showHistory", () => {
      outputChannel.show();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "react-grab-copilot.helloWorld",
      async () => {
        try {
          outputChannel.appendLine(
            `[${new Date().toISOString()}] Command: helloWorld`,
          );

          await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: "@react-grab Hello from command",
          });

          outputChannel.appendLine(
            `[${new Date().toISOString()}] Opened chat with query`,
          );
        } catch (err: any) {
          vscode.window.showErrorMessage(`Error opening chat: ${err.message}`);
          outputChannel.appendLine(
            `[${new Date().toISOString()}] Error: ${err.message}`,
          );
        }
      },
    ),
  );

  const tools = getTools(eventEmitter);
  registerChatParticipant(context, tools, outputChannel, eventEmitter);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBarItem);

  server = startServer(context, eventEmitter, outputChannel, statusBarItem);
}

export function deactivate() {
  if (server) {
    server.close();
  }
}
