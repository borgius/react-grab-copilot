import * as vscode from "vscode";
import { renderPrompt } from "@vscode/prompt-tsx";
import type { Tool, ToolContext, ToolOutput } from "../tools/tool";
import { AgentSystemPrompt } from "../prompts/prompts";
import type { EventEmitter } from "events";

export function registerChatParticipant(
  context: vscode.ExtensionContext,
  tools: Tool[],
  outputChannel: vscode.OutputChannel,
  eventEmitter: EventEmitter,
) {
  const participant = vscode.chat.createChatParticipant(
    "react-grab-copilot.participant",
    async (request, _context, stream, token) => {
      outputChannel.appendLine(
        `[${new Date().toISOString()}] Chat Request: ${request.prompt}`,
      );

      const match = request.prompt.match(/\[request-id:([a-zA-Z0-9-]+)\]/);
      const requestId = match ? match[1] : null;

      const models = await vscode.lm.selectChatModels({ family: "gpt-4" });
      const model = models[0];
      if (!model) {
        stream.markdown("No suitable model found.");
        return;
      }

      const toolDefinitions = tools.map((t) => t.definition);

      // Get custom system prompt from config
      const config = vscode.workspace.getConfiguration("reactGrabCopilot");
      const customSystemPrompt = config.get<string>("systemPrompt");
      const useAgentsMd = config.get<boolean>("useAgentsMd", true);
      const allowMcp = config.get<boolean>("allowMcp", false);

      // Read AGENTS.md if enabled
      let agentsMdContent: string | undefined;
      if (useAgentsMd) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const agentsMdUri = vscode.Uri.joinPath(workspaceFolders[0].uri, "AGENTS.md");
          try {
            const content = await vscode.workspace.fs.readFile(agentsMdUri);
            agentsMdContent = new TextDecoder().decode(content);
          } catch {
            // AGENTS.md doesn't exist, ignore
          }
        }
      }

      // Render TSX prompt
      const { messages } = await renderPrompt(
        AgentSystemPrompt,
        { userQuery: request.prompt, customSystemPrompt, agentsMdContent, allowMcp },
        { modelMaxPromptTokens: model.maxInputTokens },
        model,
      );

      // Create tool context for streaming
      const toolCtx: ToolContext = { stream };

      try {
        while (!token.isCancellationRequested) {
          const chatRequest = await model.sendRequest(
            messages,
            { tools: toolDefinitions },
            token,
          );

          const responseParts: (
            | vscode.LanguageModelTextPart
            | vscode.LanguageModelToolCallPart
          )[] = [];
          const toolCalls: vscode.LanguageModelToolCallPart[] = [];
          let hasShownThinking = false;

          for await (const fragment of chatRequest.stream) {
            if (fragment instanceof vscode.LanguageModelTextPart) {
              // Show thinking/reasoning from the model
              if (!hasShownThinking && fragment.value.trim()) {
                // stream.markdown(`💭 **Thinking:**\n`);
                hasShownThinking = true;
              }
              stream.markdown(fragment.value);
              responseParts.push(fragment);
            } else if (fragment instanceof vscode.LanguageModelToolCallPart) {
              toolCalls.push(fragment);
              responseParts.push(fragment);
            }
          }

          // Add spacing after thinking if there were tool calls
          if (hasShownThinking && toolCalls.length > 0) {
            stream.markdown(`\n`);
          }

          // Correctly construct the Assistant message with all parts
          messages.push(
            vscode.LanguageModelChatMessage.Assistant(responseParts),
          );

          if (toolCalls.length === 0) {
            break;
          }

          const toolResults: vscode.LanguageModelToolResultPart[] = [];
          for (const toolCall of toolCalls) {
            stream.markdown(`\n🔧 Using **${toolCall.name}**\n`);
            // stream.markdown(
            //   `\`\`\`json\n${JSON.stringify(toolCall.input, null, 2)}\n\`\`\`\n`,
            // );

            const tool = tools.find((t) => t.definition.name === toolCall.name);
            let result: ToolOutput = { text: "Tool not found" };
            if (tool) {
              try {
                // Tool handles its own streaming output
                result = await tool.execute(toolCall.input, toolCtx);
                // Ensure result is valid
                if (!result || !result.text) {
                  result = { text: "Tool returned no result" };
                }
                outputChannel.appendLine(
                  `[${new Date().toISOString()}] Tool ${toolCall.name} result length: ${result.text.length}`,
                );
              } catch (err: unknown) {
                const errorMessage =
                  err instanceof Error ? err.message : String(err);
                result = { text: `Error executing tool: ${errorMessage}` };
                stream.markdown(`❌ **Error:** ${errorMessage}\n`);
                outputChannel.appendLine(
                  `[${new Date().toISOString()}] Tool Error: ${errorMessage}`,
                );
              }
            } else {
              stream.markdown(`❌ **Error:** Tool not found\n`);
            }

            stream.markdown(`\n`);

            // Create proper LanguageModelTextPart for the tool result content
            toolResults.push(
              new vscode.LanguageModelToolResultPart(toolCall.callId, [
                new vscode.LanguageModelTextPart(result.text),
              ]),
            );
          }

          messages.push(vscode.LanguageModelChatMessage.User(toolResults));
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        stream.markdown(`\n\n**Error:** Error in chat loop: ${errorMessage}`);
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Error in chat loop: ${errorMessage}`,
        );
      } finally {
        // Signal completion to the server if this was an API request
        if (requestId) {
          eventEmitter.emit(requestId, "done");
          outputChannel.appendLine(
            `[${new Date().toISOString()}] Emitted completion for request: ${requestId}`,
          );
        }
      }
    },
  );
  context.subscriptions.push(participant);
}
