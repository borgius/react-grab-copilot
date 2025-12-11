// Participant module exports

export { ChatHandler, type ModelCapabilities } from "./chatHandler";
export {
  loadAgentsMdContent,
  loadParticipantConfig,
  type ParticipantConfig,
} from "./config";
export { createLogger, Logger, type LogLevel } from "./logger";
export { registerChatParticipant } from "./participant";
export {
  buildEnrichedQuery,
  type EnrichedQuery,
  type EnrichQueryOptions,
  type ScreenshotDescription,
  type ScreenshotInfo,
} from "./queryBuilder";
export {
  enrichQueryWithSourceContext,
  getSourceContext,
  parseSourceFileReference,
  type SourceFileReference,
} from "./sourceContext";
