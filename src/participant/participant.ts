import * as vscode from 'vscode';
import { Tool } from '../tools/tool';

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

            const messages: vscode.LanguageModelChatMessage[] = [
                vscode.LanguageModelChatMessage.User(`You are an expert coding agent. Use the provided tools to help the user. 
                
                User Query: ${request.prompt}`)
            ];

            while (!token.isCancellationRequested) {
                const chatRequest = await model.sendRequest(messages, { tools: toolDefinitions }, token);
                
                let responseParts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];
                let toolCalls: vscode.LanguageModelToolCallPart[] = [];
                
                for await (const fragment of chatRequest.stream) {
                    if (fragment instanceof vscode.LanguageModelTextPart) {
                        stream.markdown(fragment.value);
                        responseParts.push(fragment);
                    } else if (fragment instanceof vscode.LanguageModelToolCallPart) {
                        toolCalls.push(fragment);
                        responseParts.push(fragment);
                    }
                }

                const textParts = responseParts.filter(p => p instanceof vscode.LanguageModelTextPart) as vscode.LanguageModelTextPart[];
                const toolCallParts = responseParts.filter(p => p instanceof vscode.LanguageModelToolCallPart) as vscode.LanguageModelToolCallPart[];
                
                messages.push(vscode.LanguageModelChatMessage.Assistant(textParts, toolCallParts));

                if (toolCalls.length === 0) {
                    break;
                }

                const toolResults: vscode.LanguageModelToolResultPart[] = [];
                for (const toolCall of toolCalls) {
                    stream.markdown(`\n\n---\n\n`);
                    stream.markdown(`**Using Tool:** \`${toolCall.name}\`\n\n`);
                    stream.markdown(`**Arguments:**\n\`\`\`json\n${JSON.stringify(toolCall.input, null, 2)}\n\`\`\`\n\n`);
                    
                    const tool = tools.find(t => t.definition.name === toolCall.name);
                    let result = "Tool not found";
                    if (tool) {
                        result = await tool.execute(toolCall.input, stream);
                    }
                    
                    let displayResult = result;
                    if (result.length > 1000) {
                        displayResult = result.substring(0, 1000) + "\n... (truncated)";
                    }
                    
                    stream.markdown(`**Result:**\n\`\`\`\n${displayResult}\n\`\`\`\n\n`);
                    
                    toolResults.push(new vscode.LanguageModelToolResultPart(toolCall.callId, [{ kind: 'text', value: result }]));
                }
                
                messages.push(vscode.LanguageModelChatMessage.User(toolResults));
            }
        }
    );
    context.subscriptions.push(participant);
}
