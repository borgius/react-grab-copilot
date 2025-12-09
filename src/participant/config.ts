import * as vscode from "vscode";

/**
 * Configuration options for the chat participant
 */
export interface ParticipantConfig {
  /** Custom system prompt to prepend to all requests */
  customSystemPrompt?: string;
  /** Whether to include AGENTS.md content in the system prompt */
  useAgentsMd: boolean;
  /** Whether to allow MCP (Model Context Protocol) */
  allowMcp: boolean;
  /** Log level for debug output */
  logLevel: string;
  /** Whether debug mode is enabled */
  isDebug: boolean;
}

/**
 * Load participant configuration from VS Code settings
 */
export function loadParticipantConfig(): ParticipantConfig {
  const config = vscode.workspace.getConfiguration("reactGrabCopilot");

  const customSystemPrompt = config.get<string>("systemPrompt");
  const useAgentsMd = config.get<boolean>("useAgentsMd", true);
  const allowMcp = config.get<boolean>("allowMcp", false);
  const logLevel = config.get<string>("logLevel", "INFO");
  const isDebug = logLevel === "DEBUG";

  return {
    customSystemPrompt,
    useAgentsMd,
    allowMcp,
    logLevel,
    isDebug,
  };
}

/**
 * Read AGENTS.md content from the workspace root if it exists
 */
export async function loadAgentsMdContent(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const agentsMdUri = vscode.Uri.joinPath(workspaceFolders[0].uri, "AGENTS.md");

  try {
    const content = await vscode.workspace.fs.readFile(agentsMdUri);
    return new TextDecoder().decode(content);
  } catch {
    // AGENTS.md doesn't exist, ignore
    return undefined;
  }
}
