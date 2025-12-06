import * as vscode from 'vscode';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

let server: any;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('React Grab Copilot is now active!');

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
                    await stream.writeSSE({ event: 'error', data: 'No Copilot models found. Please ensure GitHub Copilot Chat is installed and you are signed in.' });
                    return;
                }

                const model = models[0];
                
                const fullPrompt = content ? `${prompt}\n\n${content}` : prompt;
                
                const messages = [
                    vscode.LanguageModelChatMessage.User(fullPrompt)
                ];

                const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

                for await (const fragment of chatRequest.text) {
                    await stream.writeSSE({ data: fragment });
                }
                
                await stream.writeSSE({ event: 'done', data: '' });

            } catch (err: any) {
                console.error('Error sending request to Copilot:', err);
                await stream.writeSSE({ event: 'error', data: err.message || 'Unknown error' });
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
