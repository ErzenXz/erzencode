/**
 * AI Agent using Vercel AI SDK v6 directly
 * Clean implementation with proper types
 */

import { ToolLoopAgent, stepCountIs, type Tool } from "ai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import {
  createProvider,
  type ProviderType,
  type ThinkingConfig,
  modelSupportsThinking as checkModelThinking,
  validateProviderConfig,
  getProviderOptions,
} from "./ai-provider.js";
import { withResumableMiddleware } from "./ai-middleware.js";
import {
  getAllTools,
  setWorkspaceRoot,
  setSubagentTool,
  setSubagentExecutor,
  isSemanticSearchAvailable,
} from "./tools/tools-standalone.js";
import { hasIndex, getIndexStats } from "./indexer/index.js";
import { subagentToolDefinition } from "./subagents.js";
import {
  SYSTEM_PROMPT,
  ASK_MODE_PROMPT,
  PLAN_MODE_PROMPT,
  MEMORY_FILE_NAMES,
  SUBAGENT_PROMPTS,
} from "./prompts.js";

// ============================================================================
// Types
// ============================================================================

export type AgentMode = "agent" | "ask" | "plan";

export interface AgentConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  mode?: AgentMode;
  workspaceRoot?: string;
  thinking?: ThinkingConfig;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  /**
   * Message content can be plain text or multimodal parts (e.g. vision).
   * We intentionally keep this broad because the Vercel AI SDK supports
   * structured content arrays for images.
   */
  content: unknown;
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
  data: any;
}

// Rate limit retry configuration
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_DEFAULT_WAIT_MS = 60000; // 1 minute default

// ============================================================================
// Environment Context Builder
// ============================================================================

interface EnvironmentContext {
  workingDirectory: string;
  isGitRepo: boolean;
  gitBranch?: string;
  platform: string;
  timestamp: string;
  homeDirectory: string;
  shell: string;
  nodeVersion: string;
  // Semantic search index status
  hasSemanticIndex: boolean;
  indexedChunks?: number;
  indexedFiles?: number;
}

async function getEnvironmentContextAsync(workspaceRoot: string): Promise<EnvironmentContext> {
  const ctx: EnvironmentContext = {
    workingDirectory: workspaceRoot,
    isGitRepo: false,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    homeDirectory: os.homedir(),
    shell: process.env.SHELL || "unknown",
    nodeVersion: process.version,
    hasSemanticIndex: false,
  };

  // Check if git repo
  try {
    const gitDir = path.join(workspaceRoot, ".git");
    if (fs.existsSync(gitDir)) {
      ctx.isGitRepo = true;
      // Get current branch
      try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: workspaceRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        ctx.gitBranch = branch;
      } catch {
        // Ignore git errors
      }
    }
  } catch {
    // Not a git repo
  }

  // Check if codebase is indexed for semantic search
  try {
    const indexed = await hasIndex(workspaceRoot);
    if (indexed) {
      const stats = await getIndexStats(workspaceRoot);
      ctx.hasSemanticIndex = stats.exists && stats.totalChunks > 0;
      if (ctx.hasSemanticIndex) {
        ctx.indexedChunks = stats.totalChunks;
        ctx.indexedFiles = stats.totalFiles;
      }
    }
  } catch {
    // Ignore index check errors
  }

  return ctx;
}

// Sync version for backwards compatibility (no index check)
function getEnvironmentContext(workspaceRoot: string): EnvironmentContext {
  const ctx: EnvironmentContext = {
    workingDirectory: workspaceRoot,
    isGitRepo: false,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    homeDirectory: os.homedir(),
    shell: process.env.SHELL || "unknown",
    nodeVersion: process.version,
    hasSemanticIndex: false,
  };

  // Check if git repo
  try {
    const gitDir = path.join(workspaceRoot, ".git");
    if (fs.existsSync(gitDir)) {
      ctx.isGitRepo = true;
      // Get current branch
      try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: workspaceRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        ctx.gitBranch = branch;
      } catch {
        // Ignore git errors
      }
    }
  } catch {
    // Not a git repo
  }

  return ctx;
}

// ============================================================================
// Memory Files Loader
// ============================================================================

interface MemoryFile {
  path: string;
  content: string;
}

function loadMemoryFiles(workspaceRoot: string): MemoryFile[] {
  const files: MemoryFile[] = [];

  for (const fileName of MEMORY_FILE_NAMES) {
    const filePath = path.join(workspaceRoot, fileName);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.trim()) {
          files.push({
            path: fileName,
            content: content.slice(0, 10000), // Limit to 10KB per file
          });
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return files;
}

// System prompts imported from ./prompts.js

// ============================================================================
// Tool Selection - Filter tools based on mode
// ============================================================================

function selectToolsForMode(mode: AgentMode): Record<string, Tool<any, any>> {
  const allTools = getAllTools();
  if (mode === "agent") return allTools;

  // New tool names
  const readOnlyToolNames = new Set([
    "read",
    "list",
    "grep",
    "glob",
    "todoread",
    "semantic_search",
    "index_status",
  ]);

  if (mode === "plan") {
    readOnlyToolNames.add("todowrite");
    readOnlyToolNames.add("question"); // Allow questions in plan mode
  }

  const filtered: Record<string, Tool<any, any>> = {};
  for (const [name, toolValue] of Object.entries(allTools)) {
    if (readOnlyToolNames.has(name)) {
      filtered[name] = toolValue as Tool<any, any>;
    }
  }
  return filtered;
}

// ============================================================================
// AI Agent Class
// ============================================================================

export class AIAgent {
  private config: AgentConfig;
  private tools: Record<string, Tool<any, any>>;
  private systemPrompt: string;
  private abortController: AbortController | null = null;
  private initialized: boolean = false;

  constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 250,
      maxTokens: 16384,
      temperature: 0.7,
      mode: "agent",
      ...config,
    };

    const workspaceRoot = config.workspaceRoot || process.cwd();

    if (config.workspaceRoot) {
      setWorkspaceRoot(config.workspaceRoot);
    }

    // Register subagent tool for agent mode
    if (this.config.mode === "agent") {
      setSubagentTool(subagentToolDefinition);

      setSubagentExecutor(async (prompt: string, type: string) => {
        const allTools = getAllTools();

        const toolNamesByType: Record<string, string[]> = {
          explore: ["read", "list", "grep", "glob", "todoread", "semantic_search", "index_status"],
          research: ["webfetch", "exa_web_search", "exa_code_search"],
        };

        const selectedToolNames =
          toolNamesByType[type] ??
          Object.keys(allTools).filter((name) => name !== "task");

        const subagentTools: Record<string, Tool<any, any>> = {};
        for (const name of selectedToolNames) {
          if (allTools[name]) subagentTools[name] = allTools[name]!;
        }

        const baseModel = createProvider({
          provider: this.config.provider,
          model: this.config.model,
          apiKey: this.config.apiKey,
          baseUrl: this.config.baseUrl,
        });

        const providerOptions = getProviderOptions(
          this.config.provider,
          this.config.model,
          this.config.thinking,
        );

        const baseInstructions =
          type === "explore"
            ? SUBAGENT_PROMPTS.explore
            : type === "research"
              ? SUBAGENT_PROMPTS.research
              : SUBAGENT_PROMPTS.general;
        const focus = prompt ? `\n\n# Task Focus\n${prompt}` : "";

        const agent = new ToolLoopAgent({
          model: baseModel as any,
          instructions: `${baseInstructions}${focus}`,
          tools: subagentTools,
          id: `subagent-${type}`,
          stopWhen: stepCountIs(25),
          callOptionsSchema: z.object({}),
          prepareCall: ({ ...settings }: any) => ({
            ...settings,
            temperature: 0.3,
            maxOutputTokens: 4096,
            providerOptions,
          }),
        });

        const result = await agent.stream({
          messages: [{ role: "user", content: prompt }],
          options: {},
        } as any);

        let output = "";
        // Collect tool calls to return as structured data
        const toolCalls: Array<{
          id: string;
          name: string;
          args?: Record<string, unknown>;
          output?: string;
          status: "done" | "error";
        }> = [];
        const pendingTools = new Map<string, { name: string; args?: Record<string, unknown> }>();

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            output += part.text;
          } else if (part.type === "tool-call") {
            const toolCall = part as { toolCallId: string; toolName: string; input?: Record<string, unknown> };
            pendingTools.set(toolCall.toolCallId, {
              name: toolCall.toolName,
              args: toolCall.input,
            });
          } else if (part.type === "tool-result") {
            const toolResult = part as { toolCallId: string; toolName: string; output?: unknown };
            const pending = pendingTools.get(toolResult.toolCallId);
            toolCalls.push({
              id: toolResult.toolCallId,
              name: toolResult.toolName || pending?.name || "unknown",
              args: pending?.args,
              output: typeof toolResult.output === "string" ? toolResult.output : JSON.stringify(toolResult.output),
              status: "done",
            });
            pendingTools.delete(toolResult.toolCallId);
          } else if (part.type === "tool-error") {
            const toolError = part as { toolCallId: string; toolName?: string; error?: unknown };
            const pending = pendingTools.get(toolError.toolCallId);
            toolCalls.push({
              id: toolError.toolCallId,
              name: toolError.toolName || pending?.name || "unknown",
              args: pending?.args,
              output: typeof toolError.error === "string" ? toolError.error : JSON.stringify(toolError.error),
              status: "error",
            });
            pendingTools.delete(toolError.toolCallId);
          }
        }

        // Return structured JSON with tools and text output
        return JSON.stringify({
          result: output.trim(),
          tools: toolCalls,
        });
      });
    }

    // Tools are already in AI SDK v6 format from getAllTools()
    this.tools = selectToolsForMode(this.config.mode!);
    // Initialize with sync version, will be updated async
    this.systemPrompt = this.buildSystemPrompt(workspaceRoot);
  }

  /**
   * Initialize the agent with async operations (index detection).
   * Call this before using stream() for best results.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const workspaceRoot = this.config.workspaceRoot || process.cwd();
    const env = await getEnvironmentContextAsync(workspaceRoot);
    const memoryFiles = loadMemoryFiles(workspaceRoot);
    
    // Rebuild prompt with async context
    this.systemPrompt = this.buildSystemPromptWithEnv(env, memoryFiles);
    this.initialized = true;
  }

  private buildSystemPrompt(workspaceRoot: string): string {
    const mode = this.config.mode || "agent";

    // Get environment context
    const env = getEnvironmentContext(workspaceRoot);

    // Load memory files
    const memoryFiles = loadMemoryFiles(workspaceRoot);

    // Build the prompt
    let prompt = SYSTEM_PROMPT;

    // Add mode-specific instructions
    if (mode === "ask") prompt += ASK_MODE_PROMPT;
    else if (mode === "plan") prompt += PLAN_MODE_PROMPT;

    // Add environment context
    prompt += `

# Environment
<env>
  Working directory: ${env.workingDirectory}
  Is directory a git repo: ${env.isGitRepo ? "yes" : "no"}${env.gitBranch ? `\n  Current branch: ${env.gitBranch}` : ""}
  Platform: ${env.platform}
  Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric" })}
  Shell: ${env.shell}
  Node: ${env.nodeVersion}
  Semantic index: ${env.hasSemanticIndex ? `YES (${env.indexedFiles} files, ${env.indexedChunks} chunks) - USE semantic_search for code exploration!` : "not available"}
</env>`;

    // Add memory files if found
    if (memoryFiles.length > 0) {
      prompt += `

# Project Instructions

The following instruction files were found in the project. Follow these guidelines:
`;
      for (const file of memoryFiles) {
        prompt += `
<file path="${file.path}">
${file.content}
</file>
`;
      }
    }

    return prompt;
  }

  private buildSystemPromptWithEnv(env: EnvironmentContext, memoryFiles: MemoryFile[]): string {
    const mode = this.config.mode || "agent";

    // Build the prompt
    let prompt = SYSTEM_PROMPT;

    // Add mode-specific instructions
    if (mode === "ask") prompt += ASK_MODE_PROMPT;
    else if (mode === "plan") prompt += PLAN_MODE_PROMPT;

    // Add environment context
    prompt += `

# Environment
<env>
  Working directory: ${env.workingDirectory}
  Is directory a git repo: ${env.isGitRepo ? "yes" : "no"}${env.gitBranch ? `\n  Current branch: ${env.gitBranch}` : ""}
  Platform: ${env.platform}
  Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric" })}
  Shell: ${env.shell}
  Node: ${env.nodeVersion}
  Semantic index: ${env.hasSemanticIndex ? `YES (${env.indexedFiles} files, ${env.indexedChunks} chunks) - USE semantic_search for code exploration!` : "not available"}
</env>`;

    // Add memory files if found
    if (memoryFiles.length > 0) {
      prompt += `

# Project Instructions

The following instruction files were found in the project. Follow these guidelines:
`;
      for (const file of memoryFiles) {
        prompt += `
<file path="${file.path}">
${file.content}
</file>
`;
      }
    }

    return prompt;
  }

  /**
   * Stream responses from the AI agent
   */
  async *stream(messages: AgentMessage[]): AsyncGenerator<StreamEvent> {
    // Always refresh environment context so the agent sees current index status
    // (e.g. after auto-indexing or file edits).
    try {
      const workspaceRoot = this.config.workspaceRoot || process.cwd();
      const env = await getEnvironmentContextAsync(workspaceRoot);
      const memoryFiles = loadMemoryFiles(workspaceRoot);
      this.systemPrompt = this.buildSystemPromptWithEnv(env, memoryFiles);
      this.initialized = true;
    } catch {
      // Fall back to existing prompt
      if (!this.initialized) await this.initialize();
    }

    // Validate config
    const validation = validateProviderConfig({
      provider: this.config.provider,
      model: this.config.model,
      apiKey: this.config.apiKey,
    });

    if (!validation.valid) {
      yield {
        type: "error",
        data: { error: validation.error, isConfigError: true },
      };
      return;
    }

    this.abortController = new AbortController();

    try {
      // Convert messages to ModelMessage format
      const coreMessages: any[] = messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content as any,
      }));

      const baseModel = createProvider({
        provider: this.config.provider,
        model: this.config.model,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
      });

      const providerOptions = getProviderOptions(
        this.config.provider,
        this.config.model,
        this.config.thinking,
      );

      const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const telemetryEnabled =
        process.env.AI_SDK_TELEMETRY === "1" ||
        process.env.AI_SDK_TELEMETRY === "true";
      const middlewareLoggingEnabled =
        process.env.AI_SDK_MIDDLEWARE_LOGGING === "1" ||
        process.env.AI_SDK_MIDDLEWARE_LOGGING === "true";
      const languageModel = withResumableMiddleware(baseModel, {
        retry: { maxRetries: 3 },
        cache: { enabled: true },
        logging: middlewareLoggingEnabled,
      }, streamId);

      const agent = new ToolLoopAgent({
        model: languageModel as any,
        instructions: this.systemPrompt,
        tools: this.tools,
        id: "coding-cli",
        stopWhen: stepCountIs(this.config.maxIterations || 50),
        callOptionsSchema: z.object({}),
        prepareCall: ({ ...settings }: any) => ({
          ...settings,
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          providerOptions,
          experimental_telemetry: telemetryEnabled
            ? {
                isEnabled: true,
                functionId: "coding-cli.agent",
                metadata: {
                  agentId: "coding-cli",
                  streamId,
                  provider: this.config.provider,
                  model: this.config.model,
                },
              }
            : undefined,
        }),
      });

      const result = await agent.stream({
        messages: coreMessages,
        abortSignal: this.abortController.signal,
        options: {},
      } as any);

      for await (const part of result.fullStream) {
        if (this.abortController.signal.aborted) {
          yield { type: "error", data: { error: "Aborted by user" } };
          return;
        }

        switch (part.type) {
          case "start-step":
            yield { type: "step-start", data: part };
            break;

          case "finish-step":
            yield { type: "step-finish", data: part };
            break;

          case "text-delta":
            yield { type: "text-delta", data: { text: part.text } };
            break;

          case "reasoning-delta":
            yield { type: "reasoning", data: { text: part.text } };
            break;

          case "tool-call":
            yield {
              type: "tool-call",
              data: {
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input,
              },
            };
            break;

          case "tool-result":
            yield {
              type: "tool-result",
              data: {
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.output,
                isError: false,
                preliminary: (part as any).preliminary ?? false,
              },
            };
            break;

          case "tool-error":
            yield {
              type: "tool-result",
              data: {
                toolCallId: (part as any).toolCallId,
                toolName: (part as any).toolName,
                result: (part as any).error,
                isError: true,
                preliminary: false,
              },
            };
            break;

          case "finish":
            if ((part as any).totalUsage) {
              yield {
                type: "step-usage",
                data: {
                  inputTokens: (part as any).totalUsage.inputTokens ?? 0,
                  outputTokens: (part as any).totalUsage.outputTokens ?? 0,
                  totalTokens:
                    ((part as any).totalUsage.inputTokens ?? 0) +
                    ((part as any).totalUsage.outputTokens ?? 0),
                },
              };
            }
            break;

          case "error":
            const errorMsg =
              part.error instanceof Error
                ? this.formatError(part.error)
                : String(part.error);
            yield {
              type: "error",
              data: { error: errorMsg, fullError: part.error },
            };
            break;
        }
      }

      const finalText = await (result as any).fullText;
      yield {
        type: "finish",
        data: {
          finalText,
        },
      };
    } catch (error: any) {
      const errorMessage = this.formatError(error);
      yield { type: "error", data: { error: errorMessage, fullError: error } };
    }
  }

  /**
   * Extract rate limit wait time from error (in milliseconds)
   * Returns the retry-after time or null if not a rate limit error
   */
  private extractRateLimitWaitTime(error: any): number | null {
    if (!error) return null;

    const status = error.status || error.statusCode;
    if (status !== 429) return null;

    // Check for Retry-After header (in seconds)
    const retryAfter =
      error.headers?.["retry-after"] ||
      error.headers?.["Retry-After"] ||
      error.response?.headers?.["retry-after"] ||
      error.response?.headers?.["Retry-After"];

    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }

    // Check for x-ratelimit-reset-after header (some providers use this)
    const resetAfter =
      error.headers?.["x-ratelimit-reset-after"] ||
      error.response?.headers?.["x-ratelimit-reset-after"];

    if (resetAfter) {
      const seconds = parseFloat(resetAfter);
      if (!isNaN(seconds)) {
        return Math.ceil(seconds * 1000);
      }
    }

    // Check for x-ratelimit-reset header (Unix timestamp)
    const resetAt =
      error.headers?.["x-ratelimit-reset"] ||
      error.response?.headers?.["x-ratelimit-reset"];

    if (resetAt) {
      const resetTime = parseInt(resetAt, 10) * 1000;
      const waitTime = resetTime - Date.now();
      if (waitTime > 0) {
        return waitTime;
      }
    }

    // Check error body for wait time hints
    try {
      const body = this.extractErrorBody(error);
      if (body?.error?.retry_after) {
        return body.error.retry_after * 1000;
      }
      if (body?.retry_after) {
        return body.retry_after * 1000;
      }
    } catch {
      // Ignore
    }

    return RATE_LIMIT_DEFAULT_WAIT_MS;
  }

  /**
   * Extract the error body from various error formats
   */
  private extractErrorBody(error: any): any {
    if (!error) return null;

    // Direct body property
    if (error.body) {
      try {
        return typeof error.body === "string"
          ? JSON.parse(error.body)
          : error.body;
      } catch {
        return { raw: error.body };
      }
    }

    // Response data
    if (error.response?.data) {
      return error.response.data;
    }

    // Error data property (Vercel AI SDK)
    if (error.data) {
      try {
        return typeof error.data === "string"
          ? JSON.parse(error.data)
          : error.data;
      } catch {
        return { raw: error.data };
      }
    }

    // Cause chain
    if (error.cause) {
      return this.extractErrorBody(error.cause);
    }

    return null;
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    const status = error?.status || error?.statusCode;
    return status === 429;
  }

  /**
   * Format error with detailed information (verbose mode)
   */
  private formatError(error: any, verbose: boolean = true): string {
    if (!error) return "Unknown error";

    const parts: string[] = [];

    // Get status code
    const status = error.status || error.statusCode;
    const statusText = error.statusText || "";

    // Main error message
    let mainMessage = error.message || statusText || "Unknown error";

    // API error with status code
    if (status) {
      if (status === 401) {
        mainMessage = `Authentication failed (401): Invalid or missing API key for ${this.config.provider}`;
      } else if (status === 403) {
        mainMessage = `Access denied (403): No permission for model ${this.config.model}`;
      } else if (status === 404) {
        mainMessage = `Model not found (404): ${this.config.model} doesn't exist`;
      } else if (status === 429) {
        mainMessage = `Rate limited (429): Too many requests`;
      } else if (status === 500) {
        mainMessage = `Server error (500): ${this.config.provider} is having issues`;
      } else if (status === 503) {
        mainMessage = `Service unavailable (503): ${this.config.provider} is down`;
      } else {
        mainMessage = `API Error (${status}): ${mainMessage}`;
      }
    }

    // Network errors
    if (error.code === "ECONNREFUSED") {
      mainMessage = `Connection refused: Can't connect to ${this.config.provider}. ${this.config.provider === "ollama" ? "Is Ollama running?" : "Check your network."}`;
    } else if (error.code === "ENOTFOUND") {
      mainMessage = `DNS error: Can't resolve ${this.config.provider} address.`;
    } else if (error.code === "ETIMEDOUT") {
      mainMessage = `Timeout: Request took too long.`;
    }

    parts.push(mainMessage);

    // In verbose mode, add full error details
    if (verbose) {
      // Extract and add error body details
      const body = this.extractErrorBody(error);
      if (body) {
        // Handle different error body formats
        if (body.error) {
          if (typeof body.error === "string") {
            parts.push(`\nError: ${body.error}`);
          } else if (body.error.message) {
            parts.push(`\nMessage: ${body.error.message}`);
            if (body.error.type) {
              parts.push(`Type: ${body.error.type}`);
            }
            if (body.error.code) {
              parts.push(`Code: ${body.error.code}`);
            }
            if (body.error.param) {
              parts.push(`Param: ${body.error.param}`);
            }
          }
        } else if (body.message) {
          parts.push(`\nMessage: ${body.message}`);
        } else if (body.raw && typeof body.raw === "string") {
          // Raw body content (truncated)
          const truncated =
            body.raw.length > 500 ? body.raw.slice(0, 500) + "..." : body.raw;
          parts.push(`\nResponse: ${truncated}`);
        }

        // Additional details from body
        if (body.details) {
          parts.push(
            `\nDetails: ${typeof body.details === "string" ? body.details : JSON.stringify(body.details)}`,
          );
        }
      }

      // Add request info if available
      if (error.url) {
        parts.push(`\nURL: ${error.url}`);
      }

      // Add provider context
      parts.push(
        `\nProvider: ${this.config.provider}, Model: ${this.config.model}`,
      );

      // Add cause chain
      if (error.cause && error.cause !== error) {
        const causeMsg =
          error.cause.message || JSON.stringify(error.cause, null, 2);
        if (causeMsg && !mainMessage.includes(causeMsg)) {
          parts.push(`\nCause: ${causeMsg}`);
        }
      }
    }

    return parts.join("\n");
  }

  /**
   * Cancel the running stream
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAIAgent(config: AgentConfig): AIAgent {
  return new AIAgent(config);
}

/**
 * Create and initialize an AI agent with full async setup.
 * This includes semantic index detection.
 */
export async function createAIAgentAsync(config: AgentConfig): Promise<AIAgent> {
  const agent = new AIAgent(config);
  await agent.initialize();
  return agent;
}

export { checkModelThinking as modelSupportsThinking };
