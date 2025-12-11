import { DEFAULT_SYSTEM_PROMPT } from "../prompts/prompts";
import { loadParticipantConfig } from "./config";
import { enrichQueryWithSourceContext } from "./sourceContext";

/**
 * Options for building an enriched query
 */
export interface EnrichQueryOptions {
  prompt: string;
  content?: string;
  /** Request-specific system prompt to add after the default system prompt */
  requestSystemPrompt?: string;
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

  // Enrich prompt with source context if present
  const { query: enrichedPrompt, contextAdded } =
    await enrichQueryWithSourceContext(options.prompt);

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

  // ## Instructions section
  sections.push(`## Instructions:\n${systemPromptParts.join("\n\n")}`);

  // ## Context section (if provided)
  if (options.content) {
    sections.push(`## Context:\n${options.content}`);
  }

  // ## User Prompt section
  sections.push(`## User Prompt:\n${enrichedPrompt}`);

  const finalQuery = sections.join("\n\n");

  return {
    query: finalQuery,
    sourceContextAdded: contextAdded,
  };
}
