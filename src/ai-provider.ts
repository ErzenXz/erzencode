/**
 * AI Provider Layer using Vercel AI SDK v6 directly
 * Supports multiple providers: OpenAI, Anthropic, Google, xAI, Groq, DeepSeek, Mistral, OpenRouter, etc.
 */

import { streamText, generateText, type LanguageModel } from "ai";
import {
  withMiddleware,
  createAIMiddleware,
  type MiddlewareConfig,
  type RetryConfig,
  type CacheConfig,
  AIRateLimitError,
  AIServerError,
  AIAuthenticationError,
  clearCache,
} from "./ai-middleware.js";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic";
import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProvider,
} from "@ai-sdk/google";
import { createXai, type XaiProvider } from "@ai-sdk/xai";
import { createMistral, type MistralProvider } from "@ai-sdk/mistral";
import { getApiKey, getBaseUrl } from "./config.js";

// ============================================================================
// Types
// ============================================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "groq"
  | "deepseek"
  | "mistral"
  | "openrouter"
  | "together"
  | "fireworks"
  | "perplexity"
  | "ollama"
  | "copilot"
  | "vercel"
  | "azure"
  | "zai"
  | "zai-coding-plan";

export interface AIProviderConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ThinkingConfig {
  enabled: boolean;
  budgetTokens?: number;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamOptions {
  system?: string;
  messages: Message[];
  tools?: Record<string, any>;
  maxTokens?: number;
  temperature?: number;
  thinking?: ThinkingConfig;
  onError?: (error: Error) => void;
  maxRetries?: number;
  cache?: boolean | Partial<CacheConfig>;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface StreamEvent {
  type:
    | "text-delta"
    | "reasoning"
    | "tool-call"
    | "tool-result"
    | "error"
    | "finish";
  data: any;
}

// ============================================================================
// Provider Factory
// ============================================================================

type ProviderInstance =
  | OpenAIProvider
  | AnthropicProvider
  | GoogleGenerativeAIProvider
  | XaiProvider
  | MistralProvider;

const providerCache = new Map<string, ProviderInstance>();

function getProviderCacheKey(config: AIProviderConfig): string {
  return `${config.provider}:${config.apiKey || "env"}:${config.baseUrl || "default"}`;
}

/**
 * Clear the provider cache for a specific provider or all providers
 * Call this when switching providers or when API keys change
 */
export function clearProviderCache(provider?: ProviderType): void {
  if (provider) {
    // Clear entries for specific provider
    for (const [key] of providerCache) {
      if (key.startsWith(`${provider}:`)) {
        providerCache.delete(key);
      }
    }
  } else {
    // Clear all
    providerCache.clear();
  }
}

export function createProvider(config: AIProviderConfig): LanguageModel {
  const { provider, model, apiKey, baseUrl } = config;
  const resolvedApiKey = apiKey || getApiKey(provider);
  const resolvedBaseUrl = baseUrl || getBaseUrl(provider);
  const cacheKey = getProviderCacheKey(config);

  // Check cache first
  let providerInstance = providerCache.get(cacheKey);

  if (!providerInstance) {
    switch (provider) {
      case "openai":
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl,
        });
        break;

      case "anthropic":
        providerInstance = createAnthropic({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl,
        });
        break;

      case "google":
        providerInstance = createGoogleGenerativeAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl,
        });
        break;

      case "xai":
        providerInstance = createXai({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl,
        });
        break;

      case "mistral":
        providerInstance = createMistral({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl,
        });
        break;

      case "groq":
        // Groq uses OpenAI-compatible API
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.groq.com/openai/v1",
        });
        break;

      case "deepseek":
        // DeepSeek uses OpenAI-compatible API
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.deepseek.com/v1",
        });
        break;

      case "openrouter":
        // OpenRouter uses OpenAI-compatible API
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://openrouter.ai/api/v1",
        });
        break;

      case "together":
        // Together uses OpenAI-compatible API
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.together.xyz/v1",
        });
        break;

      case "fireworks":
        // Fireworks uses OpenAI-compatible API
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.fireworks.ai/inference/v1",
        });
        break;

      case "perplexity":
        // Perplexity uses OpenAI-compatible API
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.perplexity.ai",
        });
        break;

      case "ollama":
        // Ollama uses OpenAI-compatible API locally
        providerInstance = createOpenAI({
          apiKey: "ollama", // Ollama doesn't need a real key
          baseURL: resolvedBaseUrl || "http://localhost:11434/v1",
        });
        break;

      case "copilot":
        // GitHub Copilot uses OpenAI-compatible API with specific headers
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.githubcopilot.com",
          headers: {
            "Copilot-Integration-Id": "vscode-chat",
            "Editor-Version": "vscode/1.95.0",
            "Editor-Plugin-Version": "copilot-chat/0.24.0",
            "X-Request-Id": crypto.randomUUID(),
          },
        });
        break;

      case "vercel":
        // Vercel AI Gateway - unified API for multiple providers
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://ai-gateway.vercel.sh/v1",
        });
        break;

      case "azure":
        // Azure OpenAI uses OpenAI-compatible API with custom endpoint
        providerInstance = createOpenAI({
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl,
        });
        break;

      case "zai":
        // z.ai Normal API - OpenAI-compatible (includes reasoning_content)
        providerInstance = createOpenAICompatible({
          name: "zai",
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.z.ai/api/paas/v4",
        }) as any;
        break;

      case "zai-coding-plan":
        // z.ai Coding Plans - OpenAI-compatible API for coding workflows (includes reasoning_content)
        providerInstance = createOpenAICompatible({
          name: "zai-coding-plan",
          apiKey: resolvedApiKey,
          baseURL: resolvedBaseUrl || "https://api.z.ai/api/coding/paas/v4",
        }) as any;
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!providerInstance) {
      throw new Error(`Failed to initialize provider: ${provider}`);
    }

    providerCache.set(cacheKey, providerInstance);
  }

  // Providers that don't support the Responses API need to use .chat() explicitly
  // The Responses API (/responses endpoint) is only supported by OpenAI itself
  // All other OpenAI-compatible providers use the Chat Completions API (/chat/completions)
  const chatOnlyProviders = new Set<ProviderType>([
    "groq",
    "deepseek",
    "openrouter",
    "together",
    "fireworks",
    "perplexity",
    "ollama",
    "copilot",
    "zai",
    "zai-coding-plan",
  ]);

  // Use .chat() for providers that only support chat completions API
  if (chatOnlyProviders.has(provider)) {
    const instanceAny = providerInstance as any;
    if (typeof instanceAny.chat === "function") {
      return instanceAny.chat(model);
    }

    // Some providers (e.g. @ai-sdk/openai-compatible) don't expose .chat(); they
    // already represent a chat-completions-compatible provider function.
    return instanceAny(model);
  }

  // For OpenAI, Anthropic, Google, xAI, Mistral, Vercel, Azure - use default (responses API where available)
  return (providerInstance as any)(model);
}

// ============================================================================
// Provider Options for Thinking/Reasoning
// ============================================================================

export function getProviderOptions(
  provider: ProviderType,
  model: string,
  thinking?: ThinkingConfig,
): Record<string, any> | undefined {
  if (!thinking?.enabled) return undefined;

  // z.ai exposes reasoning via `reasoning_content` without requiring a
  // provider-specific "thinking" request parameter.
  if (provider === "zai" || provider === "zai-coding-plan") {
    return undefined;
  }

  const budgetTokens = thinking.budgetTokens || 8000;

  // Anthropic thinking (Claude 3.7+, Claude 4+)
  if (provider === "anthropic") {
    const thinkingModels = [
      "claude-3-7-sonnet",
      "claude-sonnet-4",
      "claude-opus-4",
      "claude-haiku-4",
    ];
    if (thinkingModels.some((m) => model.includes(m))) {
      return {
        anthropic: {
          thinking: { type: "enabled", budgetTokens },
        },
      };
    }
  }

  // OpenAI reasoning (o1, o3, o4, gpt-5)
  if (provider === "openai") {
    const reasoningModels = ["o1", "o3", "o4", "gpt-5"];
    if (reasoningModels.some((m) => model.includes(m))) {
      return {
        openai: {
          reasoningEffort:
            budgetTokens >= 8000
              ? "high"
              : budgetTokens >= 4000
                ? "medium"
                : "low",
        },
      };
    }
  }

  // xAI reasoning (grok-3-mini, grok-4)
  if (provider === "xai") {
    const reasoningModels = ["grok-3-mini", "grok-4"];
    if (reasoningModels.some((m) => model.includes(m))) {
      return {
        xai: {
          reasoningEffort: budgetTokens >= 8000 ? "high" : "low",
        },
      };
    }
  }

  // Google thinking (Gemini 2.5+, Gemini 3+)
  if (provider === "google") {
    const thinkingModels = ["gemini-2.5", "gemini-3"];
    if (thinkingModels.some((m) => model.includes(m))) {
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: budgetTokens,
          },
        },
      };
    }
  }

  // DeepSeek reasoning (deepseek-reasoner, deepseek-r1, deepseek-chat with thinking)
  // DeepSeek V3.2 supports thinking mode via the 'thinking' parameter
  if (provider === "deepseek") {
    const reasoningModels = ["deepseek-reasoner", "deepseek-r1"];
    if (reasoningModels.some((m) => model.includes(m))) {
      // For reasoning models, the model itself enables thinking
      return {
        deepseek: {
          reasoningFormat: "parsed",
        },
      };
    }
    // For deepseek-chat, enable thinking mode explicitly
    if (model.includes("deepseek-chat")) {
      return {
        thinking: { type: "enabled" },
      };
    }
  }

  // Groq with DeepSeek R1
  if (provider === "groq") {
    if (model.includes("deepseek-r1")) {
      return {
        deepseek: {
          reasoningFormat: "parsed",
        },
      };
    }
  }

  // Together with DeepSeek R1
  if (provider === "together") {
    if (model.includes("deepseek-r1")) {
      return {
        deepseek: {
          reasoningFormat: "parsed",
        },
      };
    }
  }

  // Fireworks with DeepSeek R1
  if (provider === "fireworks") {
    if (model.includes("deepseek-r1")) {
      return {
        deepseek: {
          reasoningFormat: "parsed",
        },
      };
    }
  }

  // OpenRouter - pass through to underlying provider based on model
  if (provider === "openrouter") {
    if (model.includes("claude")) {
      return {
        anthropic: {
          thinking: { type: "enabled", budgetTokens },
        },
      };
    }
    if (model.includes("o1") || model.includes("o3")) {
      return {
        openai: {
          reasoningEffort:
            budgetTokens >= 8000
              ? "high"
              : budgetTokens >= 4000
                ? "medium"
                : "low",
        },
      };
    }
    if (model.includes("deepseek-r1")) {
      return {
        deepseek: {
          reasoningFormat: "parsed",
        },
      };
    }
  }

  // Vercel AI Gateway - pass through based on model prefix
  if (provider === "vercel") {
    if (model.includes("claude") || model.startsWith("anthropic/")) {
      return {
        anthropic: {
          thinking: { type: "enabled", budgetTokens },
        },
      };
    }
    if (
      model.includes("o1") ||
      model.includes("o3") ||
      model.startsWith("openai/")
    ) {
      return {
        openai: {
          reasoningEffort:
            budgetTokens >= 8000
              ? "high"
              : budgetTokens >= 4000
                ? "medium"
                : "low",
        },
      };
    }
    if (model.includes("gemini-2.5") || model.startsWith("google/")) {
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: budgetTokens,
          },
        },
      };
    }
  }

  // Azure OpenAI - same as OpenAI
  if (provider === "azure") {
    const reasoningModels = ["o1", "o3"];
    if (reasoningModels.some((m) => model.includes(m))) {
      return {
        openai: {
          reasoningEffort:
            budgetTokens >= 8000
              ? "high"
              : budgetTokens >= 4000
                ? "medium"
                : "low",
        },
      };
    }
  }

  // Copilot - handle different model families
  // Claude models use Anthropic thinking, GPT-5 models use OpenAI reasoning
  if (provider === "copilot") {
    // Claude models (sonnet-4, opus)
    if (model.includes("claude-sonnet-4") || model.includes("claude-opus")) {
      return {
        anthropic: {
          thinking: { type: "enabled", budgetTokens },
        },
      };
    }
    // GPT-5 reasoning models
    if (model.includes("gpt-5") && !model.includes("mini")) {
      return {
        openai: {
          reasoningEffort:
            budgetTokens >= 8000
              ? "high"
              : budgetTokens >= 4000
                ? "medium"
                : "low",
        },
      };
    }
    // Gemini models
    if (model.includes("gemini-2.5") || model.includes("gemini-3-pro")) {
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: budgetTokens,
          },
        },
      };
    }
  }

  // Z.AI GLM models - use thinking parameter like DeepSeek
  // NOTE: z.ai provider options are intentionally not handled here because
  // z.ai returns reasoning via `reasoning_content` without needing a request flag.

  return undefined;
}

// ============================================================================
// Check if Model Supports Thinking
// ============================================================================

export function modelSupportsThinking(
  provider: ProviderType,
  model: string,
): boolean {
  const thinkingModels: Record<ProviderType, string[]> = {
    anthropic: [
      "claude-3-7",
      "claude-sonnet-4",
      "claude-opus-4",
      "claude-haiku-4",
    ],
    openai: ["o1", "o3", "o4", "gpt-5"],
    google: ["gemini-2.5", "gemini-3"],
    xai: ["grok-3-mini", "grok-4"],
    deepseek: ["deepseek-reasoner", "deepseek-r1", "deepseek-chat"],
    groq: [],
    mistral: [],
    openrouter: ["claude", "o1", "o3", "deepseek-r1", "gemini-2.5"],
    together: ["deepseek-r1"],
    fireworks: ["deepseek-r1"],
    perplexity: [],
    ollama: [],
    copilot: [
      "claude-sonnet-4",
      "claude-opus",
      "gpt-5",
      "gemini-2.5",
      "gemini-3-pro",
    ],
    vercel: ["claude", "o1", "o3", "gemini-2.5"],
    azure: ["o1", "o3"],
    zai: ["glm-4.7"],
    "zai-coding-plan": [
      "claude",
      "o1",
      "o3",
      "o4",
      "gemini-2.5",
      "gemini-3",
      "glm-4.7",
    ],
  };

  const models = thinkingModels[provider] || [];
  return models.some((m) => model.toLowerCase().includes(m.toLowerCase()));
}

function modelSupportsTemperature(provider: ProviderType, model: string): boolean {
  // OpenAI "reasoning" / Responses models often don't support temperature (AI SDK warns loudly).
  if (provider === "openai") {
    const m = model.toLowerCase();
    if (m.includes("gpt-5") || m.includes("o1") || m.includes("o3") || m.includes("o4")) return false;
  }
  return true;
}

// ============================================================================
// Stream Text with Full Error Handling
// ============================================================================

export async function* streamAI(
  config: AIProviderConfig,
  options: StreamOptions,
): AsyncGenerator<StreamEvent> {
  const { provider, model } = config;
  const {
    system,
    messages,
    tools,
    maxTokens,
    temperature,
    thinking,
    onError,
    maxRetries,
    cache,
    onRetry,
  } = options;

  try {
    const baseModel = createProvider(config);
    const providerOptions = getProviderOptions(provider, model, thinking);

    // Apply middleware for retry and caching
    const languageModel = withMiddleware(baseModel, {
      retry: { maxRetries: maxRetries ?? 3 },
      cache:
        cache === false
          ? { enabled: false }
          : typeof cache === "object"
            ? cache
            : undefined,
      onRetry,
    });

    const result = streamText({
      model: languageModel,
      system,
      messages: messages as any,
      tools,
      ...(modelSupportsTemperature(provider, model) ? { temperature: temperature ?? 0.7 } : {}),
      maxRetries: maxRetries ?? 3,
      providerOptions,
      onError: onError
        ? (event) =>
            onError(
              event.error instanceof Error
                ? event.error
                : new Error(String(event.error)),
            )
        : undefined,
    });

    // Stream through fullStream for complete event handling
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta":
          yield { type: "text-delta", data: { text: part.text } };
          break;

        case "reasoning-delta":
          yield { type: "reasoning", data: { text: (part as any).text } };
          break;

        case "tool-call":
          yield {
            type: "tool-call",
            data: {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: (part as any).input,
            },
          };
          break;

        case "tool-result":
          yield {
            type: "tool-result",
            data: {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: (part as any).output,
            },
          };
          break;

        case "error":
          const errorMessage =
            part.error instanceof Error
              ? part.error.message
              : String(part.error);
          yield {
            type: "error",
            data: { error: errorMessage, fullError: part.error },
          };
          if (onError && part.error instanceof Error) {
            onError(part.error);
          }
          break;

        case "finish":
          yield {
            type: "finish",
            data: {
              usage: part.totalUsage,
              finishReason: part.finishReason,
            },
          };
          break;
      }
    }
  } catch (error: any) {
    // Capture and yield the full error with details
    const errorDetails = {
      message: error.message || String(error),
      name: error.name,
      code: error.code,
      status: error.status,
      statusCode: error.statusCode,
      cause: error.cause?.message || error.cause,
      stack: error.stack,
      response: error.response?.data || error.response?.statusText,
      body: error.body,
    };

    yield {
      type: "error",
      data: {
        error: formatErrorMessage(error),
        fullError: error,
        details: errorDetails,
      },
    };

    if (onError) {
      onError(error);
    }
  }
}

// ============================================================================
// Generate Text (Non-streaming)
// ============================================================================

export async function generateAI(
  config: AIProviderConfig,
  options: Omit<StreamOptions, "onError">,
): Promise<{
  text: string;
  reasoning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}> {
  const { provider, model } = config;
  const {
    system,
    messages,
    tools,
    maxTokens,
    temperature,
    thinking,
    maxRetries,
    cache,
    onRetry,
  } = options;

  try {
    const baseModel = createProvider(config);
    const providerOptions = getProviderOptions(provider, model, thinking);

    // Apply middleware for retry and caching
    const languageModel = withMiddleware(baseModel, {
      retry: { maxRetries: maxRetries ?? 3 },
      cache:
        cache === false
          ? { enabled: false }
          : typeof cache === "object"
            ? cache
            : undefined,
      onRetry,
    });

    const result = await generateText({
      model: languageModel,
      system,
      messages: messages as any,
      tools,
      ...(modelSupportsTemperature(provider, model) ? { temperature: temperature ?? 0.7 } : {}),
      maxRetries: maxRetries ?? 3,
      providerOptions,
    });

    // Extract reasoning text from reasoning array if present
    const reasoningText = Array.isArray(result.reasoning)
      ? result.reasoning.map((r: any) => r.text || r).join("\n")
      : typeof result.reasoning === "string"
        ? result.reasoning
        : undefined;

    return {
      text: result.text,
      reasoning: reasoningText,
      usage: result.usage
        ? {
            promptTokens: (result.usage as any).promptTokens ?? 0,
            completionTokens: (result.usage as any).completionTokens ?? 0,
            totalTokens: (result.usage as any).totalTokens ?? 0,
          }
        : undefined,
    };
  } catch (error: any) {
    return {
      text: "",
      error: formatErrorMessage(error),
    };
  }
}

// ============================================================================
// Error Formatting
// ============================================================================

function formatErrorMessage(error: any): string {
  if (!error) return "Unknown error";

  // API error with status code
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    const message = error.message || error.statusText || "API Error";

    // Common API errors
    if (status === 401) {
      return `Authentication failed (401): Invalid or missing API key. ${message}`;
    }
    if (status === 403) {
      return `Access denied (403): You don't have permission to use this model. ${message}`;
    }
    if (status === 404) {
      return `Model not found (404): The model doesn't exist or isn't available. ${message}`;
    }
    if (status === 429) {
      return `Rate limited (429): Too many requests. Please wait and try again. ${message}`;
    }
    if (status === 500) {
      return `Server error (500): The AI provider is experiencing issues. ${message}`;
    }
    if (status === 503) {
      return `Service unavailable (503): The AI provider is temporarily down. ${message}`;
    }

    return `API Error (${status}): ${message}`;
  }

  // Network errors
  if (error.code === "ECONNREFUSED") {
    return `Connection refused: Cannot connect to the AI provider. Check your network or if using Ollama, ensure it's running.`;
  }
  if (error.code === "ENOTFOUND") {
    return `DNS error: Cannot resolve the AI provider's address. Check your network connection.`;
  }
  if (error.code === "ETIMEDOUT") {
    return `Connection timeout: The request took too long. Try again or check your network.`;
  }

  // Parse error body if available
  if (error.body) {
    try {
      const body =
        typeof error.body === "string" ? JSON.parse(error.body) : error.body;
      if (body.error?.message) {
        return `${body.error.message}`;
      }
      if (body.message) {
        return body.message;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Response data
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }

  // Default to message
  return error.message || String(error);
}

// ============================================================================
// Validate Provider Configuration
// ============================================================================

export function validateProviderConfig(config: AIProviderConfig): {
  valid: boolean;
  error?: string;
} {
  const { provider, model, apiKey } = config;
  const resolvedApiKey = apiKey || getApiKey(provider);

  // Ollama doesn't need an API key
  if (provider === "ollama") {
    return { valid: true };
  }

  if (!resolvedApiKey) {
    const envVars: Record<ProviderType, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      xai: "XAI_API_KEY",
      groq: "GROQ_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      mistral: "MISTRAL_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      together: "TOGETHER_API_KEY",
      fireworks: "FIREWORKS_API_KEY",
      perplexity: "PERPLEXITY_API_KEY",
      ollama: "OLLAMA_HOST",
      copilot: "GITHUB_COPILOT_TOKEN",
      vercel: "VERCEL_AI_GATEWAY_API_KEY",
      azure: "AZURE_OPENAI_API_KEY",
      zai: "ZAI_API_KEY",
      "zai-coding-plan": "ZAI_API_KEY",
    };

    return {
      valid: false,
      error: `Missing API key for ${provider}. Set ${envVars[provider]} environment variable.`,
    };
  }

  if (!model) {
    return {
      valid: false,
      error: `No model specified for ${provider}.`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Convert Messages
// ============================================================================

export function toAIMessages(
  messages: Array<{ role: string; content: string }>,
): Message[] {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
  }));
}

// ============================================================================
// Re-export Middleware Utilities
// ============================================================================

export {
  withMiddleware,
  createAIMiddleware,
  clearCache,
  AIRateLimitError,
  AIServerError,
  AIAuthenticationError,
} from "./ai-middleware.js";

export type {
  MiddlewareConfig,
  RetryConfig,
  CacheConfig,
} from "./ai-middleware.js";
