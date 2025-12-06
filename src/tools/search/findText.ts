import * as vscode from 'vscode';
import { Tool } from '../tool';
import * as cp from 'child_process';

export const findTextTool: Tool = {
    definition: {
        name: 'findText',
        description: 'Find text in files using grep',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The text or regex to search for',
                },
                includePattern: {
                    type: 'string',
                    description: 'Glob pattern for files to include',
                },
            },
            required: ['query'],
        },
    },
    execute: async (args: { query: string; includePattern?: string }) => {
        // Using ripgrep or grep via terminal if available, or simple VS Code search if possible.
        // Since we don't have direct access to VS Code text search API easily in this context without complex setup,
        // we'll use a simple grep command if on unix, or findstr on windows.
        // Assuming unix based on environment info.
        
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) {
            return "No workspace open";
        }

        const command = `grep -r "${args.query}" .`;
        
        return new Promise((resolve) => {
            cp.exec(command, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                    // Grep returns exit code 1 if no matches found, which is treated as error by exec
                    if (err.code === 1) {
                        resolve("No matches found.");
                    } else {
                        resolve(`Error: ${err.message}\nStderr: ${stderr}`);
                    }
                } else {
                    // Truncate if too long
                    if (stdout.length > 10000) {
                        resolve(stdout.substring(0, 10000) + "\n... (truncated)");
                    } else {
                        resolve(stdout);
                    }
                }
            });
        });
    },
};
