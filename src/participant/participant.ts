import * as vscode from 'vscode';
import { Tool, ToolContext } from '../tools/tool';

export function registerChatParticipant(context: vscode.ExtensionContext, tools: Tool[], outputChannel: vscode.OutputChannel) {
    const participant = vscode.chat.createChatParticipant(
        "react-grab-copilot.participant",
        async (request, context, stream, token) => {
            outputChannel.appendLine(`[${new Date().toISOString()}] Chat Request: ${request.prompt}`);
            
            const match = request.prompt.match(/\[request-id:([a-zA-Z0-9-]+)\]/);
            const requestId = match ? match[1] : null;

            const models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
            const model = models[0];
            if (!model) {
                stream.markdown("No suitable model found.");
                return;
            }

            const toolDefinitions = tools.map(t => t.definition);

            const systemPrompt = `You are an expert coding agent. Follow these rules strictly:

1. **ALWAYS use the provided Context first.** The Context section contains:
   - The exact code snippet that needs to be modified
   - File paths (look for patterns like "at //localhost:PORT/src/..." or "data-tsd-source" attributes)
   - Component/function names and their locations

2. **Extract file paths from context before searching.** Look for:
   - \`data-tsd-source="/src/..."\` attributes
   - \`at //localhost:PORT/src/...\` patterns  
   - Explicit file path mentions like \`(at /path/to/file.tsx)\`

3. **Do NOT search the entire project** when the context already tells you where the code is.
   - If a file path is provided, use readFile on that specific file
   - Only use findText/findFiles as a fallback when no path is given

4. **Make targeted edits.** Use the extracted file path to read and edit the specific file.`;

            const messages: vscode.LanguageModelChatMessage[] = [
                vscode.LanguageModelChatMessage.User(`${systemPrompt}

User Query: ${request.prompt}`)
            ];

            // Create tool context for streaming
            const toolCtx: ToolContext = { stream };

            try {
                while (!token.isCancellationRequested) {
                    const chatRequest = await model.sendRequest(messages, { tools: toolDefinitions }, token);
                    
                    let responseParts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];
                    let toolCalls: vscode.LanguageModelToolCallPart[] = [];
                    let hasShownThinking = false;
                    
                    for await (const fragment of chatRequest.stream) {
                        if (fragment instanceof vscode.LanguageModelTextPart) {
                            // Show thinking/reasoning from the model
                            if (!hasShownThinking && fragment.value.trim()) {
                                stream.markdown(`💭 **Thinking:**\n`);
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
                    messages.push(vscode.LanguageModelChatMessage.Assistant(responseParts));

                    if (toolCalls.length === 0) {
                        break;
                    }

                    const toolResults: vscode.LanguageModelToolResultPart[] = [];
                    for (const toolCall of toolCalls) {
                        stream.markdown(`\n---\n🔧 **${toolCall.name}**\n`);
                        stream.markdown(`\`\`\`json\n${JSON.stringify(toolCall.input, null, 2)}\n\`\`\`\n`);
                        
                        const tool = tools.find(t => t.definition.name === toolCall.name);
                        let result = "Tool not found";
                        if (tool) {
                            try {
                                // Tool handles its own streaming output
                                result = await tool.execute(toolCall.input, toolCtx);
                                // Ensure result is always a non-empty string
                                if (result === undefined || result === null) {
                                    result = "Tool returned no result";
                                } else if (typeof result !== 'string') {
                                    result = JSON.stringify(result, null, 2);
                                } else if (result.trim() === '') {
                                    result = "Tool returned empty result";
                                }
                                outputChannel.appendLine(`[${new Date().toISOString()}] Tool ${toolCall.name} result length: ${result.length}`);
                            } catch (err: any) {
                                result = `Error executing tool: ${err.message}`;
                                stream.markdown(`❌ **Error:** ${err.message}\n`);
                                outputChannel.appendLine(`[${new Date().toISOString()}] Tool Error: ${err.message}`);
                            }
                        } else {
                            stream.markdown(`❌ **Error:** Tool not found\n`);
                        }
                        
                        stream.markdown(`\n`);
                        
                        // Create proper LanguageModelTextPart for the tool result content
                        toolResults.push(new vscode.LanguageModelToolResultPart(
                            toolCall.callId, 
                            [new vscode.LanguageModelTextPart(result)]
                        ));
                    }
                    
                    messages.push(vscode.LanguageModelChatMessage.User(toolResults));
                }
            } catch (err: any) {
                const errorMessage = `Error in chat loop: ${err.message}`;
                stream.markdown(`\n\n**Error:** ${errorMessage}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] ${errorMessage}`);
            }
        }
    );
    context.subscriptions.push(participant);
}
