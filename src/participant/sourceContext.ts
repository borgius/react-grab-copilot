import * as vscode from "vscode";

/**
 * Represents a source file reference with path and line number
 */
export interface SourceFileReference {
  path: string;
  line: number;
}

/**
 * Default number of lines to include before and after the target line
 */
const DEFAULT_CONTEXT_LINES = 10;

/**
 * Parses source file references from the prompt.
 *
 * Looks for patterns like:
 * ```
 * Source Files:
 *   - /src/routes/index.tsx:53:15
 *   - /src/routes/index.tsx:25:11
 * ```
 *
 * @param prompt - The user prompt to parse
 * @returns The first source file reference found, or null if none found
 */
export function parseSourceFileReference(
  prompt: string,
): SourceFileReference | null {
  // Match "Source Files:" section with file paths
  const sourceFilesMatch = prompt.match(
    /Source Files:\s*([\s\S]*?)(?:\n\n|$)/i,
  );
  if (!sourceFilesMatch) {
    return null;
  }

  // Extract the first file path with line number
  // Pattern: - /path/to/file.ext:lineNumber:columnNumber (column is optional)
  const fileMatch = sourceFilesMatch[1].match(
    /^\s*-\s*([^:\s]+):(\d+)(?::\d+)?/m,
  );
  if (!fileMatch) {
    return null;
  }

  return {
    path: fileMatch[1],
    line: Number.parseInt(fileMatch[2], 10),
  };
}

/**
 * Reads source code context around a specific line from a file.
 *
 * @param filePath - Path to the source file (relative to workspace)
 * @param lineNumber - The target line number (1-indexed)
 * @param contextLines - Number of lines to include before and after
 * @returns Formatted source context or null if file cannot be read
 */
export async function getSourceContext(
  filePath: string,
  lineNumber: number,
  contextLines: number = DEFAULT_CONTEXT_LINES,
): Promise<string | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const workspaceRoot = workspaceFolders[0].uri;
  const fileUri = vscode.Uri.joinPath(workspaceRoot, filePath);

  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = new TextDecoder().decode(content);
    const lines = text.split("\n");

    const contextBlock = formatSourceContext(lines, lineNumber, contextLines);

    return `\n\n## Source Context (${filePath}:${lineNumber}):\n\`\`\`\n${contextBlock}\n\`\`\``;
  } catch {
    return null;
  }
}

/**
 * Format source lines with line numbers and a marker for the target line
 */
function formatSourceContext(
  lines: string[],
  targetLine: number,
  contextLines: number,
): string {
  // Calculate start and end lines (1-indexed to 0-indexed)
  const startLine = Math.max(0, targetLine - 1 - contextLines);
  const endLine = Math.min(lines.length - 1, targetLine - 1 + contextLines);

  return lines
    .slice(startLine, endLine + 1)
    .map((line, idx) => {
      const actualLineNum = startLine + idx + 1;
      const marker = actualLineNum === targetLine ? ">" : " ";
      return `${marker}${actualLineNum.toString().padStart(4)}: ${line}`;
    })
    .join("\n");
}

/**
 * Enrich a user query with source context if source file references are found
 *
 * @param prompt - The original user prompt
 * @returns Object containing the enriched query and whether context was added
 */
export async function enrichQueryWithSourceContext(prompt: string): Promise<{
  query: string;
  sourceRef: SourceFileReference | null;
  contextAdded: boolean;
}> {
  const sourceRef = parseSourceFileReference(prompt);

  if (!sourceRef) {
    return { query: prompt, sourceRef: null, contextAdded: false };
  }

  const sourceContext = await getSourceContext(sourceRef.path, sourceRef.line);

  if (sourceContext) {
    return {
      query: prompt + sourceContext,
      sourceRef,
      contextAdded: true,
    };
  }

  return { query: prompt, sourceRef, contextAdded: false };
}
