/**
 * erzencode - AI-powered coding assistant CLI
 * Main entry point for library exports
 */

// Core agent
export { createAIAgent, AIAgent } from "./ai-agent.js";
export type { AgentConfig, AgentMessage, StreamEvent, AgentMode } from "./ai-agent.js";

// Providers
export { createProvider, validateProviderConfig } from "./ai-provider.js";
export type { ProviderType, ThinkingConfig } from "./ai-provider.js";

// Models
export { getModel, getModelAsync, modelSupports } from "./models.js";
export type { ModelInfo, ProviderInfo } from "./models.js";

// Configuration
export {
  loadConfig,
  saveConfig,
  getApiKey,
  getApiKeyAsync,
  ensureConfig,
} from "./config.js";

// Tools
export { getAllTools, setWorkspaceRoot } from "./tools-standalone.js";

// Prompts
export {
  SYSTEM_PROMPT,
  ASK_MODE_PROMPT,
  PLAN_MODE_PROMPT,
  COMPACTION_SYSTEM_PROMPT,
} from "./prompts.js";

// Compaction
export {
  compactConversation,
  shouldCompact,
  estimateTokens,
} from "./compaction.js";

// Themes
export { getAllThemes, getCurrentTheme, setTheme } from "./themes.js";
