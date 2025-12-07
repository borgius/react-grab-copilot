import * as vscode from 'vscode';

export interface ToolContext {
    stream: vscode.ChatResponseStream;
}

export interface Tool {
    definition: vscode.LanguageModelChatTool;
    execute(args: any, ctx: ToolContext): Promise<string>;
}

// Helper functions for stream output
export function streamStatus(ctx: ToolContext, toolName: string, status: 'running' | 'success' | 'error') {
    const emoji = status === 'running' ? '⏳' : status === 'success' ? '✅' : '❌';
    ctx.stream.markdown(`${emoji} **${toolName}** `);
}

export function streamResult(ctx: ToolContext, result: string, maxLength: number = 2000) {
    const displayResult = result.length > maxLength 
        ? result.substring(0, maxLength) + `\n... (${result.length - maxLength} more chars)`
        : result;
    ctx.stream.markdown(`\n\`\`\`\n${displayResult}\n\`\`\`\n`);
}

export function streamFile(ctx: ToolContext, filePath: string, content: string) {
    const lines = content.split('\n').length;
    ctx.stream.markdown(`📄 **${filePath}** _(${lines} lines, ${content.length} chars)_\n`);
}

export function streamError(ctx: ToolContext, message: string) {
    ctx.stream.markdown(`❌ **Error:** ${message}\n`);
}

export function streamInfo(ctx: ToolContext, message: string) {
    ctx.stream.markdown(`ℹ️ ${message}\n`);
}

export function streamSuccess(ctx: ToolContext, message: string) {
    ctx.stream.markdown(`✅ ${message}\n`);
}
