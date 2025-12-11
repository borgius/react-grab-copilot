import type { BasePromptElementProps, PromptSizing } from "@vscode/prompt-tsx";
import {
  AssistantMessage,
  PromptElement,
  TextChunk,
  UserMessage,
} from "@vscode/prompt-tsx";

/* System prompt for the agent */
export interface AgentSystemPromptProps extends BasePromptElementProps {
  userQuery: string;
  customSystemPrompt?: string;
  agentsMdContent?: string;
  allowMcp?: boolean;
}

export const DEFAULT_SYSTEM_PROMPT = `
## Core Rules:

1. **Use Context First**
   - Context contains exact code snippets, file paths, and component locations
   - Look for \`data-tsd-source="/src/..."\` attributes or \`at localhost:PORT/src/...\` patterns
   - Do NOT search the project when context provides the location

2. **Handle Screenshots**
   - If screenshots are listed, fetch them via GET request to analyze visual context
   - Screenshots help understand UI state, errors, or layout issues
   - Use the exact URL provided (e.g., \`GET http://localhost:6567/screenshot/{id}/{index}\`)

3. **Make Targeted Edits**
   - PREFER \`applyPatch\` for precise code modifications
   - Use \`replaceString\` for simple single-location changes
   - Use \`editFile\` only for full file replacements

4. **Act Decisively**
   - NEVER ask for confirmation - proceed with the information given
   - If a path is truncated, infer the extension (.tsx for React, .ts for TypeScript)
   - If first attempt fails, try alternatives silently
   - Make reasonable assumptions and ACT immediately

5. **Be Concise**
   - Execute changes directly, don't describe what you "could" do
   - No explanations unless explicitly requested
   - Action over description
`;

export class AgentSystemPrompt extends PromptElement<
  AgentSystemPromptProps,
  undefined
> {
  render() {
    const systemPrompt =
      this.props.customSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    const agentsContext = this.props.agentsMdContent
      ? `\n\n## Project Guidelines (from AGENTS.md):\n${this.props.agentsMdContent}`
      : "";
    const mcpNote = this.props.allowMcp
      ? `\n\n## MCP (Model Context Protocol):\nYou have access to MCP servers configured in VS Code. You can use MCP tools when appropriate for the task.`
      : "";
    return (
      <>
        <AssistantMessage priority={300}>
          <TextChunk>
            {systemPrompt}
            {agentsContext}
            {mcpNote}
          </TextChunk>
        </AssistantMessage>
        <UserMessage priority={200}>
          <TextChunk>{this.props.userQuery}</TextChunk>
        </UserMessage>
      </>
    );
  }
}

/* File content display */
export interface FileContentProps extends BasePromptElementProps {
  filePath: string;
  content: string;
}

export class FileContentPrompt extends PromptElement<
  FileContentProps,
  undefined
> {
  render(_state: undefined, _sizing: PromptSizing) {
    const { filePath, content } = this.props;
    const lines = content.split("\n").length;
    const header = `📄 File: ${filePath} (${lines} lines, ${content.length} chars)\n\n`;

    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk flexGrow={1} breakOn={"\n"}>
          {content}
        </TextChunk>
      </UserMessage>
    );
  }
}

/* Search results display */
export interface SearchResultsProps extends BasePromptElementProps {
  query: string;
  results: string;
  resultCount: number;
}

export class SearchResultsPrompt extends PromptElement<
  SearchResultsProps,
  undefined
> {
  render() {
    const { query, results, resultCount } = this.props;
    const header = `🔍 Search: \`${query}\` (${resultCount} results)\n\n`;

    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk flexGrow={1} breakOn={"\n"}>
          {results}
        </TextChunk>
      </UserMessage>
    );
  }
}

/* Tool result display */
export interface ToolResultProps extends BasePromptElementProps {
  toolName: string;
  result: string;
}

export class ToolResultPrompt extends PromptElement<
  ToolResultProps,
  undefined
> {
  render() {
    const { toolName, result } = this.props;
    const header = `🔧 ${toolName} result:\n\n`;

    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk flexGrow={1} breakOn={"\n"}>
          {result}
        </TextChunk>
      </UserMessage>
    );
  }
}

/* Success message */
export interface SuccessMessageProps extends BasePromptElementProps {
  message: string;
}

export class SuccessPrompt extends PromptElement<
  SuccessMessageProps,
  undefined
> {
  render() {
    return (
      <UserMessage>
        <TextChunk>✅ {this.props.message}</TextChunk>
      </UserMessage>
    );
  }
}

/* Error message */
export interface ErrorMessageProps extends BasePromptElementProps {
  message: string;
  details?: string;
}

export class ErrorPrompt extends PromptElement<ErrorMessageProps, undefined> {
  render() {
    const { message, details } = this.props;
    const text = details
      ? `❌ Error: ${message}\n\n${details}`
      : `❌ Error: ${message}`;

    return (
      <UserMessage>
        <TextChunk>{text}</TextChunk>
      </UserMessage>
    );
  }
}

/* Directory listing */
export interface DirectoryListingProps extends BasePromptElementProps {
  dirPath: string;
  entries: string;
  count: number;
}

export class DirectoryListingPrompt extends PromptElement<
  DirectoryListingProps,
  undefined
> {
  render() {
    const { dirPath, entries, count } = this.props;
    const header = `📂 ${dirPath} (${count} items)\n\n`;

    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk breakOn={"\n"}>{entries}</TextChunk>
      </UserMessage>
    );
  }
}

/* Project structure */
export interface ProjectStructureProps extends BasePromptElementProps {
  structure: string;
  maxDepth: number;
}

export class ProjectStructurePrompt extends PromptElement<
  ProjectStructureProps,
  undefined
> {
  render() {
    const { structure, maxDepth } = this.props;
    const header = `🗂️ Project Structure (depth: ${maxDepth})\n\n`;

    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk flexGrow={1} breakOn={"\n"}>
          {structure}
        </TextChunk>
      </UserMessage>
    );
  }
}

/* Git changes */
export interface GitChangesProps extends BasePromptElementProps {
  diff: string;
  hasChanges: boolean;
}

export class GitChangesPrompt extends PromptElement<
  GitChangesProps,
  undefined
> {
  render() {
    const { diff, hasChanges } = this.props;

    if (!hasChanges) {
      return (
        <UserMessage>
          <TextChunk>📝 Git Changes: No changes found.</TextChunk>
        </UserMessage>
      );
    }

    const header = "📝 Git Changes:\n\n";
    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk flexGrow={1} breakOn={"\n"}>
          {diff}
        </TextChunk>
      </UserMessage>
    );
  }
}

/* Diagnostic errors */
export interface DiagnosticsProps extends BasePromptElementProps {
  errors: string;
  errorCount: number;
  filePath?: string;
}

export class DiagnosticsPrompt extends PromptElement<
  DiagnosticsProps,
  undefined
> {
  render() {
    const { errors, errorCount, filePath } = this.props;
    const location = filePath ? ` in ${filePath}` : "";

    if (errorCount === 0) {
      return (
        <UserMessage>
          <TextChunk>✅ No errors found{location}.</TextChunk>
        </UserMessage>
      );
    }

    const header = `🔴 ${errorCount} error(s)${location}:\n\n`;
    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk breakOn={"\n"}>{errors}</TextChunk>
      </UserMessage>
    );
  }
}

/* Terminal command output */
export interface TerminalOutputProps extends BasePromptElementProps {
  command: string;
  output: string;
  success: boolean;
}

export class TerminalOutputPrompt extends PromptElement<
  TerminalOutputProps,
  undefined
> {
  render() {
    const { command, output, success } = this.props;
    const icon = success ? "✅" : "❌";
    const header = `${icon} Command: \`${command}\`\n\n`;

    return (
      <UserMessage>
        <TextChunk>{header}</TextChunk>
        <TextChunk flexGrow={1} breakOn={"\n"}>
          {output}
        </TextChunk>
      </UserMessage>
    );
  }
}
