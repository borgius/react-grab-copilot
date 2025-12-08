import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { renderPrompt } from "@vscode/prompt-tsx";
import type { Tool, ToolContext, ToolOutput } from "../tools/tool";
import { AgentSystemPrompt } from "../prompts/prompts";
import type { EventEmitter } from "events";
import { requestImages } from "../server/server";

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
      const sendScreenshotToLLM = config.get<boolean>("sendScreenshotToLLM", true);

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

      // If this request has images, display them in chat and optionally add to LLM message
      if (requestId) {
        const images = requestImages.get(requestId);
        if (images && images.length > 0) {
          // Display images in the chat stream by saving to temp files
          stream.markdown("📸 **Screenshots attached:**\n\n");
          const tempDir = path.join(os.tmpdir(), 'react-grab-copilot');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (img.description) {
              stream.markdown(`*${img.description}*\n\n`);
            }
            // Save image to temp file and try different methods to display
            const ext = img.type.split('/')[1] || 'png';
            const tempFile = path.join(tempDir, `screenshot-${requestId}-${i}.${ext}`);
            const imageBuffer = Buffer.from(img.data, 'base64');
            fs.writeFileSync(tempFile, imageBuffer);
            
            // Try using MarkdownString with supportHtml for img tag
            const md = new vscode.MarkdownString();
            md.supportHtml = true;
            md.appendMarkdown(`<img src="${vscode.Uri.file(tempFile).toString()}" alt="Screenshot" style="max-width: 100%; max-height: 400px;" />\n\n`);
            stream.markdown(md);
            
            // Also add as a reference for easy access
            stream.reference(vscode.Uri.file(tempFile));
          }
          stream.markdown("---\n\n");
          
          // Only add images to LLM request if sendScreenshotToLLM is enabled
          if (sendScreenshotToLLM) {
            // Find the last user message and add images to it
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              if (msg.role === vscode.LanguageModelChatMessageRole.User) {
                // Build new content array with text and images
                const newContent: (vscode.LanguageModelTextPart | vscode.LanguageModelDataPart)[] = [];
                
                // Add existing text content
                for (const part of msg.content) {
                  if (part instanceof vscode.LanguageModelTextPart) {
                    newContent.push(part);
                  }
                }
                
                // Add images with descriptions
                for (const img of images) {
                  if (img.description) {
                    newContent.push(new vscode.LanguageModelTextPart(`[Image: ${img.description}]`));
                  }
                  const imageData = Buffer.from(img.data, 'base64');
                  newContent.push(vscode.LanguageModelDataPart.image(imageData, img.type));
                }
                
                // Replace the message with one containing images
                messages[i] = vscode.LanguageModelChatMessage.User(newContent);
                outputChannel.appendLine(
                  `[${new Date().toISOString()}] Added ${images.length} image(s) to LLM request`,
                );
                break;
              }
            }
          } else {
            outputChannel.appendLine(
              `[${new Date().toISOString()}] Displayed ${images.length} image(s) in chat (not sent to LLM)`,
            );
          }
        }
      }

      // Create tool context for streaming
      const toolCtx: ToolContext = { stream, eventEmitter, requestId, outputChannel };

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
              // Emit thinking event for SSE clients
              if (requestId && fragment.value.trim()) {
                eventEmitter.emit(`${requestId}:status`, { thinking: fragment.value });
              }
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
            // Emit status event for SSE clients
            if (requestId) {
              eventEmitter.emit(`${requestId}:status`, { tool: toolCall.name, input: toolCall.input });
            }
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
