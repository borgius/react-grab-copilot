import * as vscode from "vscode";
import { renderPrompt } from "@vscode/prompt-tsx";
import type { Tool, ToolContext, ToolOutput } from "../tools/tool";
import { AgentSystemPrompt } from "../prompts/prompts";
import type { EventEmitter } from "events";
import { requestImages } from "../server/server";
import { createScreenshotTool } from "../tools/screenshots/getScreenshot";

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

      // Use the model selected by the user in GitHub Copilot chat
      const models = await vscode.lm.selectChatModels();
      const model = models[0];
      if (!model) {
        stream.markdown("No suitable model found.");
        return;
      }
      
      // Check model capabilities
      const modelCapabilities = (model as any).capabilities;
      const supportsVision = modelCapabilities?.supportsImageToText ?? false;
      const supportsTools = modelCapabilities?.supportsToolCalling ?? true;
      
      outputChannel.appendLine(
        `[${new Date().toISOString()}] Using model: ${model.name} (${model.id}), family: ${model.family}, vendor: ${model.vendor}, vision: ${supportsVision}, tools: ${supportsTools}`,
      );

      // Build the list of available tools
      const availableTools: Tool[] = [...tools];
      
      // Add screenshot tool if this request has images AND model supports vision
      const screenshotTool = createScreenshotTool(requestId);
      if (screenshotTool && supportsVision) {
        availableTools.push(screenshotTool);
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Added get_screenshot tool for this request`,
        );
      }
      
      const toolDefinitions = availableTools.map((t) => t.definition);

      // Get custom system prompt from config
      const config = vscode.workspace.getConfiguration("reactGrabCopilot");
      const customSystemPrompt = config.get<string>("systemPrompt");
      const useAgentsMd = config.get<boolean>("useAgentsMd", true);
      const allowMcp = config.get<boolean>("allowMcp", false);
      const logLevel = config.get<string>("logLevel", "INFO");
      const isDebug = logLevel === "DEBUG";

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

      // If this request has images, log them (display happens when tool is called)
      if (requestId) {
        const images = requestImages.get(requestId);
        if (images && images.length > 0) {
          // Log received image types for debugging
          outputChannel.appendLine(
            `[${new Date().toISOString()}] Received ${images.length} image(s) with types: ${images.map(img => img.type).join(', ')}`,
          );
          
          // If model supports vision, inform the model about the screenshot tool
          if (supportsVision) {
            outputChannel.appendLine(
              `[${new Date().toISOString()}] Model supports vision - get_screenshot tool available for ${images.length} image(s)`,
            );
          } else {
            outputChannel.appendLine(
              `[${new Date().toISOString()}] Model ${model.name} does not support vision - screenshots cannot be analyzed`,
            );
            stream.markdown(`⚠️ *Note: The current model (${model.name}) does not support image input. Screenshots cannot be analyzed.*\n\n`);
          }
        }
      }

      // Create tool context for streaming
      const toolCtx: ToolContext = { stream, eventEmitter, requestId, outputChannel };

      // Check if any message contains images to set vision request header
      const hasImages = messages.some(msg => 
        msg.content.some((part: unknown) => part instanceof vscode.LanguageModelDataPart)
      );

      try {
        while (!token.isCancellationRequested) {
          const requestOptions: vscode.LanguageModelChatRequestOptions = {
            tools: toolDefinitions,
            // Add vision header when images are present
            ...(hasImages && { modelOptions: { 'Copilot-Vision-Request': 'true' } }),
          };
          
          // Log full request to LLM (only at DEBUG level)
          if (isDebug) {
            outputChannel.appendLine(
              `[${new Date().toISOString()}] === LLM Request ===`,
            );
            outputChannel.appendLine(
              `[${new Date().toISOString()}] Model: ${model.name} (${model.id})`,
            );
            outputChannel.appendLine(
              `[${new Date().toISOString()}] Request Options: ${JSON.stringify(requestOptions, null, 2)}`,
            );
            outputChannel.appendLine(
              `[${new Date().toISOString()}] Messages (${messages.length}):`,
            );
            for (let i = 0; i < messages.length; i++) {
              const msg = messages[i];
              const role = msg.role === vscode.LanguageModelChatMessageRole.User ? 'User' : 'Assistant';
              const contentPreview = msg.content.map((part: unknown) => {
                if (part instanceof vscode.LanguageModelTextPart) {
                  return `Text(${part.value.length} chars): ${part.value.substring(0, 500)}${part.value.length > 500 ? '...' : ''}`;
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                  return `ToolCall: ${part.name}(${JSON.stringify(part.input)})`;
                } else if (part instanceof vscode.LanguageModelToolResultPart) {
                  return `ToolResult: callId=${part.callId}`;
                } else if (part instanceof vscode.LanguageModelDataPart) {
                  return `DataPart: image`;
                }
                return `Unknown: ${typeof part}`;
              }).join(', ');
              outputChannel.appendLine(
                `[${new Date().toISOString()}]   [${i}] ${role}: ${contentPreview}`,
              );
            }
            outputChannel.appendLine(
              `[${new Date().toISOString()}] === End LLM Request ===`,
            );
          }
          
          const chatRequest = await model.sendRequest(
            messages,
            requestOptions,
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

            const tool = availableTools.find((t) => t.definition.name === toolCall.name);
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

            // Build tool result content - include image if returned
            const resultContent: (vscode.LanguageModelTextPart | vscode.LanguageModelDataPart)[] = [
              new vscode.LanguageModelTextPart(result.text),
            ];
            
            // If the tool returned an image, add it to the result
            if (result.image && supportsVision) {
              const imageData = Buffer.from(result.image.data, 'base64');
              resultContent.push(vscode.LanguageModelDataPart.image(imageData, result.image.mimeType));
              outputChannel.appendLine(
                `[${new Date().toISOString()}] Including image in tool result: ${result.image.description || 'screenshot'}`,
              );
            }

            // Create proper LanguageModelToolResultPart with the content
            toolResults.push(
              new vscode.LanguageModelToolResultPart(toolCall.callId, resultContent),
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
