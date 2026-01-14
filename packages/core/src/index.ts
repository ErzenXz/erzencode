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
export {
  getModel,
  getModelAsync,
  modelSupports,
  getModelsForProviderAsync,
  getModelIdsAsync,
  getModelAsync as getModelByProviderAsync,
  preloadDynamicModels,
  hasDynamicModelsCache,
  clearDynamicModelsCache,
  getProvider,
  getProviderIds,
  getDefaultModel,
  getDefaultModelAsync,
  PROVIDERS,
  DEFAULT_MODELS,
  MODEL_CHOICES,
  PROVIDER_CHOICES,
  getModelIds,
  getModelChoicesAsync,
} from "./models.js";
export type { ModelInfo, ProviderInfo } from "./models.js";

// Models API (dynamic model loading)
export {
  fetchModelsDevData,
  getModelsDevProviders,
  getModelsDevModelsForProvider,
  convertToModelInfo,
  getDynamicModelsForProvider,
  getModelsDevProviderInfo,
  PROVIDER_CONFIGS,
  getAvailableProviders,
  getProviderConfig,
} from "./models-api.js";
export type {
  ModelsDevModel,
  ModelsDevProvider,
  ModelsDevData,
  ProviderConfig,
} from "./models-api.js";

// Configuration
export {
  loadConfig,
  saveConfig,
  getApiKey,
  getApiKeyAsync,
  ensureConfig,
  getConfigDir,
  getDataDir,
  resolveConfigPath,
  getGlobalConfigPath,
  getSessionsPath,
  getHistoryPath,
  loadGlobalConfig,
  saveGlobalConfig,
  setApiKey,
  getApiKeyFromConfig,
  isConfigComplete,
  createDefaultConfig,
  loadSessions,
  saveSessions,
  saveSession,
  deleteSession,
  modelSupportsThinking,
  resolveThinkingConfig,
  fetchProviderModels,
  getBaseUrl,
  getBaseUrlAsync,
} from "./config.js";
export type {
  SessionMessage,
  SessionData,
  GlobalConfig,
  ErzencodeConfig,
  ThinkingLevel,
  CommandHistory,
} from "./config.js";

// Tools
export { getAllTools, setWorkspaceRoot } from "./tools/tools-standalone.js";

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
export { getAllThemes, getCurrentTheme, setTheme, initTheme } from "./themes.js";
export type { Theme, ThemeColors } from "./themes.js";

// Shared utilities
export {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  flatMap,
  tryCatch,
  tryCatchAsync,
} from "./shared/result.js";
export type { Result, Ok, Err } from "./shared/result.js";
