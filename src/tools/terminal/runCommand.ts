import * as vscode from 'vscode';
import { Tool } from '../tool';
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
    execute: async (args: { command: string }) => {
        return new Promise((resolve, reject) => {
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) {
                reject(new Error("No workspace open"));
                return;
            }
            
            cp.exec(args.command, { cwd }, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(`Command failed: ${err.message}\nStderr: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            });
        });
    },
};
