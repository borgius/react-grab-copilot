import * as vscode from 'vscode';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

let server: any;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('React Grab Copilot is now active!');

    outputChannel = vscode.window.createOutputChannel('React Grab Copilot');
    context.subscriptions.push(outputChannel);

    context.subscriptions.push(
        vscode.commands.registerCommand('react-grab-copilot.showHistory', () => {
            outputChannel.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('react-grab-copilot.helloWorld', async () => {
            try {
                outputChannel.appendLine(`[${new Date().toISOString()}] Command: helloWorld`);
                
                // Open Copilot Chat and send a query to our participant
                await vscode.commands.executeCommand('workbench.action.chat.open', { 
                    query: '@react-grab Hello from command' 
                });
                
                outputChannel.appendLine(`[${new Date().toISOString()}] Opened chat with query`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Error opening chat: ${err.message}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] Error: ${err.message}`);
            }
        })
    );

    const participant = vscode.chat.createChatParticipant('react-grab-copilot.participant', async (request, context, stream, token) => {
        try {
            outputChannel.appendLine(`[${new Date().toISOString()}] Chat Participant Request: ${request.prompt}`);
            
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
            let model;
            if (models.length > 0) {
                model = models[0];
            } else {
                const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
                if (allModels.length > 0) {
                    model = allModels[0];
                }
            }

            if (!model) {
                stream.markdown('No Copilot models found. Please ensure GitHub Copilot Chat is installed and you are signed in.');
                return;
            }

            const messages = [vscode.LanguageModelChatMessage.User(request.prompt)];
            const chatRequest = await model.sendRequest(messages, {}, token);

            for await (const fragment of chatRequest.text) {
                stream.markdown(fragment);
            }
        } catch (err: any) {
            stream.markdown(`Error: ${err.message}`);
            outputChannel.appendLine(`[${new Date().toISOString()}] Chat Participant Error: ${err.message}`);
        }
    });
    context.subscriptions.push(participant);

    const config = vscode.workspace.getConfiguration('reactGrabCopilot');
    const port = config.get<number>('port', 6567);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = `$(radio-tower) Copilot Agent: ${port}`;
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const app = new Hono();
    app.use('/*', cors());

    app.post('/agent', async (c) => {
        let body: any;
        try {
            body = await c.req.json();
        } catch (e) {
            return c.json({ error: 'Invalid JSON' }, 400);
        }
        
        const { prompt, content, options } = body;
        
        if (!prompt) {
             return c.json({ error: 'Prompt is required' }, 400);
        }

        outputChannel.appendLine(`[${new Date().toISOString()}] Request: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        return streamSSE(c, async (stream) => {
            try {
                // Select the Copilot model
                let family = 'gpt-4o';
                if (options?.model) {
                    family = options.model;
                }

                let models = await vscode.lm.selectChatModels({ vendor: 'copilot', family });
                
                // Fallback if specific family not found
                if (models.length === 0) {
                    models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
                }
                
                if (models.length === 0) {
                    const msg = 'No Copilot models found. Please ensure GitHub Copilot Chat is installed and you are signed in.';
                    await stream.writeSSE({ event: 'error', data: msg });
                    outputChannel.appendLine(`[${new Date().toISOString()}] Error: ${msg}`);
                    return;
                }

                const model = models[0];
                
                const fullPrompt = content ? `${prompt}\n\n${content}` : prompt;
                
                const messages = [
                    vscode.LanguageModelChatMessage.User(fullPrompt)
                ];

                const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

                let fullResponse = '';
                for await (const fragment of chatRequest.text) {
                    fullResponse += fragment;
                    await stream.writeSSE({ data: fragment });
                }
                
                outputChannel.appendLine(`[${new Date().toISOString()}] Response: ${fullResponse.substring(0, 100)}${fullResponse.length > 100 ? '...' : ''}`);
                await stream.writeSSE({ event: 'done', data: '' });

            } catch (err: any) {
                console.error('Error sending request to Copilot:', err);
                const msg = err.message || 'Unknown error';
                await stream.writeSSE({ event: 'error', data: msg });
                outputChannel.appendLine(`[${new Date().toISOString()}] Error: ${msg}`);
            }
        });
    });

    try {
        server = serve({
            fetch: app.fetch,
            port
        }, (info) => {
            console.log(`React Grab Copilot server listening on port ${info.port}`);
            statusBarItem.tooltip = `Listening on port ${info.port}`;
        });
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to start React Grab Copilot server: ${e.message}`);
    }
}

export function deactivate() {
    if (server) {
        server.close();
    }
}
