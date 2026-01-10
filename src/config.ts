import fs from "fs/promises";
import path from "path";
import os from "os";
import type { ProviderType, ThinkingConfig } from "./ai-provider.js";
import {
  PROVIDERS as MODEL_PROVIDERS,
  DEFAULT_MODELS as MODELS_DEFAULT,
  MODEL_CHOICES as MODELS_CHOICES,
  PROVIDER_CHOICES as PROVIDERS_LIST,
  getProvider,
  modelSupports,
  type ProviderInfo,
} from "./models.js";
import { getCopilotToken, isCopilotAuthenticated } from "./copilot-auth.js";

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system" | "thinking" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
  toolStatus?: "running" | "success" | "error";
  toolInput?: string;
  toolOutput?: string;
}

export interface SessionData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  provider?: ProviderType;
  model?: string;
  messages: SessionMessage[];
}

// Global configuration with API keys and settings
export interface GlobalConfig {
  // API Keys for all providers
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    google?: string;
    xai?: string;
    openrouter?: string;
    groq?: string;
    together?: string;
    fireworks?: string;
    deepseek?: string;
    mistral?: string;
    perplexity?: string;
    cohere?: string;
    copilot?: string;
    azure?: string;
    exa?: string;
  };

  // Default provider and model
  defaultProvider?: ProviderType;
  defaultModel?: string;

  // Base URLs for custom endpoints
  baseUrls?: {
    [key: string]: string;
  };

  // Azure specific config
  azure?: {
    endpoint?: string;
    deploymentName?: string;
    apiVersion?: string;
  };

  // Ollama config
  ollama?: {
    host?: string;
  };

  // General settings
  settings?: {
    theme?: "dark" | "light" | "auto";
    renderer?: "raw" | "markdown";
    thinkingLevel?: ThinkingLevel;
    mode?: "plan" | "agent" | "ask";
    compactMode?: boolean;
    autoSave?: boolean;
    maxHistorySize?: number;
  };
}

export interface ErzencodeConfig {
  provider?: ProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  workspaceRoot?: string;
  lockWorkspace?: boolean;
  mode?: string;
  renderer?: "raw" | "markdown";
  thinkingLevel?: ThinkingLevel;
  allowUnknownModels?: boolean;
  theme?: string; // Theme ID: dark, light, dracula, nord, monokai, etc.
  sessions?: SessionData[];
  lastSessionId?: string;
  setupComplete?: boolean;
  firstRunAt?: number;
  dynamicModels?: boolean; // Fetch models from models.dev API
}

// Re-export from models.ts for backward compatibility
export const PROVIDERS: ProviderInfo[] = MODEL_PROVIDERS;
export const PROVIDER_CHOICES: (ProviderType | string)[] = PROVIDERS_LIST;
export const DEFAULT_MODELS: Record<string, string> = MODELS_DEFAULT;
export const MODEL_CHOICES: Partial<Record<ProviderType | string, string[]>> =
  MODELS_CHOICES;

export function modelSupportsThinking(
  provider: ProviderType | string,
  modelId: string,
): boolean {
  return modelSupports(provider as string, modelId, "thinking");
}

/**
 * Get the config directory path (cross-platform)
 * - Windows: %APPDATA%\erzencode
 * - macOS: ~/Library/Application Support/erzencode
 * - Linux: ~/.config/erzencode (or $XDG_CONFIG_HOME/erzencode)
 */
export function getConfigDir(): string {
  const platform = process.platform;

  if (platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "erzencode",
    );
  }

  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "erzencode",
    );
  }

  // Linux and others - use XDG_CONFIG_HOME or fallback to ~/.config
  const xdgConfig =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfig, "erzencode");
}

/**
 * Get the data directory path (for sessions, history, etc.)
 * - Windows: %LOCALAPPDATA%\erzencode
 * - macOS: ~/Library/Application Support/erzencode
 * - Linux: ~/.local/share/erzencode (or $XDG_DATA_HOME/erzencode)
 */
export function getDataDir(): string {
  const platform = process.platform;

  if (platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "erzencode",
    );
  }

  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "erzencode",
    );
  }

  // Linux and others
  const xdgData =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgData, "erzencode");
}

export function resolveConfigPath(options: { config?: string }): string {
  if (options.config) return path.resolve(options.config);
  return path.join(getConfigDir(), "config.json");
}

export function getGlobalConfigPath(): string {
  return path.join(getConfigDir(), "global.json");
}

export function getSessionsPath(): string {
  return path.join(getDataDir(), "sessions.json");
}

export function getHistoryPath(): string {
  return path.join(getDataDir(), "history.json");
}

export async function ensureConfigDirs(): Promise<void> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  await fs.mkdir(getDataDir(), { recursive: true });
}

// ============================================================================
// Global Config Management
// ============================================================================

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  try {
    const content = await fs.readFile(getGlobalConfigPath(), "utf-8");
    return JSON.parse(content) as GlobalConfig;
  } catch {
    return {};
  }
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await ensureConfigDirs();
  await fs.writeFile(
    getGlobalConfigPath(),
    JSON.stringify(config, null, 2),
    "utf-8",
  );
}

export async function setApiKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  const config = await loadGlobalConfig();
  if (!config.apiKeys) {
    config.apiKeys = {};
  }
  (config.apiKeys as any)[provider] = apiKey;
  await saveGlobalConfig(config);
}

export async function getApiKeyFromConfig(
  provider: string,
): Promise<string | undefined> {
  const config = await loadGlobalConfig();
  return config.apiKeys?.[
    provider as keyof NonNullable<GlobalConfig["apiKeys"]>
  ];
}

// ============================================================================
// Local Config Management
// ============================================================================

export async function loadConfig(
  configPath: string,
): Promise<ErzencodeConfig | null> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content) as ErzencodeConfig;
  } catch {
    return null;
  }
}

/**
 * Check if config is complete and ready to use
 * Returns true if we have a provider, model, and valid API key
 */
export async function isConfigComplete(
  config: ErzencodeConfig | null,
): Promise<boolean> {
  if (!config) return false;
  if (!config.setupComplete) return false;
  if (!config.provider) return false;
  if (!config.model) return false;

  // Check if we have an API key for the provider
  const apiKey = await getApiKeyAsync(config.provider);
  if (!apiKey && config.provider !== "ollama") return false;

  return true;
}

/**
 * Create a default config with sensible defaults
 */
export function createDefaultConfig(): ErzencodeConfig {
  return {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    mode: "agent",
    renderer: "markdown",
    thinkingLevel: "off",
    allowUnknownModels: true,
    setupComplete: false,
    firstRunAt: Date.now(),
  };
}

/**
 * Ensure config exists, create default if not
 */
export async function ensureConfig(
  configPath: string,
): Promise<ErzencodeConfig> {
  await ensureConfigDirs();
  let config = await loadConfig(configPath);

  if (!config) {
    config = createDefaultConfig();
    await saveConfig(configPath, config);
  }

  return config;
}

export async function saveConfig(
  configPath: string,
  config: ErzencodeConfig,
): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

// ============================================================================
// Session Management
// ============================================================================

export async function loadSessions(): Promise<SessionData[]> {
  try {
    const content = await fs.readFile(getSessionsPath(), "utf-8");
    return JSON.parse(content) as SessionData[];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: SessionData[]): Promise<void> {
  await ensureConfigDirs();
  await fs.writeFile(
    getSessionsPath(),
    JSON.stringify(sessions, null, 2),
    "utf-8",
  );
}

export async function saveSession(session: SessionData): Promise<void> {
  const sessions = await loadSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  await saveSessions(sessions);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await loadSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  await saveSessions(filtered);
}

// ============================================================================
// Command History Management
// ============================================================================

export interface CommandHistory {
  commands: string[];
  maxSize: number;
}

export function getCommandHistoryPath(): string {
  return path.join(getDataDir(), "command-history.json");
}

export async function loadCommandHistory(): Promise<string[]> {
  try {
    const content = await fs.readFile(getCommandHistoryPath(), "utf-8");
    const data = JSON.parse(content) as CommandHistory;
    return data.commands ?? [];
  } catch {
    return [];
  }
}

export async function saveCommandHistory(
  commands: string[],
  maxSize: number = 500,
): Promise<void> {
  await ensureConfigDirs();
  const trimmed = commands.slice(-maxSize);
  await fs.writeFile(
    getCommandHistoryPath(),
    JSON.stringify({ commands: trimmed, maxSize }, null, 2),
    "utf-8",
  );
}

export async function appendToCommandHistory(command: string): Promise<void> {
  const history = await loadCommandHistory();
  // Avoid duplicates at the end
  if (history[history.length - 1] !== command) {
    history.push(command);
  }
  await saveCommandHistory(history);
}

// ============================================================================
// Thinking Configuration
// ============================================================================

export function resolveThinkingConfig(
  level: ThinkingLevel,
  supportsThinking = true,
): ThinkingConfig {
  if (!supportsThinking || level === "off") {
    return { enabled: false };
  }

  const budgets: Record<ThinkingLevel, number> = {
    off: 0,
    low: 1024,
    medium: 4096,
    high: 16384,
  };

  return {
    enabled: true,
    budgetTokens: budgets[level],
  };
}

// ============================================================================
// API Key Resolution
// ============================================================================

const PROVIDER_ENV_VARS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  together: "TOGETHER_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  mistral: "MISTRAL_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  cohere: "COHERE_API_KEY",
  copilot: "GITHUB_COPILOT_TOKEN",
  azure: "AZURE_OPENAI_API_KEY",
  vercel: "VERCEL_AI_GATEWAY_API_KEY",
  ollama: "OLLAMA_HOST",
  exa: "EXA_API_KEY",
  zai: "ZAI_API_KEY",
  "zai-coding-plan": "ZAI_API_KEY",
};

/**
 * Get API key for a provider
 * Priority: 1. Environment variable, 2. Global config, 3. Fallback
 */
export function getApiKey(provider: ProviderType | string): string | undefined {
  // First check environment variable
  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  // Check provider-specific env var from models.ts
  const providerInfo = getProvider(provider);
  if (providerInfo?.envVar && process.env[providerInfo.envVar]) {
    return process.env[providerInfo.envVar];
  }

  // Fallback to generic key
  return process.env.AI_INFRA_API_KEY;
}

/**
 * Get API key with async global config check
 * For Copilot, this fetches and refreshes the token automatically
 */
export async function getApiKeyAsync(
  provider: ProviderType | string,
): Promise<string | undefined> {
  // Special handling for GitHub Copilot - use the Copilot token system
  if (provider === "copilot") {
    try {
      const isAuth = await isCopilotAuthenticated();
      if (isAuth) {
        return await getCopilotToken();
      }
      // Not authenticated, will need to run /connect
      return undefined;
    } catch {
      // Token fetch failed, user needs to re-authenticate
      return undefined;
    }
  }

  // First check environment variable
  const envKey = getApiKey(provider);
  if (envKey) return envKey;

  // Then check global config
  const configKey = await getApiKeyFromConfig(provider);
  if (configKey) return configKey;

  return undefined;
}

export function getBaseUrl(
  provider: ProviderType | string,
): string | undefined {
  const envMap: Record<string, string> = {
    openai: "OPENAI_BASE_URL",
    anthropic: "ANTHROPIC_BASE_URL",
    openrouter: "OPENROUTER_BASE_URL",
    together: "TOGETHER_BASE_URL",
    fireworks: "FIREWORKS_BASE_URL",
    xai: "XAI_BASE_URL",
    perplexity: "PERPLEXITY_BASE_URL",
    groq: "GROQ_BASE_URL",
    mistral: "MISTRAL_BASE_URL",
    cohere: "COHERE_BASE_URL",
    deepseek: "DEEPSEEK_BASE_URL",
    ollama: "OLLAMA_HOST",
  };

  const envVar = envMap[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  // Check provider default base URL from models.ts
  const providerInfo = getProvider(provider);
  if (providerInfo?.baseUrl) {
    return providerInfo.baseUrl;
  }

  return undefined;
}

/**
 * Get base URL with async global config check
 */
export async function getBaseUrlAsync(
  provider: ProviderType | string,
): Promise<string | undefined> {
  // First check environment variable
  const envUrl = getBaseUrl(provider);
  if (envUrl) return envUrl;

  // Then check global config
  const config = await loadGlobalConfig();
  if (config.baseUrls?.[provider]) {
    return config.baseUrls[provider];
  }

  return undefined;
}

// ============================================================================
// Dynamic Model Loading
// ============================================================================

export interface ProviderModels {
  provider: ProviderType;
  models: Array<{
    id: string;
    name?: string;
    contextLength?: number;
    pricing?: { input: number; output: number };
  }>;
}

// Fetch models dynamically from providers (when API supports it)
export async function fetchProviderModels(
  provider: ProviderType | string,
  apiKey?: string,
  baseUrl?: string,
): Promise<string[]> {
  const key = apiKey ?? getApiKey(provider);

  try {
    // First, try models.dev API via models.ts for all providers (most up-to-date)
    try {
      const { getModelIdsAsync } = await import("./models.js");
      const dynamicModels = await getModelIdsAsync(provider);
      if (dynamicModels.length > 0) {
        return dynamicModels;
      }
    } catch {
      // models.dev failed, fall through to provider-specific APIs
    }

    // Provider-specific API fallbacks for providers not in models.dev
    switch (provider) {
      case "ollama": {
        const url = baseUrl ?? "http://localhost:11434";
        const response = await fetch(`${url}/api/tags`);
        if (!response.ok) throw new Error("Failed to fetch");
        const data = (await response.json()) as {
          models: Array<{ name: string; modified_at?: string }>;
        };
        // Sort by modified_at descending (newest first)
        return data.models
          .sort((a, b) => {
            if (!a.modified_at && !b.modified_at) return 0;
            if (!a.modified_at) return 1;
            if (!b.modified_at) return -1;
            return b.modified_at.localeCompare(a.modified_at);
          })
          .map((m) => m.name);
      }

      case "openai": {
        // Only fallback to OpenAI API if models.dev didn't have data
        const url = baseUrl ?? "https://api.openai.com/v1";
        const response = await fetch(`${url}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!response.ok) throw new Error("Failed to fetch");
        const data = (await response.json()) as {
          data: Array<{ id: string; created?: number }>;
        };
        return (
          data.data
            .filter(
              (m) =>
                m.id.startsWith("gpt-") ||
                m.id.startsWith("o1") ||
                m.id.startsWith("o3") ||
                m.id.startsWith("o4"),
            )
            // Sort by created timestamp descending (newest first)
            .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
            .map((m) => m.id)
        );
      }

      case "groq": {
        const response = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!response.ok) throw new Error("Failed to fetch");
        const data = (await response.json()) as {
          data: Array<{ id: string; created?: number }>;
        };
        // Sort by created timestamp descending (newest first)
        return data.data
          .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
          .map((m) => m.id);
      }

      case "together": {
        const response = await fetch("https://api.together.xyz/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!response.ok) throw new Error("Failed to fetch");
        const data = (await response.json()) as Array<{
          id: string;
          created?: number;
        }>;
        return (
          data
            .filter((m) => m.id.includes("instruct") || m.id.includes("chat"))
            // Sort by created timestamp descending (newest first)
            .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
            .slice(0, 50)
            .map((m) => m.id)
        );
      }

      default: {
        // Return static choices for providers that don't have a models API
        return MODEL_CHOICES[provider] ?? [];
      }
    }
  } catch {
    // Fallback to static choices
    return MODEL_CHOICES[provider] ?? [];
  }
}
