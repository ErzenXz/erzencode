/**
 * Dynamic Model Fetching from models.dev API
 * https://github.com/sst/models.dev
 */

import type { ProviderType } from "./ai-provider.js";

// ============================================================================
// Types from models.dev API
// ============================================================================

export interface ModelsDevModel {
  id: string;
  name: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  knowledge?: string;
  release_date?: string;
  last_updated?: string;
  modalities?: {
    input?: string[];
    output?: string[];
  };
  open_weights?: boolean;
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
    reasoning?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
  interleaved?: boolean | { field: string };
}

export interface ModelsDevProvider {
  id: string;
  env?: string[];
  npm?: string;
  api?: string;
  name: string;
  doc?: string;
  models: Record<string, ModelsDevModel>;
}

export type ModelsDevData = Record<string, ModelsDevProvider>;

// ============================================================================
// API Constants
// ============================================================================

const MODELS_DEV_API_URL = "https://models.dev/api.json";
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour cache

// In-memory cache
let cachedData: ModelsDevData | null = null;
let cacheTimestamp: number = 0;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all models from models.dev API
 */
export async function fetchModelsDevData(): Promise<ModelsDevData> {
  // Check cache
  if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedData;
  }

  try {
    const response = await fetch(MODELS_DEV_API_URL, {
      headers: {
        "User-Agent": "erzencode-cli/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = (await response.json()) as ModelsDevData;

    // Update cache
    cachedData = data;
    cacheTimestamp = Date.now();

    return data;
  } catch (error) {
    console.error("Failed to fetch models from models.dev:", error);
    // Return cached data if available, even if stale
    if (cachedData) {
      return cachedData;
    }
    throw error;
  }
}

/**
 * Get list of all providers from models.dev
 */
export async function getModelsDevProviders(): Promise<ModelsDevProvider[]> {
  const data = await fetchModelsDevData();
  return Object.values(data);
}

/**
 * Get models for a specific provider
 */
export async function getModelsDevModelsForProvider(
  providerId: string,
): Promise<ModelsDevModel[]> {
  const data = await fetchModelsDevData();

  // Map our provider IDs to models.dev provider IDs
  const providerMapping: Record<string, string[]> = {
    anthropic: ["anthropic"],
    openai: ["openai"],
    google: ["google"],
    xai: ["xai"],
    deepseek: ["deepseek"],
    mistral: ["mistral"],
    groq: ["groq"],
    together: ["together"],
    fireworks: ["fireworks"],
    openrouter: ["openrouter"],
    perplexity: ["perplexity"],
    cohere: ["cohere"],
    copilot: ["copilot", "github-copilot"],
    azure: ["azure", "azure-openai"],
    bedrock: ["bedrock", "amazon-bedrock"],
    cerebras: ["cerebras"],
    nvidia: ["nvidia"],
    zai: ["zai", "z-ai", "z.ai"],
    sambanova: ["sambanova"],
    lambda: ["lambda", "lambdalabs"],
    hyperbolic: ["hyperbolic"],
    nebiusai: ["nebiusai", "nebius"],
    inferencenet: ["inferencenet", "inference-net"],
    kluster: ["kluster", "klusterai"],
    novita: ["novita", "novitaai"],
    avian: ["avian", "avianio"],
    chutes: ["chutes", "chutesai"],
    targon: ["targon"],
  };

  const mappedIds = providerMapping[providerId] ?? [providerId];

  for (const id of mappedIds) {
    if (data[id]) {
      return Object.values(data[id].models);
    }
  }

  return [];
}

/**
 * Convert models.dev model to our ModelInfo format
 */
export function convertToModelInfo(
  model: ModelsDevModel,
  provider: string,
): import("./models.js").ModelInfo {
  return {
    id: model.id,
    name: model.name,
    provider,
    contextWindow: model.limit?.context ?? 128000,
    maxOutput: model.limit?.output,
    pricing: model.cost
      ? {
          input: model.cost.input ?? 0,
          output: model.cost.output ?? 0,
        }
      : undefined,
    capabilities: {
      vision: model.modalities?.input?.includes("image") ?? model.attachment,
      functionCalling: model.tool_call ?? false,
      streaming: true,
      thinking: model.reasoning ?? false,
    },
    description: `${model.name}${model.knowledge ? ` (Knowledge: ${model.knowledge})` : ""}`,
  };
}

/**
 * Get all models for a provider, converting to our format
 * Sorted by release date (newest first)
 */
export async function getDynamicModelsForProvider(
  provider: string,
): Promise<import("./models.js").ModelInfo[]> {
  try {
    const models = await getModelsDevModelsForProvider(provider);
    const converted = models.map((m) => convertToModelInfo(m, provider));

    // Sort by release_date descending (newest first)
    // Models without release_date go to the end
    return converted.sort((a, b) => {
      const modelA = models.find((m) => m.id === a.id);
      const modelB = models.find((m) => m.id === b.id);
      const dateA = modelA?.release_date ?? modelA?.last_updated ?? "";
      const dateB = modelB?.release_date ?? modelB?.last_updated ?? "";

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      // Sort descending (newest first)
      return dateB.localeCompare(dateA);
    });
  } catch {
    return [];
  }
}

/**
 * Get provider info from models.dev
 */
export async function getModelsDevProviderInfo(
  providerId: string,
): Promise<ModelsDevProvider | null> {
  const data = await fetchModelsDevData();
  return data[providerId] ?? null;
}

// ============================================================================
// Provider-specific configurations
// ============================================================================

export interface ProviderConfig {
  id: string;
  name: string;
  envVars: string[];
  baseUrl?: string;
  npm?: string;
  description?: string;
  authType?: "api-key" | "oauth" | "token";
  oauthUrl?: string;
}

/**
 * Enhanced provider configurations with auth details
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    envVars: ["ANTHROPIC_API_KEY"],
    description: "Claude models - best for coding and reasoning",
    authType: "api-key",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    envVars: ["OPENAI_API_KEY"],
    description: "GPT-4o, GPT-5, and o-series reasoning models",
    authType: "api-key",
  },
  google: {
    id: "google",
    name: "Google AI",
    envVars: ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    description: "Gemini models with large context windows",
    authType: "api-key",
  },
  xai: {
    id: "xai",
    name: "xAI",
    envVars: ["XAI_API_KEY"],
    description: "Grok models",
    authType: "api-key",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    envVars: ["DEEPSEEK_API_KEY"],
    baseUrl: "https://api.deepseek.com/v1",
    description: "DeepSeek coding and reasoning models",
    authType: "api-key",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    envVars: ["MISTRAL_API_KEY"],
    baseUrl: "https://api.mistral.ai/v1",
    description: "Mistral and Codestral models",
    authType: "api-key",
  },
  groq: {
    id: "groq",
    name: "Groq",
    envVars: ["GROQ_API_KEY"],
    baseUrl: "https://api.groq.com/openai/v1",
    description: "Ultra-fast inference",
    authType: "api-key",
  },
  together: {
    id: "together",
    name: "Together AI",
    envVars: ["TOGETHER_API_KEY"],
    baseUrl: "https://api.together.xyz/v1",
    description: "Open source model hosting",
    authType: "api-key",
  },
  fireworks: {
    id: "fireworks",
    name: "Fireworks AI",
    envVars: ["FIREWORKS_API_KEY"],
    baseUrl: "https://api.fireworks.ai/inference/v1",
    description: "Fast inference for open models",
    authType: "api-key",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    envVars: ["OPENROUTER_API_KEY"],
    baseUrl: "https://openrouter.ai/api/v1",
    description: "Access multiple providers through one API",
    authType: "api-key",
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    envVars: ["PERPLEXITY_API_KEY"],
    baseUrl: "https://api.perplexity.ai",
    description: "Online search-augmented models",
    authType: "api-key",
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    envVars: ["COHERE_API_KEY"],
    description: "Command models with RAG capabilities",
    authType: "api-key",
  },
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    envVars: ["GITHUB_TOKEN", "COPILOT_TOKEN"],
    description: "Use your GitHub Copilot subscription",
    authType: "oauth",
    oauthUrl: "https://github.com/login/device",
  },
  azure: {
    id: "azure",
    name: "Azure OpenAI",
    envVars: ["AZURE_OPENAI_API_KEY", "AZURE_API_KEY"],
    description: "Azure-hosted OpenAI models",
    authType: "api-key",
  },
  bedrock: {
    id: "bedrock",
    name: "Amazon Bedrock",
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    description: "AWS Bedrock models",
    authType: "api-key",
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    envVars: ["CEREBRAS_API_KEY"],
    description: "Ultra-fast Cerebras inference",
    authType: "api-key",
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA",
    envVars: ["NVIDIA_API_KEY"],
    baseUrl: "https://integrate.api.nvidia.com/v1",
    description: "NVIDIA NIM models",
    authType: "api-key",
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    envVars: ["OLLAMA_HOST"],
    baseUrl: "http://localhost:11434",
    description: "Run models locally",
    authType: "api-key",
  },
  zai: {
    id: "zai",
    name: "z.ai",
    envVars: ["ZAI_API_KEY"],
    baseUrl: "https://api.z.ai/api/coding/paas/v4/",
    description: "z.ai coding models with Pro/Coding plans",
    authType: "api-key",
  },
  sambanova: {
    id: "sambanova",
    name: "SambaNova",
    envVars: ["SAMBANOVA_API_KEY"],
    baseUrl: "https://api.sambanova.ai/v1",
    description: "SambaNova ultra-fast inference",
    authType: "api-key",
  },
  lambda: {
    id: "lambda",
    name: "Lambda Labs",
    envVars: ["LAMBDA_API_KEY"],
    baseUrl: "https://api.lambdalabs.com/v1",
    description: "Lambda Labs GPU cloud inference",
    authType: "api-key",
  },
  hyperbolic: {
    id: "hyperbolic",
    name: "Hyperbolic",
    envVars: ["HYPERBOLIC_API_KEY"],
    baseUrl: "https://api.hyperbolic.xyz/v1",
    description: "Hyperbolic decentralized inference",
    authType: "api-key",
  },
  nebiusai: {
    id: "nebiusai",
    name: "Nebius AI",
    envVars: ["NEBIUS_API_KEY"],
    baseUrl: "https://api.studio.nebius.ai/v1",
    description: "Nebius AI Studio models",
    authType: "api-key",
  },
  inferencenet: {
    id: "inferencenet",
    name: "Inference.net",
    envVars: ["INFERENCENET_API_KEY"],
    baseUrl: "https://api.inference.net/v1",
    description: "Inference.net distributed inference",
    authType: "api-key",
  },
  kluster: {
    id: "kluster",
    name: "Kluster AI",
    envVars: ["KLUSTER_API_KEY"],
    baseUrl: "https://api.kluster.ai/v1",
    description: "Kluster AI inference platform",
    authType: "api-key",
  },
  novita: {
    id: "novita",
    name: "Novita AI",
    envVars: ["NOVITA_API_KEY"],
    baseUrl: "https://api.novita.ai/v3/openai",
    description: "Novita AI model hosting",
    authType: "api-key",
  },
  avian: {
    id: "avian",
    name: "Avian.io",
    envVars: ["AVIAN_API_KEY"],
    baseUrl: "https://api.avian.io/v1",
    description: "Avian AI inference",
    authType: "api-key",
  },
  chutes: {
    id: "chutes",
    name: "Chutes AI",
    envVars: ["CHUTES_API_KEY"],
    baseUrl: "https://llm.chutes.ai/v1",
    description: "Chutes AI serverless inference",
    authType: "api-key",
  },
  targon: {
    id: "targon",
    name: "Targon",
    envVars: ["TARGON_API_KEY"],
    baseUrl: "https://api.targon.com/v1",
    description: "Targon AI inference",
    authType: "api-key",
  },
};

/**
 * Get all available provider IDs
 */
export function getAvailableProviders(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}

/**
 * Get provider config
 */
export function getProviderConfig(
  providerId: string,
): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[providerId];
}
