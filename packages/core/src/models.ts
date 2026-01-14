/**
 * Models Configuration
 * Dynamic model loading from models.dev API
 */

import type { ProviderType } from "./ai-provider.js";
import {
  getDynamicModelsForProvider,
  fetchModelsDevData,
  convertToModelInfo,
  type ModelsDevModel,
} from "./models-api.js";

// ============================================================================
// Types
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType | string;
  contextWindow: number;
  maxOutput?: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities?: {
    vision?: boolean;
    functionCalling?: boolean;
    streaming?: boolean;
    thinking?: boolean;
    codeExecution?: boolean;
  };
  description?: string;
}

export interface ProviderInfo {
  id: ProviderType | string;
  name: string;
  envVar: string;
  baseUrl?: string;
  description?: string;
}

// ============================================================================
// Providers
// ============================================================================

export const PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", name: "Anthropic", envVar: "ANTHROPIC_API_KEY", description: "Claude models" },
  { id: "openai", name: "OpenAI", envVar: "OPENAI_API_KEY", description: "GPT models" },
  { id: "google", name: "Google AI", envVar: "GOOGLE_API_KEY", description: "Gemini models" },
  { id: "xai", name: "xAI", envVar: "XAI_API_KEY", description: "Grok models" },
  { id: "openrouter", name: "OpenRouter", envVar: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1", description: "Multi-provider API" },
  { id: "groq", name: "Groq", envVar: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", description: "Fast inference" },
  { id: "together", name: "Together AI", envVar: "TOGETHER_API_KEY", baseUrl: "https://api.together.xyz/v1", description: "Open source models" },
  { id: "fireworks", name: "Fireworks AI", envVar: "FIREWORKS_API_KEY", baseUrl: "https://api.fireworks.ai/inference/v1", description: "Fast inference" },
  { id: "deepseek", name: "DeepSeek", envVar: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1", description: "DeepSeek models" },
  { id: "mistral", name: "Mistral AI", envVar: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1", description: "Mistral models" },
  { id: "perplexity", name: "Perplexity", envVar: "PERPLEXITY_API_KEY", baseUrl: "https://api.perplexity.ai", description: "Search-augmented" },
  { id: "cohere", name: "Cohere", envVar: "COHERE_API_KEY", description: "Command models" },
  { id: "copilot", name: "GitHub Copilot", envVar: "GITHUB_COPILOT_TOKEN", baseUrl: "https://api.githubcopilot.com", description: "Copilot models" },
  { id: "ollama", name: "Ollama (Local)", envVar: "OLLAMA_HOST", baseUrl: "http://localhost:11434", description: "Local models" },
  { id: "zai", name: "z.ai", envVar: "ZAI_API_KEY", baseUrl: "https://api.z.ai/api/paas/v4", description: "z.ai models" },
  { id: "zai-coding-plan", name: "z.ai Coding Plan", envVar: "ZAI_API_KEY", baseUrl: "https://api.z.ai/api/coding/paas/v4", description: "z.ai Coding Plan models" },
];

// ============================================================================
// Default Models (fallback when dynamic loading fails)
// ============================================================================

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  xai: "grok-2",
  openrouter: "anthropic/claude-3.5-sonnet",
  groq: "llama-3.3-70b-versatile",
  together: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  fireworks: "accounts/fireworks/models/llama-v3p1-70b-instruct",
  deepseek: "deepseek-chat",
  mistral: "mistral-large-latest",
  perplexity: "llama-3.1-sonar-large-128k-online",
  cohere: "command-r-plus",
  copilot: "gpt-4o",
  ollama: "llama3.2",
  zai: "glm-4.7",
  "zai-coding-plan": "glm-4.7",
};

// ============================================================================
// Cache
// ============================================================================

const modelsCache = new Map<string, ModelInfo[]>();
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function isCacheValid(): boolean {
  return modelsCache.size > 0 && Date.now() - cacheTimestamp < CACHE_DURATION_MS;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get models for a provider (async - fetches from API)
 */
export async function getModelsForProviderAsync(provider: string): Promise<ModelInfo[]> {
  // Check cache first
  if (isCacheValid() && modelsCache.has(provider)) {
    return modelsCache.get(provider)!;
  }

  try {
    const models = await getDynamicModelsForProvider(provider);
    if (models.length > 0) {
      modelsCache.set(provider, models);
      cacheTimestamp = Date.now();
      return models;
    }
  } catch {
    // Fall through to empty array
  }

  return [];
}

/**
 * Get models for a provider (sync - cache only)
 */
export function getModelsForProvider(provider: string): ModelInfo[] {
  return modelsCache.get(provider) ?? [];
}

/**
 * Get model IDs for a provider
 */
export async function getModelIdsAsync(provider: string): Promise<string[]> {
  const models = await getModelsForProviderAsync(provider);
  return models.map((m) => m.id);
}

/**
 * Get a specific model by ID
 */
export async function getModelAsync(provider: string, modelId: string): Promise<ModelInfo | undefined> {
  const models = await getModelsForProviderAsync(provider);
  return models.find((m) => m.id === modelId);
}

/**
 * Get a specific model by ID (sync - cache only)
 */
export function getModel(provider: string, modelId: string): ModelInfo | undefined {
  return getModelsForProvider(provider).find((m) => m.id === modelId);
}

/**
 * Preload models for all providers
 */
export async function preloadDynamicModels(): Promise<void> {
  try {
    const data = await fetchModelsDevData();
    for (const [providerId, providerData] of Object.entries(data)) {
      const models = Object.values(providerData.models as Record<string, ModelsDevModel>)
        .map((m) => convertToModelInfo(m, providerId));
      if (models.length > 0) {
        modelsCache.set(providerId, models);
      }
    }
    cacheTimestamp = Date.now();
  } catch {
    // Silent fail
  }
}

/**
 * Check if a model supports a capability
 */
export function modelSupports(
  provider: string,
  modelId: string,
  capability: keyof NonNullable<ModelInfo["capabilities"]>,
): boolean {
  return getModel(provider, modelId)?.capabilities?.[capability] ?? false;
}

/**
 * Check if cache has data
 */
export function hasDynamicModelsCache(): boolean {
  return isCacheValid();
}

/**
 * Clear cache
 */
export function clearDynamicModelsCache(): void {
  modelsCache.clear();
  cacheTimestamp = 0;
}

// ============================================================================
// Provider Helpers
// ============================================================================

export function getProvider(providerId: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

export function getProviderIds(): string[] {
  return PROVIDERS.map((p) => p.id as string);
}

export function getDefaultModel(provider: string): string {
  return DEFAULT_MODELS[provider] ?? "gpt-4o";
}

export async function getDefaultModelAsync(provider: string): Promise<string> {
  const models = await getModelsForProviderAsync(provider);
  return models[0]?.id ?? DEFAULT_MODELS[provider] ?? "gpt-4o";
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

export const MODEL_CHOICES: Record<string, string[]> = {};
export const PROVIDER_CHOICES: string[] = getProviderIds();

export async function getModelChoicesAsync(provider: string): Promise<string[]> {
  return getModelIdsAsync(provider);
}

export function getModelIds(provider: string): string[] {
  return getModelsForProvider(provider).map((m) => m.id);
}

// Legacy - empty static models
export const MODELS: Record<string, ModelInfo[]> = {};
