import { DEFAULT_SYSTEM_PROMPT } from "../prompts/prompts";
import { loadParticipantConfig } from "./config";
import { enrichQueryWithSourceContext } from "./sourceContext";

/**
 * Individual screenshot description
 */
export interface ScreenshotDescription {
  /** Index of the screenshot */
  index: number;
  /** Description of what's in the screenshot */
  description?: string;
}

/**
 * Screenshot info for enriched queries
 */
export interface ScreenshotInfo {
  /** Request ID to fetch screenshots */
  requestId: string;
  /** Port the server is running on */
  port: number;
  /** List of screenshots with descriptions */
  screenshots: ScreenshotDescription[];
}

/**
 * Options for building an enriched query
 */
export interface EnrichQueryOptions {
  prompt: string;
  content?: string;
  /** Request-specific system prompt to add after the default system prompt */
  requestSystemPrompt?: string;
  /** Screenshot info if images are attached */
  screenshotInfo?: ScreenshotInfo;
}

/**
 * Result of building an enriched query
 */
export interface EnrichedQuery {
  /** The enriched query text ready to be sent to the chat */
  query: string;
  /** Whether source context was added */
  sourceContextAdded: boolean;
}

/**
 * Build an enriched query with system prompts and source context.
 * This is used for direct messages.
 *
 * Note: Does NOT include AGENTS.md or MCP info - those are only for @react-grab participant.
 *
 * @param options - Options for building the query
 * @returns The enriched query
 */
export async function buildEnrichedQuery(
  options: EnrichQueryOptions,
): Promise<EnrichedQuery> {
  const config = loadParticipantConfig();

  // Enrich prompt with source context if present (search in both prompt and content)
  const { query: enrichedPrompt, contextAdded } =
    await enrichQueryWithSourceContext(options.prompt, options.content);

  // Build the system prompt section
  // Use config.customSystemPrompt if set, otherwise use DEFAULT_SYSTEM_PROMPT
  const systemPromptParts: string[] = [];

  const baseSystemPrompt = config.customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  systemPromptParts.push(baseSystemPrompt);

  // Add request-specific system prompt on top if provided
  if (options.requestSystemPrompt) {
    systemPromptParts.push(options.requestSystemPrompt);
  }

  // Build final query with clear sections
  const sections: string[] = [];

  sections.push(`## Request Structure:
- **Instructions**: Guidelines and rules for how to handle the request
- **Context**: Selected code elements, file paths, and relevant information
- **Screenshots Available**: URLs to fetch visual context (if provided)
- **User Prompt**: The actual task or question from the user

`);

  // ## Instructions section
  sections.push(`## Instructions:\n${systemPromptParts.join("\n\n")}`);

  // ## Context section (if provided)
  if (options.content) {
    sections.push(`## Context:\n${options.content}`);
  }

  // ## Screenshots section (if images are attached)
  if (options.screenshotInfo && options.screenshotInfo.screenshots.length > 0) {
    const { requestId, port, screenshots } = options.screenshotInfo;
    const screenshotLines = screenshots.map((s) => {
      const desc = s.description || `Screenshot ${s.index + 1}`;
      return `- ${desc}: GET http://localhost:${port}/screenshot/${requestId}/${s.index}`;
    });
    const screenshotInstructions = `## Screenshots Available:\n${screenshotLines.join("\n")}`;
    sections.push(screenshotInstructions);
  }

  // ## User Prompt section
  sections.push(`## User Prompt:\n${enrichedPrompt}`);

  const finalQuery = sections.join("\n\n");

  return {
    query: finalQuery,
    sourceContextAdded: contextAdded,
  };
}
