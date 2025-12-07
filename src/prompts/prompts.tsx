import type { BasePromptElementProps, PromptSizing } from "@vscode/prompt-tsx";
import {
  AssistantMessage,
  PromptElement,
  UserMessage,
  TextChunk,
} from "@vscode/prompt-tsx";

/* System prompt for the agent */
export interface AgentSystemPromptProps extends BasePromptElementProps {
  userQuery: string;
}

const SYSTEM_PROMPT = `You are an expert coding agent. Follow these rules strictly:

1. **ALWAYS use the provided Context first.** The Context section contains:
   - The exact code snippet that needs to be modified
   - File paths (look for patterns like "at localhost:PORT/src/..." or "data-tsd-source" attributes)
   - Component/function names and their locations

2. **Extract file paths from context before searching.** Look for:
   - \`data-tsd-source="/src/..."\` attributes
   - \`at localhost:PORT/src/...\` patterns
   - Explicit file path mentions like \`(at /path/to/file.tsx)\`

3. **Do NOT search the entire project** when the context already tells you where the code is.
   - If a file path is provided, use readFile on that specific file
   - Only use findText/findFiles as a fallback when no path is given

4. **Make targeted edits.** Use the extracted file path to read and edit the specific file.`;

export class AgentSystemPrompt extends PromptElement<
  AgentSystemPromptProps,
  undefined
> {
  render() {
    return (
      <>
        <AssistantMessage priority={300}>
          <TextChunk>{SYSTEM_PROMPT}</TextChunk>
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
