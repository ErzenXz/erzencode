/**
 * Models Configuration
 * Comprehensive list of AI models from all major providers
 * Based on Cursor.com supported models and other frontier providers
 */

import type { ProviderType } from "./ai-provider.js";

// ============================================================================
// Model Metadata Types
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType | string;
  contextWindow: number;
  maxOutput?: number;
  pricing?: {
    input: number; // per million tokens
    output: number; // per million tokens
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
// Providers Configuration
// ============================================================================

export const PROVIDERS: ProviderInfo[] = [
  // Tier 1 - Major Providers
  {
    id: "anthropic",
    name: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    description: "Claude models - best for coding and reasoning",
  },
  {
    id: "openai",
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    description: "GPT-4o and o1 reasoning models",
  },
  {
    id: "google",
    name: "Google AI",
    envVar: "GOOGLE_API_KEY",
    description: "Gemini models with large context windows",
  },
  {
    id: "xai",
    name: "xAI",
    envVar: "XAI_API_KEY",
    description: "Grok models",
  },

  // Tier 2 - OpenAI Compatible Providers
  {
    id: "openrouter",
    name: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    description: "Access multiple providers through one API",
  },
  {
    id: "groq",
    name: "Groq",
    envVar: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    description: "Ultra-fast inference",
  },
  {
    id: "together",
    name: "Together AI",
    envVar: "TOGETHER_API_KEY",
    baseUrl: "https://api.together.xyz/v1",
    description: "Open source model hosting",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    envVar: "FIREWORKS_API_KEY",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    description: "Fast inference for open models",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    description: "DeepSeek coding and reasoning models",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    envVar: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    description: "Mistral and Codestral models",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    envVar: "PERPLEXITY_API_KEY",
    baseUrl: "https://api.perplexity.ai",
    description: "Online search-augmented models",
  },
  {
    id: "cohere",
    name: "Cohere",
    envVar: "COHERE_API_KEY",
    description: "Command models with RAG capabilities",
  },

  // Tier 3 - Special Providers
  {
    id: "copilot",
    name: "GitHub Copilot",
    envVar: "GITHUB_COPILOT_TOKEN",
    baseUrl: "https://api.githubcopilot.com",
    description: "GitHub Copilot models (requires Copilot subscription)",
  },
  {
    id: "vercel",
    name: "Vercel AI Gateway",
    envVar: "VERCEL_AI_GATEWAY_API_KEY",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    description:
      "Unified API for 100+ models with load balancing and fallbacks",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    envVar: "AZURE_OPENAI_API_KEY",
    description: "Azure-hosted OpenAI models",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    envVar: "OLLAMA_HOST",
    baseUrl: "http://localhost:11434",
    description: "Run models locally",
  },
  {
    id: "zai",
    name: "Z.AI",
    envVar: "ZAI_API_KEY",
    baseUrl: "https://api.z.ai/api/paas/v4",
    description: "Z.AI - GLM models for general use",
  },
  {
    id: "zai-coding-plan",
    name: "Z.AI Coding Plan",
    envVar: "ZAI_API_KEY",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    description: "Z.AI Coding Plan - Access to premium models for coding",
  },
];

// ============================================================================
// Models by Provider
// ============================================================================

export const MODELS: Record<string, ModelInfo[]> = {
  // ==========================================================================
  // Anthropic Models (Updated from models.dev)
  // ==========================================================================
  anthropic: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 64000,
      pricing: { input: 3, output: 15 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest Claude 4 Sonnet - excellent for coding",
    },
    {
      id: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 64000,
      pricing: { input: 3, output: 15 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest Claude 4.5 Sonnet - most capable Sonnet",
    },
    {
      id: "claude-opus-4-20250514",
      name: "Claude Opus 4",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 32000,
      pricing: { input: 15, output: 75 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Most capable Claude 4 model",
    },
    {
      id: "claude-opus-4-5-20251121",
      name: "Claude Opus 4.5",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 64000,
      pricing: { input: 4.3, output: 21 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest Claude Opus 4.5 - most capable model",
    },
    {
      id: "claude-haiku-4-5-20251015",
      name: "Claude Haiku 4.5",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 64000,
      pricing: { input: 0.85, output: 4.3 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Fast and efficient Claude Haiku 4.5",
    },
    {
      id: "claude-3-7-sonnet-20250219",
      name: "Claude 3.7 Sonnet",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 64000,
      pricing: { input: 3, output: 15 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Claude 3.7 with extended thinking",
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 8192,
      pricing: { input: 3, output: 15 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Previous generation Claude 3.5",
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 8192,
      pricing: { input: 0.8, output: 4 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Fast and efficient Claude 3.5 Haiku",
    },
  ],

  // ==========================================================================
  // OpenAI Models (Updated from models.dev)
  // ==========================================================================
  openai: [
    {
      id: "gpt-5",
      name: "GPT-5",
      provider: "openai",
      contextWindow: 400000,
      maxOutput: 128000,
      pricing: { input: 1.1, output: 9 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "GPT-5 - Latest flagship model with reasoning",
    },
    {
      id: "gpt-5.1-codex",
      name: "GPT-5.1 Codex",
      provider: "openai",
      contextWindow: 400000,
      maxOutput: 128000,
      pricing: { input: 1.1, output: 9 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "GPT-5.1 Codex - optimized for coding",
    },
    {
      id: "gpt-5-mini",
      name: "GPT-5 Mini",
      provider: "openai",
      contextWindow: 400000,
      maxOutput: 128000,
      pricing: { input: 0.22, output: 1.8 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "GPT-5 Mini - fast and efficient",
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      contextWindow: 128000,
      maxOutput: 16384,
      pricing: { input: 2.5, output: 10 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4o - fast multimodal model",
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai",
      contextWindow: 128000,
      maxOutput: 16384,
      pricing: { input: 0.15, output: 0.6 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Cost-effective GPT-4o variant",
    },
    {
      id: "gpt-4.1",
      name: "GPT-4.1",
      provider: "openai",
      contextWindow: 1000000,
      maxOutput: 32768,
      pricing: { input: 1.8, output: 7.2 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4.1 with 1M context window",
    },
    {
      id: "gpt-4.1-mini",
      name: "GPT-4.1 Mini",
      provider: "openai",
      contextWindow: 1000000,
      maxOutput: 32768,
      pricing: { input: 0.36, output: 1.4 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Cost-effective GPT-4.1 variant",
    },
    {
      id: "o3",
      name: "o3",
      provider: "openai",
      contextWindow: 200000,
      maxOutput: 100000,
      pricing: { input: 1.8, output: 7.2 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "o3 - Latest reasoning model",
    },
    {
      id: "o3-pro",
      name: "o3 Pro",
      provider: "openai",
      contextWindow: 200000,
      maxOutput: 100000,
      pricing: { input: 18, output: 72 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "o3 Pro - Most capable reasoning model",
    },
    {
      id: "o3-mini",
      name: "o3 Mini",
      provider: "openai",
      contextWindow: 200000,
      maxOutput: 100000,
      pricing: { input: 0.99, output: 4 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "o3 Mini - Fast reasoning",
    },
    {
      id: "o4-mini",
      name: "o4 Mini",
      provider: "openai",
      contextWindow: 200000,
      maxOutput: 100000,
      pricing: { input: 0.99, output: 4 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "o4 Mini - Latest efficient reasoning",
    },
    {
      id: "o1",
      name: "o1",
      provider: "openai",
      contextWindow: 200000,
      maxOutput: 100000,
      pricing: { input: 14, output: 54 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "o1 reasoning model",
    },
    {
      id: "o1-pro",
      name: "o1 Pro",
      provider: "openai",
      contextWindow: 200000,
      maxOutput: 100000,
      pricing: { input: 140, output: 540 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "o1 Pro - Most capable o1 reasoning",
    },
  ],

  // ==========================================================================
  // Google Models (Updated from models.dev)
  // ==========================================================================
  google: [
    {
      id: "gemini-3-pro",
      name: "Gemini 3 Pro",
      provider: "google",
      contextWindow: 1000000,
      maxOutput: 64000,
      pricing: { input: 1.6, output: 9.6 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
        codeExecution: true,
      },
      description: "Gemini 3 Pro - Latest flagship with 1M context",
    },
    {
      id: "gemini-3-flash",
      name: "Gemini 3 Flash",
      provider: "google",
      contextWindow: 1000000,
      maxOutput: 65536,
      pricing: { input: 0.4, output: 2.4 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Gemini 3 Flash - Fast with 1M context",
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      provider: "google",
      contextWindow: 1000000,
      maxOutput: 65536,
      pricing: { input: 0.87, output: 7 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
        codeExecution: true,
      },
      description: "Gemini 2.5 Pro with thinking",
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      provider: "google",
      contextWindow: 1000000,
      maxOutput: 65536,
      pricing: { input: 0.21, output: 1.8 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Gemini 2.5 Flash - Fast with thinking",
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      provider: "google",
      contextWindow: 1000000,
      maxOutput: 8192,
      pricing: { input: 0.1, output: 0.42 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Gemini 2.0 Flash - Fast and efficient",
    },
  ],

  // ==========================================================================
  // xAI Models (Updated from models.dev)
  // ==========================================================================
  xai: [
    {
      id: "grok-4",
      name: "Grok 4",
      provider: "xai",
      contextWindow: 256000,
      maxOutput: 64000,
      pricing: { input: 3, output: 15 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Grok 4 - Latest flagship with reasoning",
    },
    {
      id: "grok-4-fast",
      name: "Grok 4 Fast",
      provider: "xai",
      contextWindow: 2000000,
      maxOutput: 30000,
      pricing: { input: 0.2, output: 0.5 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Grok 4 Fast - 2M context, efficient reasoning",
    },
    {
      id: "grok-4.1-fast",
      name: "Grok 4.1 Fast",
      provider: "xai",
      contextWindow: 2000000,
      maxOutput: 30000,
      pricing: { input: 0.2, output: 0.5 },
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Grok 4.1 Fast - Latest with 2M context",
    },
    {
      id: "grok-3",
      name: "Grok 3",
      provider: "xai",
      contextWindow: 131072,
      maxOutput: 8192,
      pricing: { input: 3, output: 15 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Grok 3 model",
    },
    {
      id: "grok-3-mini",
      name: "Grok 3 Mini",
      provider: "xai",
      contextWindow: 131072,
      maxOutput: 8192,
      pricing: { input: 0.3, output: 0.5 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "Grok 3 Mini with reasoning",
    },
  ],

  // ==========================================================================
  // DeepSeek Models
  // ==========================================================================
  deepseek: [
    {
      id: "deepseek-chat",
      name: "DeepSeek Chat (V3.2)",
      provider: "deepseek",
      contextWindow: 128000,
      maxOutput: 8192,
      pricing: { input: 0.028, output: 0.42 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "DeepSeek V3.2 chat model (supports thinking mode)",
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek Reasoner (V3.2)",
      provider: "deepseek",
      contextWindow: 128000,
      maxOutput: 64000,
      pricing: { input: 0.028, output: 0.42 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "DeepSeek V3.2 thinking mode (reasoning enabled)",
    },
  ],

  // ==========================================================================
  // Mistral Models
  // ==========================================================================
  mistral: [
    {
      id: "mistral-large-latest",
      name: "Mistral Large",
      provider: "mistral",
      contextWindow: 128000,
      pricing: { input: 2, output: 6 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Most capable Mistral model",
    },
    {
      id: "mistral-medium-latest",
      name: "Mistral Medium",
      provider: "mistral",
      contextWindow: 32000,
      pricing: { input: 2.7, output: 8.1 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Balanced Mistral model",
    },
    {
      id: "codestral-latest",
      name: "Codestral",
      provider: "mistral",
      contextWindow: 32000,
      pricing: { input: 0.3, output: 0.9 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Mistral coding model",
    },
    {
      id: "mistral-small-latest",
      name: "Mistral Small",
      provider: "mistral",
      contextWindow: 32000,
      pricing: { input: 0.2, output: 0.6 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Fast and efficient Mistral",
    },
  ],

  // ==========================================================================
  // Groq Models
  // ==========================================================================
  groq: [
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B",
      provider: "groq",
      contextWindow: 128000,
      pricing: { input: 0.59, output: 0.79 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Latest Llama 3.3 on Groq",
    },
    {
      id: "llama-3.1-70b-versatile",
      name: "Llama 3.1 70B",
      provider: "groq",
      contextWindow: 128000,
      pricing: { input: 0.59, output: 0.79 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Llama 3.1 70B on Groq",
    },
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B",
      provider: "groq",
      contextWindow: 128000,
      pricing: { input: 0.05, output: 0.08 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Fast Llama 3.1 8B",
    },
    {
      id: "mixtral-8x7b-32768",
      name: "Mixtral 8x7B",
      provider: "groq",
      contextWindow: 32768,
      pricing: { input: 0.24, output: 0.24 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Mixtral on Groq",
    },
    {
      id: "gemma2-9b-it",
      name: "Gemma 2 9B",
      provider: "groq",
      contextWindow: 8192,
      pricing: { input: 0.2, output: 0.2 },
      capabilities: { streaming: true },
      description: "Google Gemma 2 on Groq",
    },
  ],

  // ==========================================================================
  // Together AI Models
  // ==========================================================================
  together: [
    {
      id: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
      name: "Llama 3.1 405B",
      provider: "together",
      contextWindow: 130000,
      pricing: { input: 3.5, output: 3.5 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Largest Llama 3.1 model",
    },
    {
      id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      name: "Llama 3.1 70B Turbo",
      provider: "together",
      contextWindow: 130000,
      pricing: { input: 0.88, output: 0.88 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Fast Llama 3.1 70B",
    },
    {
      id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      name: "Llama 3.1 8B Turbo",
      provider: "together",
      contextWindow: 130000,
      pricing: { input: 0.18, output: 0.18 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Efficient Llama 3.1 8B",
    },
    {
      id: "Qwen/Qwen2.5-72B-Instruct-Turbo",
      name: "Qwen 2.5 72B",
      provider: "together",
      contextWindow: 32768,
      pricing: { input: 1.2, output: 1.2 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Qwen 2.5 largest model",
    },
    {
      id: "deepseek-ai/DeepSeek-R1",
      name: "DeepSeek R1",
      provider: "together",
      contextWindow: 64000,
      pricing: { input: 3, output: 7 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "DeepSeek R1 on Together",
    },
  ],

  // ==========================================================================
  // Fireworks Models
  // ==========================================================================
  fireworks: [
    {
      id: "accounts/fireworks/models/llama-v3p1-405b-instruct",
      name: "Llama 3.1 405B",
      provider: "fireworks",
      contextWindow: 131072,
      pricing: { input: 3, output: 3 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Llama 3.1 405B on Fireworks",
    },
    {
      id: "accounts/fireworks/models/llama-v3p1-70b-instruct",
      name: "Llama 3.1 70B",
      provider: "fireworks",
      contextWindow: 131072,
      pricing: { input: 0.9, output: 0.9 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Llama 3.1 70B on Fireworks",
    },
    {
      id: "accounts/fireworks/models/deepseek-r1",
      name: "DeepSeek R1",
      provider: "fireworks",
      contextWindow: 131072,
      pricing: { input: 2, output: 8 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "DeepSeek R1 on Fireworks",
    },
    {
      id: "accounts/fireworks/models/qwen2p5-coder-32b-instruct",
      name: "Qwen 2.5 Coder 32B",
      provider: "fireworks",
      contextWindow: 32768,
      pricing: { input: 0.9, output: 0.9 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Qwen coding model on Fireworks",
    },
  ],

  // ==========================================================================
  // OpenRouter Models (aggregator - supports all models)
  // ==========================================================================
  openrouter: [
    {
      id: "openrouter/auto",
      name: "Auto (Best Available)",
      provider: "openrouter",
      contextWindow: 200000,
      capabilities: { functionCalling: true, streaming: true },
      description: "Automatically selects best model",
    },
    {
      id: "anthropic/claude-sonnet-4",
      name: "Claude Sonnet 4",
      provider: "openrouter",
      contextWindow: 200000,
      pricing: { input: 3, output: 15 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Claude Sonnet 4 via OpenRouter",
    },
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      provider: "openrouter",
      contextWindow: 128000,
      pricing: { input: 2.5, output: 10 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4o via OpenRouter",
    },
    {
      id: "google/gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      provider: "openrouter",
      contextWindow: 1000000,
      pricing: { input: 1.25, output: 5 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Gemini 2.5 Pro via OpenRouter",
    },
    {
      id: "deepseek/deepseek-r1",
      name: "DeepSeek R1",
      provider: "openrouter",
      contextWindow: 64000,
      pricing: { input: 0.55, output: 2.19 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "DeepSeek R1 via OpenRouter",
    },
  ],

  // ==========================================================================
  // Perplexity Models
  // ==========================================================================
  perplexity: [
    {
      id: "llama-3.1-sonar-huge-128k-online",
      name: "Sonar Huge (Online)",
      provider: "perplexity",
      contextWindow: 127072,
      pricing: { input: 5, output: 5 },
      capabilities: { streaming: true },
      description: "Largest Perplexity model with search",
    },
    {
      id: "llama-3.1-sonar-large-128k-online",
      name: "Sonar Large (Online)",
      provider: "perplexity",
      contextWindow: 127072,
      pricing: { input: 1, output: 1 },
      capabilities: { streaming: true },
      description: "Large Perplexity with search",
    },
    {
      id: "llama-3.1-sonar-small-128k-online",
      name: "Sonar Small (Online)",
      provider: "perplexity",
      contextWindow: 127072,
      pricing: { input: 0.2, output: 0.2 },
      capabilities: { streaming: true },
      description: "Fast Perplexity with search",
    },
  ],

  // ==========================================================================
  // Cohere Models
  // ==========================================================================
  cohere: [
    {
      id: "command-r-plus",
      name: "Command R+",
      provider: "cohere",
      contextWindow: 128000,
      pricing: { input: 2.5, output: 10 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Most capable Cohere model",
    },
    {
      id: "command-r",
      name: "Command R",
      provider: "cohere",
      contextWindow: 128000,
      pricing: { input: 0.15, output: 0.6 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Balanced Cohere model",
    },
    {
      id: "command-nightly",
      name: "Command Nightly",
      provider: "cohere",
      contextWindow: 128000,
      pricing: { input: 0.15, output: 0.6 },
      capabilities: { functionCalling: true, streaming: true },
      description: "Latest Cohere experimental",
    },
  ],

  // ==========================================================================
  // GitHub Copilot Models
  // Based on https://docs.github.com/en/copilot/reference/ai-models/supported-models
  // ==========================================================================
  copilot: [
    // Claude Models
    {
      id: "claude-haiku-4.5",
      name: "Claude Haiku 4.5 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description:
        "Fast, cost-effective Claude model via Copilot (0.33x multiplier)",
    },
    {
      id: "claude-sonnet-4",
      name: "Claude Sonnet 4 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Balanced Claude model via Copilot",
    },
    {
      id: "claude-sonnet-4.5",
      name: "Claude Sonnet 4.5 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest Claude Sonnet via Copilot",
    },
    {
      id: "claude-opus-4.1",
      name: "Claude Opus 4.1 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description:
        "Most capable Claude model via Copilot (10x multiplier, Pro+ required)",
    },
    {
      id: "claude-opus-4.5",
      name: "Claude Opus 4.5 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest Claude Opus via Copilot (3x multiplier)",
    },
    // GPT Models
    {
      id: "gpt-4.1",
      name: "GPT-4.1 (Copilot)",
      provider: "copilot",
      contextWindow: 128000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Free tier GPT model via Copilot (0x multiplier)",
    },
    {
      id: "gpt-5",
      name: "GPT-5 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest GPT-5 via Copilot",
    },
    {
      id: "gpt-5-mini",
      name: "GPT-5 Mini (Copilot)",
      provider: "copilot",
      contextWindow: 128000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Free tier GPT-5 Mini via Copilot (0x multiplier)",
    },
    {
      id: "gpt-5.1",
      name: "GPT-5.1 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "GPT-5.1 via Copilot",
    },
    {
      id: "gpt-5.2",
      name: "GPT-5.2 (Copilot)",
      provider: "copilot",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Latest GPT-5.2 via Copilot",
    },
    // Gemini Models
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro (Copilot)",
      provider: "copilot",
      contextWindow: 1000000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Google Gemini 2.5 Pro via Copilot",
    },
    {
      id: "gemini-3-flash",
      name: "Gemini 3 Flash (Copilot)",
      provider: "copilot",
      contextWindow: 1000000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description:
        "Fast Gemini 3 Flash via Copilot (0.33x multiplier, preview)",
    },
    {
      id: "gemini-3-pro",
      name: "Gemini 3 Pro (Copilot)",
      provider: "copilot",
      contextWindow: 1000000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Gemini 3 Pro via Copilot (preview)",
    },
    // Grok Models
    {
      id: "grok-code-fast-1",
      name: "Grok Code Fast 1 (Copilot)",
      provider: "copilot",
      contextWindow: 128000,
      capabilities: { functionCalling: true, streaming: true },
      description: "Fast xAI Grok for coding via Copilot (0.25x multiplier)",
    },
  ],

  // ==========================================================================
  // Ollama Local Models
  // ==========================================================================
  ollama: [
    {
      id: "llama3.2",
      name: "Llama 3.2",
      provider: "ollama",
      contextWindow: 128000,
      capabilities: { streaming: true },
      description: "Latest Llama 3.2 local",
    },
    {
      id: "llama3.1",
      name: "Llama 3.1",
      provider: "ollama",
      contextWindow: 128000,
      capabilities: { streaming: true },
      description: "Llama 3.1 local",
    },
    {
      id: "codellama",
      name: "Code Llama",
      provider: "ollama",
      contextWindow: 16000,
      capabilities: { streaming: true },
      description: "Code specialized Llama",
    },
    {
      id: "deepseek-coder-v2",
      name: "DeepSeek Coder V2",
      provider: "ollama",
      contextWindow: 128000,
      capabilities: { streaming: true },
      description: "DeepSeek Coder local",
    },
    {
      id: "qwen2.5-coder",
      name: "Qwen 2.5 Coder",
      provider: "ollama",
      contextWindow: 32768,
      capabilities: { streaming: true },
      description: "Qwen coding model local",
    },
    {
      id: "mistral",
      name: "Mistral",
      provider: "ollama",
      contextWindow: 32000,
      capabilities: { streaming: true },
      description: "Mistral 7B local",
    },
    {
      id: "phi3",
      name: "Phi-3",
      provider: "ollama",
      contextWindow: 128000,
      capabilities: { streaming: true },
      description: "Microsoft Phi-3 local",
    },
    {
      id: "gemma2",
      name: "Gemma 2",
      provider: "ollama",
      contextWindow: 8192,
      capabilities: { streaming: true },
      description: "Google Gemma 2 local",
    },
  ],

  // ==========================================================================
  // Vercel AI Gateway Models (access any model through unified API)
  // ==========================================================================
  vercel: [
    {
      id: "anthropic/claude-sonnet-4-20250514",
      name: "Claude Sonnet 4 (Vercel)",
      provider: "vercel",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Claude Sonnet 4 via Vercel AI Gateway",
    },
    {
      id: "anthropic/claude-opus-4-20250514",
      name: "Claude Opus 4 (Vercel)",
      provider: "vercel",
      contextWindow: 200000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Claude Opus 4 via Vercel AI Gateway",
    },
    {
      id: "openai/gpt-4o",
      name: "GPT-4o (Vercel)",
      provider: "vercel",
      contextWindow: 128000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4o via Vercel AI Gateway",
    },
    {
      id: "openai/o3-mini",
      name: "o3-mini (Vercel)",
      provider: "vercel",
      contextWindow: 200000,
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "o3-mini reasoning via Vercel AI Gateway",
    },
    {
      id: "google/gemini-2.5-pro",
      name: "Gemini 2.5 Pro (Vercel)",
      provider: "vercel",
      contextWindow: 1000000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Gemini 2.5 Pro via Vercel AI Gateway",
    },
    {
      id: "google/gemini-2.5-flash",
      name: "Gemini 2.5 Flash (Vercel)",
      provider: "vercel",
      contextWindow: 1000000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "Gemini 2.5 Flash via Vercel AI Gateway",
    },
    {
      id: "xai/grok-3",
      name: "Grok 3 (Vercel)",
      provider: "vercel",
      contextWindow: 131072,
      capabilities: { functionCalling: true, streaming: true },
      description: "Grok 3 via Vercel AI Gateway",
    },
    {
      id: "deepseek/deepseek-r1",
      name: "DeepSeek R1 (Vercel)",
      provider: "vercel",
      contextWindow: 64000,
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "DeepSeek R1 reasoning via Vercel AI Gateway",
    },
  ],

  // ==========================================================================
  // Azure OpenAI Models
  // ==========================================================================
  azure: [
    {
      id: "gpt-4o",
      name: "GPT-4o (Azure)",
      provider: "azure",
      contextWindow: 128000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4o deployed on Azure",
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo (Azure)",
      provider: "azure",
      contextWindow: 128000,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4 Turbo deployed on Azure",
    },
    {
      id: "o1",
      name: "o1 (Azure)",
      provider: "azure",
      contextWindow: 200000,
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "o1 reasoning deployed on Azure",
    },
  ],

  // ==========================================================================
  // Z.AI Models (Normal API)
  // ==========================================================================
  zai: [
    {
      id: "glm-4.7",
      name: "GLM-4.7",
      provider: "zai",
      contextWindow: 128000,
      maxOutput: 16384,
      pricing: { input: 0.7, output: 0.7 },
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "Latest GLM-4.7 flagship model",
    },
    {
      id: "glm-4.6v",
      name: "GLM-4.6V",
      provider: "zai",
      contextWindow: 128000,
      maxOutput: 4096,
      pricing: { input: 0.7, output: 0.7 },
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GLM-4.6V multimodal vision model",
    },
    {
      id: "glm-4-plus",
      name: "GLM-4 Plus",
      provider: "zai",
      contextWindow: 128000,
      maxOutput: 4096,
      pricing: { input: 0.7, output: 0.7 },
      capabilities: { functionCalling: true, streaming: true },
      description: "GLM-4 Plus via Z.AI",
    },
    {
      id: "glm-4-air",
      name: "GLM-4 Air",
      provider: "zai",
      contextWindow: 128000,
      maxOutput: 4096,
      pricing: { input: 0.14, output: 0.14 },
      capabilities: { functionCalling: true, streaming: true },
      description: "GLM-4 Air - fast and efficient",
    },
    {
      id: "glm-4-flash",
      name: "GLM-4 Flash",
      provider: "zai",
      contextWindow: 128000,
      maxOutput: 4096,
      pricing: { input: 0.007, output: 0.007 },
      capabilities: { functionCalling: true, streaming: true },
      description: "GLM-4 Flash - ultra-fast inference",
    },
    {
      id: "glm-4",
      name: "GLM-4",
      provider: "zai",
      contextWindow: 128000,
      maxOutput: 4096,
      pricing: { input: 0.5, output: 0.5 },
      capabilities: { functionCalling: true, streaming: true },
      description: "GLM-4 base model",
    },
    {
      id: "charglm-3",
      name: "CharGLM-3",
      provider: "zai",
      contextWindow: 8192,
      maxOutput: 2048,
      pricing: { input: 0.3, output: 0.3 },
      capabilities: { streaming: true },
      description: "CharGLM-3 for character role-playing",
    },
  ],

  // ==========================================================================
  // Z.AI Coding Plan Models (Premium Access)
  // ==========================================================================
  "zai-coding-plan": [
    {
      id: "glm-4.7",
      name: "GLM-4.7 (Z.AI Coding)",
      provider: "zai-coding-plan",
      contextWindow: 128000,
      maxOutput: 16384,
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "Latest GLM-4.7 via Z.AI Coding Plan",
    },
    {
      id: "glm-4.6v",
      name: "GLM-4.6V (Z.AI Coding)",
      provider: "zai-coding-plan",
      contextWindow: 128000,
      maxOutput: 4096,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GLM-4.6V vision model via Z.AI Coding Plan",
    },
    {
      id: "claude-sonnet-4",
      name: "Claude Sonnet 4 (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 200000,
      maxOutput: 64000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Claude Sonnet 4 via Z.AI Coding Plan",
    },
    {
      id: "claude-opus-4",
      name: "Claude Opus 4 (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 200000,
      maxOutput: 32000,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Claude Opus 4 via Z.AI Coding Plan",
    },
    {
      id: "gpt-4o",
      name: "GPT-4o (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 128000,
      maxOutput: 16384,
      capabilities: { vision: true, functionCalling: true, streaming: true },
      description: "GPT-4o via Z.AI Coding Plan",
    },
    {
      id: "o3-mini",
      name: "o3 Mini (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 200000,
      maxOutput: 100000,
      capabilities: { functionCalling: true, streaming: true, thinking: true },
      description: "o3 Mini reasoning via Z.AI Coding Plan",
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 1000000,
      maxOutput: 65536,
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        thinking: true,
      },
      description: "Gemini 2.5 Pro via Z.AI Coding Plan",
    },
    {
      id: "grok-3",
      name: "Grok 3 (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 131072,
      maxOutput: 8192,
      capabilities: { functionCalling: true, streaming: true },
      description: "Grok 3 via Z.AI Coding Plan",
    },
    {
      id: "glm-4-plus",
      name: "GLM-4 Plus (Z.AI)",
      provider: "zai-coding-plan",
      contextWindow: 128000,
      maxOutput: 4096,
      capabilities: { functionCalling: true, streaming: true },
      description: "GLM-4 Plus via Z.AI Coding Plan",
    },
  ],
};

// ============================================================================
// Dynamic Models API Import
// ============================================================================

import {
  getDynamicModelsForProvider as fetchDynamicModels,
  fetchModelsDevData,
  convertToModelInfo,
  type ModelsDevModel,
} from "./models-api.js";

// In-memory cache for dynamic models
const dynamicModelsCache: Map<string, ModelInfo[]> = new Map();
let dynamicModelsCacheTimestamp = 0;
const DYNAMIC_CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutes

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all models for a provider (static fallback - sync)
 * @deprecated Use getModelsForProviderAsync for up-to-date models
 */
export function getModelsForProvider(provider: string): ModelInfo[] {
  // First check the dynamic cache
  if (
    dynamicModelsCache.has(provider) &&
    Date.now() - dynamicModelsCacheTimestamp < DYNAMIC_CACHE_DURATION_MS
  ) {
    return dynamicModelsCache.get(provider)!;
  }
  // Fallback to static models
  return MODELS[provider] ?? [];
}

/**
 * Get all models for a provider - ASYNC with dynamic fetching
 * This is the preferred method - fetches from models.dev API with static fallback
 */
export async function getModelsForProviderAsync(
  provider: string,
): Promise<ModelInfo[]> {
  try {
    const dynamicModels = await fetchDynamicModels(provider);
    if (dynamicModels.length > 0) {
      // Cache for sync access
      dynamicModelsCache.set(provider, dynamicModels);
      dynamicModelsCacheTimestamp = Date.now();
      return dynamicModels;
    }
  } catch {
    // Silently fall through to static models
  }
  return MODELS[provider] ?? [];
}

/**
 * Get model IDs for a provider - ASYNC with dynamic fetching
 * This is the preferred method for getting model lists
 */
export async function getModelIdsAsync(provider: string): Promise<string[]> {
  const models = await getModelsForProviderAsync(provider);
  return models.map((m) => m.id);
}

/**
 * Get a specific model by ID - ASYNC with dynamic fetching
 */
export async function getModelAsync(
  provider: string,
  modelId: string,
): Promise<ModelInfo | undefined> {
  const models = await getModelsForProviderAsync(provider);
  return models.find((m) => m.id === modelId);
}

/**
 * Preload dynamic models for all providers
 * Call this at app startup to warm the cache
 */
export async function preloadDynamicModels(): Promise<void> {
  try {
    const data = await fetchModelsDevData();
    for (const [providerId, providerData] of Object.entries(data)) {
      const models = Object.values(
        providerData.models as Record<string, ModelsDevModel>,
      ).map((m) => convertToModelInfo(m, providerId));
      if (models.length > 0) {
        dynamicModelsCache.set(providerId, models);
      }
    }
    dynamicModelsCacheTimestamp = Date.now();
  } catch {
    // Silently fail - static models will be used
  }
}

/**
 * Check if dynamic models are cached
 */
export function hasDynamicModelsCache(): boolean {
  return (
    dynamicModelsCache.size > 0 &&
    Date.now() - dynamicModelsCacheTimestamp < DYNAMIC_CACHE_DURATION_MS
  );
}

/**
 * Clear dynamic models cache
 */
export function clearDynamicModelsCache(): void {
  dynamicModelsCache.clear();
  dynamicModelsCacheTimestamp = 0;
}

/**
 * Get model IDs for a provider (for selection UI)
 */
export function getModelIds(provider: string): string[] {
  return getModelsForProvider(provider).map((m) => m.id);
}

/**
 * Get a specific model by ID
 */
export function getModel(
  provider: string,
  modelId: string,
): ModelInfo | undefined {
  return getModelsForProvider(provider).find((m) => m.id === modelId);
}

/**
 * Get provider info
 */
export function getProvider(providerId: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: string): string {
  const models = getModelsForProvider(provider);
  return models[0]?.id ?? "gpt-4o";
}

/**
 * Get all provider IDs
 */
export function getProviderIds(): string[] {
  return PROVIDERS.map((p) => p.id as string);
}

/**
 * Check if a model supports a capability (sync - uses cache or static)
 */
export function modelSupports(
  provider: string,
  modelId: string,
  capability: keyof NonNullable<ModelInfo["capabilities"]>,
): boolean {
  const model = getModel(provider, modelId);
  return model?.capabilities?.[capability] ?? false;
}

/**
 * Check if a model supports a capability - ASYNC with dynamic fetching
 */
export async function modelSupportsAsync(
  provider: string,
  modelId: string,
  capability: keyof NonNullable<ModelInfo["capabilities"]>,
): Promise<boolean> {
  const model = await getModelAsync(provider, modelId);
  return model?.capabilities?.[capability] ?? false;
}

/**
 * Get default model for a provider - ASYNC with dynamic fetching
 */
export async function getDefaultModelAsync(provider: string): Promise<string> {
  const models = await getModelsForProviderAsync(provider);
  return models[0]?.id ?? "gpt-4o";
}

/**
 * Get recommended models for coding
 */
export function getRecommendedCodingModels(): ModelInfo[] {
  return [
    MODELS.anthropic?.find((m) => m.id === "claude-sonnet-4-20250514"),
    MODELS.openai?.find((m) => m.id === "gpt-4o"),
    MODELS.google?.find((m) => m.id === "gemini-2.5-pro"),
    MODELS.deepseek?.find((m) => m.id === "deepseek-coder"),
    MODELS.mistral?.find((m) => m.id === "codestral-latest"),
  ].filter(Boolean) as ModelInfo[];
}

// Export for backward compatibility (static models)
export const DEFAULT_MODELS: Record<string, string> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, getDefaultModel(p.id as string)]),
);

// Static model choices - for backward compatibility
// Use getModelIdsAsync() for up-to-date models from models.dev
export const MODEL_CHOICES: Record<string, string[]> = Object.fromEntries(
  Object.entries(MODELS).map(([provider, models]) => [
    provider,
    models.map((m) => m.id),
  ]),
);

export const PROVIDER_CHOICES: string[] = getProviderIds();

/**
 * Get model choices for a provider - ASYNC with dynamic fetching
 * This is the preferred method - returns fresh models from models.dev
 */
export async function getModelChoicesAsync(
  provider: string,
): Promise<string[]> {
  return getModelIdsAsync(provider);
}

/**
 * Get all model choices for all providers - ASYNC with dynamic fetching
 */
export async function getAllModelChoicesAsync(): Promise<
  Record<string, string[]>
> {
  try {
    await preloadDynamicModels();
    const result: Record<string, string[]> = {};
    for (const provider of PROVIDERS) {
      const models = await getModelsForProviderAsync(provider.id as string);
      result[provider.id as string] = models.map((m) => m.id);
    }
    return result;
  } catch {
    return MODEL_CHOICES;
  }
}
