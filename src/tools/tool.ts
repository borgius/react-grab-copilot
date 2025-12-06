import * as vscode from 'vscode';

export interface Tool {
    definition: vscode.LanguageModelChatTool;
    execute(args: any, stream: vscode.ChatResponseStream): Promise<string>;
}
