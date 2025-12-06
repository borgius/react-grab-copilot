import * as vscode from 'vscode';
import { Tool } from '../tool';
import * as cp from 'child_process';

export const scmChangesTool: Tool = {
    definition: {
        name: 'scmChanges',
        description: 'Get git diffs of changed files',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    execute: async () => {
        return new Promise((resolve, reject) => {
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) {
                reject(new Error("No workspace open"));
                return;
            }
            
            cp.exec('git diff HEAD', { cwd }, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(`Git error: ${err.message}\n${stderr}`));
                } else {
                    if (!stdout) {
                        resolve("No changes found.");
                    } else {
                        resolve(stdout);
                    }
                }
            });
        });
    },
};
