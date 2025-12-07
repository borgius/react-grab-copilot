import * as vscode from 'vscode';
import type { Tool, ToolContext, ToolOutput } from '../tool';
import { streamResult, streamInfo } from '../tool';
import * as cp from 'child_process';

export const runTerminalCommandTool: Tool = {
    definition: {
        name: 'runTerminalCommand',
        description: 'Run a shell command in the terminal',
        inputSchema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The command to execute',
                },
            },
            required: ['command'],
        },
    },
    execute: async (args: unknown, ctx: ToolContext): Promise<ToolOutput> => {
        const { command } = args as { command: string };
        return new Promise((resolve, reject) => {
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) {
                reject(new Error("No workspace open"));
                return;
            }
            
            streamInfo(ctx, `Running: \`${command}\``);
            
            cp.exec(command, { cwd }, (err, stdout, stderr) => {
                if (err) {
                    ctx.stream.markdown(`❌ **Command failed**\n`);
                    streamResult(ctx, stderr || err.message);
                    reject(new Error(`Command failed: ${err.message}\nStderr: ${stderr}`));
                } else {
                    ctx.stream.markdown(`✅ **Command completed**\n`);
                    if (stdout) {
                        streamResult(ctx, stdout);
                    }
                    resolve({ text: stdout });
                }
            });
        });
    },
};
