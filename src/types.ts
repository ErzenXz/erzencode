/**
 * Shared Types for erzencode
 * Common type definitions used across the codebase
 */

// ============================================================================
// Agent Types
// ============================================================================

export type AgentMode = "agent" | "ask" | "plan";

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamEvent {
  type:
    | "text-delta"
    | "reasoning"
    | "tool-call"
    | "tool-result"
    | "error"
    | "finish"
    | "step-start"
    | "step-finish"
    | "step-usage"
    | "rate-limit-wait";
  data: unknown;
}

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "mistral"
  | "groq"
  | "together"
  | "fireworks"
  | "deepseek"
  | "openrouter"
  | "perplexity"
  | "cohere"
  | "copilot"
  | "vercel"
  | "azure"
  | "ollama"
  | "zai"
  | "zai-coding-plan"
  | "custom";

export interface ThinkingConfig {
  type: "enabled" | "disabled";
  budgetTokens?: number;
}

// ============================================================================
// Model Types
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
// Configuration Types
// ============================================================================

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface ErzencodeConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  theme?: "dark" | "light" | "auto";
  renderer?: "raw" | "markdown";
  thinkingLevel?: ThinkingLevel;
  mode?: AgentMode;
  compactMode?: boolean;
  autoSave?: boolean;
  maxHistorySize?: number;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
}

export interface FileInfo {
  path: string;
  action: "read" | "write" | "edit";
  timestamp: number;
}

// ============================================================================
// Compaction Types
// ============================================================================

export interface CompactionConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface CompactionResult {
  success: boolean;
  summary: string;
  originalMessageCount: number;
  tokensSaved?: number;
  error?: string;
}
