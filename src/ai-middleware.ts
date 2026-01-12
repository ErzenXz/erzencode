/**
 * AI Middleware Layer - Caching, Retry, and Error Handling
 * Built on Vercel AI SDK v6 LanguageModelMiddleware
 */

import {
  type LanguageModelMiddleware,
  simulateReadableStream,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
  cacheDir?: string;
}

export interface MiddlewareConfig {
  retry?: Partial<RetryConfig>;
  cache?: Partial<CacheConfig>;
  logging?: boolean;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  onCacheHit?: (key: string) => void;
  onCacheMiss?: (key: string) => void;
}

export interface StreamState {
  id: string;
  chunks: any[];
  completed: boolean;
  error?: string;
  timestamp: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMs: 3600000,
  maxEntries: 100,
  cacheDir: join(homedir(), ".ai-code", "cache"),
};

const DEFAULT_STREAMS_DIR = join(homedir(), ".ai-code", "streams");

// ============================================================================
// Error Classes
// ============================================================================

export class AIRetryableError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryAfter?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "AIRetryableError";
  }
}

export class AIRateLimitError extends AIRetryableError {
  constructor(message: string, retryAfter?: number, originalError?: Error) {
    super(message, 429, retryAfter, originalError);
    this.name = "AIRateLimitError";
  }
}

export class AIServerError extends AIRetryableError {
  constructor(message: string, statusCode: number, originalError?: Error) {
    super(message, statusCode, undefined, originalError);
    this.name = "AIServerError";
  }
}

export class AIAuthenticationError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "AIAuthenticationError";
  }
}

// ============================================================================
// Cache Implementation (File-based for CLI)
// ============================================================================

class FileCache {
  private cacheDir: string;
  private ttlMs: number;
  private maxEntries: number;

  constructor(config: CacheConfig) {
    this.cacheDir = config.cacheDir || DEFAULT_CACHE_CONFIG.cacheDir!;
    this.ttlMs = config.ttlMs;
    this.maxEntries = config.maxEntries;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
    return join(this.cacheDir, `${hash}.json`);
  }

  get<T>(key: string): T | null {
    const filePath = this.getFilePath(key);
    if (!existsSync(filePath)) return null;
    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      if (Date.now() - data.timestamp > this.ttlMs) {
        unlinkSync(filePath);
        return null;
      }
      return data.value as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    this.ensureCacheDir();
    this.pruneIfNeeded();
    const filePath = this.getFilePath(key);
    writeFileSync(
      filePath,
      JSON.stringify({ key, value, timestamp: Date.now() }),
      "utf-8"
    );
  }

  private pruneIfNeeded(): void {
    try {
      const files = readdirSync(this.cacheDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({
          path: join(this.cacheDir, f),
          mtime: statSync(join(this.cacheDir, f)).mtimeMs,
        }))
        .sort((a, b) => a.mtime - b.mtime);
      while (files.length >= this.maxEntries) {
        const oldest = files.shift();
        if (oldest) unlinkSync(oldest.path);
      }
    } catch {}
  }

  clear(): void {
    try {
      readdirSync(this.cacheDir)
        .filter((f) => f.endsWith(".json"))
        .forEach((f) => unlinkSync(join(this.cacheDir, f)));
    } catch {}
  }
}

// ============================================================================
// Stream State Store (for resumable streams)
// ============================================================================

class StreamStateStore {
  private streams = new Map<string, StreamState>();
  private maxAge = 300000;
  private streamsDir = DEFAULT_STREAMS_DIR;
  private writeEveryNChunks = 50;

  constructor() {
    this.ensureStreamsDir();
  }

  private ensureStreamsDir(): void {
    if (!existsSync(this.streamsDir)) {
      mkdirSync(this.streamsDir, { recursive: true });
    }
  }

  private getFilePath(id: string): string {
    const hash = createHash("sha256").update(id).digest("hex").slice(0, 32);
    return join(this.streamsDir, `${hash}.json`);
  }

  private loadFromDisk(id: string): StreamState | undefined {
    const filePath = this.getFilePath(id);
    if (!existsSync(filePath)) return undefined;
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as StreamState;
      if (!parsed || typeof parsed !== "object") return undefined;
      if (Date.now() - (parsed.timestamp ?? 0) > this.maxAge) {
        try {
          unlinkSync(filePath);
        } catch {}
        return undefined;
      }
      if (!Array.isArray(parsed.chunks)) parsed.chunks = [];
      if (typeof parsed.completed !== "boolean") parsed.completed = false;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private flushToDisk(id: string, state: StreamState): void {
    try {
      this.ensureStreamsDir();
      writeFileSync(this.getFilePath(id), JSON.stringify(state), "utf-8");
    } catch {
      // ignore
    }
  }

  save(id: string, state: Partial<StreamState>): void {
    const existing = this.streams.get(id) || {
      id,
      chunks: [],
      completed: false,
      timestamp: Date.now(),
    };
    const next = { ...existing, ...state, timestamp: Date.now() };
    this.streams.set(id, next);
    const shouldFlush =
      Boolean(next.completed) ||
      Boolean(next.error) ||
      (Array.isArray(next.chunks) &&
        next.chunks.length % this.writeEveryNChunks === 0);
    if (shouldFlush) {
      this.flushToDisk(id, next);
    }
    this.prune();
  }

  get(id: string): StreamState | undefined {
    let state = this.streams.get(id);
    if (!state) {
      state = this.loadFromDisk(id);
      if (state) this.streams.set(id, state);
    }
    if (state && Date.now() - state.timestamp > this.maxAge) {
      this.streams.delete(id);
      try {
        unlinkSync(this.getFilePath(id));
      } catch {}
      return undefined;
    }
    return state;
  }

  appendChunk(id: string, chunk: any): void {
    const state = this.get(id);
    if (state) {
      state.chunks.push(chunk);
      state.timestamp = Date.now();
      const shouldFlush =
        state.completed ||
        Boolean(state.error) ||
        state.chunks.length % this.writeEveryNChunks === 0;
      if (shouldFlush) {
        this.flushToDisk(id, state);
      }
    }
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, state] of this.streams) {
      if (now - state.timestamp > this.maxAge) {
        this.streams.delete(id);
        try {
          unlinkSync(this.getFilePath(id));
        } catch {}
      }
    }
  }
}

export const streamStateStore = new StreamStateStore();

// ============================================================================
// Utility Functions
// ============================================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function calculateDelay(
  attempt: number,
  config: RetryConfig,
  retryAfter?: number
): number {
  if (retryAfter) return Math.min(retryAfter * 1000, config.maxDelayMs);
  const delay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(
    delay + delay * 0.2 * (Math.random() * 2 - 1),
    config.maxDelayMs
  );
}

function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof AIRetryableError) return true;
  if (error && typeof error === "object") {
    const err = error as any;
    const status = err.status || err.statusCode;
    if (status && config.retryableStatusCodes.includes(status)) return true;
    if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE"].includes(err.code))
      return true;

    // Vercel AI SDK / provider-specific rate limit errors (may not surface statusCode)
    const code = err.code || err.error?.code || err.data?.error?.code;
    if (typeof code === "string" && code.toLowerCase().includes("rate_limit"))
      return true;
    if (code === "rate_limit_exceeded") return true;

    const msg = err.message || err.error?.message || err.data?.error?.message;
    if (
      typeof msg === "string" &&
      /rate limit|rate_limited|rate_limit_exceeded/i.test(msg)
    )
      return true;
  }
  return false;
}

function extractRetryAfter(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const err = error as any;
    const val =
      err.headers?.["retry-after"] ||
      err.headers?.["Retry-After"] ||
      err.response?.headers?.["retry-after"] ||
      err.response?.headers?.["Retry-After"] ||
      err.retryAfter ||
      err.error?.retry_after ||
      err.error?.retryAfter ||
      err.data?.error?.retry_after;
    if (val) {
      const p = typeof val === "number" ? val : parseFloat(String(val));
      return Number.isFinite(p) ? Math.ceil(p) : undefined;
    }

    // OpenAI/Vercel messages often contain: "Please try again in 7.497s."
    const msg = err.message || err.error?.message || err.data?.error?.message;
    if (typeof msg === "string") {
      const m = msg.match(/try again in\s*([0-9.]+)\s*s/i);
      if (m?.[1]) {
        const seconds = parseFloat(m[1]);
        if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
      }
    }
  }
  return undefined;
}

function generateCacheKey(params: any, modelId: string, op: string): string {
  const canonical = (() => {
    const messages = Array.isArray(params?.messages)
      ? params.messages.map((m: any) => ({
          role: m?.role,
          content: m?.content,
        }))
      : undefined;

    const tools = params?.tools
      ? Array.isArray(params.tools)
        ? params.tools.map((t: any) => t?.name).filter(Boolean)
        : typeof params.tools === "object"
        ? Object.keys(params.tools)
        : undefined
      : undefined;

    return {
      op,
      model: modelId,
      prompt: params?.prompt,
      system: params?.system,
      messages,
      temperature: params?.temperature,
      maxOutputTokens: params?.maxOutputTokens,
      toolChoice: params?.toolChoice,
      tools,
      providerOptions: params?.providerOptions,
    };
  })();

  const payload = JSON.stringify(canonical);
  const hash = createHash("sha256").update(payload).digest("hex");
  return `${modelId}:${op}:${hash}`;
}

function wrapError(error: unknown): Error {
  if (error instanceof Error && error.name.startsWith("AI")) return error;
  if (error && typeof error === "object") {
    const err = error as any;
    const status = err.status || err.statusCode;
    const message = err.message || String(error);
    const code = err.code || err.error?.code || err.data?.error?.code;
    if (
      status === 429 ||
      code === "rate_limit_exceeded" ||
      (typeof code === "string" && code.toLowerCase().includes("rate_limit"))
    ) {
      return new AIRateLimitError(
        `Rate limit exceeded: ${message}`,
        extractRetryAfter(error),
        err
      );
    }
    if (status === 401 || status === 403)
      return new AIAuthenticationError(message, err);
    if (status >= 500 && status < 600)
      return new AIServerError(message, status, err);
  }
  return error instanceof Error ? error : new Error(String(error));
}

// ============================================================================
// Retry Middleware
// ============================================================================

export function createRetryMiddleware(
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): LanguageModelMiddleware {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate }) => {
      let lastError: Error | undefined;
      for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
        try {
          return await doGenerate();
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt === cfg.maxRetries || !isRetryableError(error, cfg))
            throw wrapError(error);
          const delayMs = calculateDelay(
            attempt,
            cfg,
            extractRetryAfter(error)
          );
          onRetry?.(attempt + 1, lastError, delayMs);
          await sleep(delayMs);
        }
      }
      throw lastError;
    },
    wrapStream: async ({ doStream }) => {
      let lastError: Error | undefined;
      for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
        try {
          return await doStream();
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt === cfg.maxRetries || !isRetryableError(error, cfg))
            throw wrapError(error);
          const delayMs = calculateDelay(
            attempt,
            cfg,
            extractRetryAfter(error)
          );
          onRetry?.(attempt + 1, lastError, delayMs);
          await sleep(delayMs);
        }
      }
      throw lastError;
    },
  };
}

// ============================================================================
// Cache Middleware
// ============================================================================

export function createCacheMiddleware(
  config: Partial<CacheConfig> = {},
  onCacheHit?: (key: string) => void,
  onCacheMiss?: (key: string) => void
): LanguageModelMiddleware {
  const cfg = { ...DEFAULT_CACHE_CONFIG, ...config };
  if (!cfg.enabled) return { specificationVersion: "v3" };
  const cache = new FileCache(cfg);

  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const key = generateCacheKey(params, model.modelId, "generate");
      const cached = cache.get<any>(key);
      if (cached !== null) {
        onCacheHit?.(key);
        return {
          ...cached,
          response: {
            ...cached.response,
            timestamp: cached?.response?.timestamp
              ? new Date(cached.response.timestamp)
              : undefined,
          },
        };
      }
      onCacheMiss?.(key);
      const result = await doGenerate();
      cache.set(key, result);
      return result;
    },
    wrapStream: async ({ doStream, params, model }) => {
      const key = generateCacheKey(params, model.modelId, "stream");
      const cached = cache.get<any>(key);
      if (cached !== null) {
        onCacheHit?.(key);
        const chunks = Array.isArray(cached?.chunks) ? cached.chunks : [];
        const { chunks: _chunks, ...rest } = (cached ?? {}) as any;
        return {
          stream: simulateReadableStream({
            initialDelayInMs: 0,
            chunkDelayInMs: 5,
            chunks,
          }),
          ...rest,
        };
      }
      onCacheMiss?.(key);
      const { stream, ...rest } = await doStream();
      const chunks: any[] = [];
      const withCacheWrite = new TransformStream({
        transform(c: any, ctrl: any) {
          chunks.push(c);
          ctrl.enqueue(c);
        },
        flush() {
          cache.set(key, { chunks, ...rest });
        },
      });

      return { stream: stream.pipeThrough(withCacheWrite), ...rest };
    },
  };
}

// ============================================================================
// Logging Middleware
// ============================================================================

export function createLoggingMiddleware(
  log: (msg: string, data?: any) => void = console.log
): LanguageModelMiddleware {
  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, model }) => {
      const start = Date.now();
      log(`[AI] Generate starting`, { model: model.modelId });
      try {
        const result = await doGenerate();
        log(`[AI] Generate completed in ${Date.now() - start}ms`, {
          model: model.modelId,
          usage: (result as any).usage,
        });
        return result;
      } catch (error) {
        log(`[AI] Generate failed after ${Date.now() - start}ms`, {
          model: model.modelId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    wrapStream: async ({ doStream, model }) => {
      log(`[AI] Stream starting`, { model: model.modelId });
      try {
        const result = await doStream();
        log(`[AI] Stream connected`, { model: model.modelId });
        return result;
      } catch (error) {
        log(`[AI] Stream failed`, {
          model: model.modelId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

// ============================================================================
// Resumable Stream Middleware
// ============================================================================

export function createResumableStreamMiddleware(
  streamId?: string
): LanguageModelMiddleware {
  const id =
    streamId || `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    specificationVersion: "v3",
    wrapStream: async ({ doStream }) => {
      streamStateStore.save(id, { id, chunks: [], completed: false });
      const { stream, ...rest } = await doStream();
      const ts = new TransformStream({
        transform(c: any, ctrl: any) {
          streamStateStore.appendChunk(id, c);
          ctrl.enqueue(c);
        },
        flush() {
          streamStateStore.save(id, { completed: true });
        },
      });
      return { stream: stream.pipeThrough(ts), ...rest, streamId: id };
    },
  };
}

// ============================================================================
// Combined Middleware Factory
// ============================================================================

export function createAIMiddleware(
  config: MiddlewareConfig = {}
): LanguageModelMiddleware {
  const middlewares: LanguageModelMiddleware[] = [];
  if (config.logging) middlewares.push(createLoggingMiddleware());
  if (config.cache?.enabled !== false)
    middlewares.push(
      createCacheMiddleware(config.cache, config.onCacheHit, config.onCacheMiss)
    );
  middlewares.push(createRetryMiddleware(config.retry, config.onRetry));
  return combineMiddleware(middlewares);
}

function combineMiddleware(
  middlewares: LanguageModelMiddleware[]
): LanguageModelMiddleware {
  if (middlewares.length === 0) return { specificationVersion: "v3" };
  if (middlewares.length === 1)
    return middlewares[0] as LanguageModelMiddleware;
  return middlewares.reduce<LanguageModelMiddleware>(
    (combined, mw) => ({
      specificationVersion: "v3",
      wrapGenerate:
        combined.wrapGenerate && mw.wrapGenerate
          ? async (opts: any) =>
              mw.wrapGenerate!({
                ...opts,
                doGenerate: async () => combined.wrapGenerate!(opts),
              })
          : combined.wrapGenerate || mw.wrapGenerate,
      wrapStream:
        combined.wrapStream && mw.wrapStream
          ? async (opts: any) =>
              mw.wrapStream!({
                ...opts,
                doStream: async () => combined.wrapStream!(opts),
              })
          : combined.wrapStream || mw.wrapStream,
    }),
    { specificationVersion: "v3" }
  );
}

// ============================================================================
// Wrap Model with Middleware
// ============================================================================

export function withMiddleware(
  model: LanguageModel,
  config: MiddlewareConfig = {}
): LanguageModel {
  return wrapLanguageModel({
    model: model as any,
    middleware: createAIMiddleware(config),
  });
}

export function withResumableMiddleware(
  model: LanguageModel,
  config: MiddlewareConfig = {},
  streamId?: string
): LanguageModel {
  const middleware = combineMiddleware([
    createResumableStreamMiddleware(streamId),
    createAIMiddleware(config),
  ]);
  return wrapLanguageModel({ model: model as any, middleware });
}

// ============================================================================
// Resume Stream
// ============================================================================

export function resumeStream(streamId: string): AsyncGenerator<any> | null {
  const state = streamStateStore.get(streamId);
  if (!state || state.chunks.length === 0) return null;
  async function* gen() {
    for (const c of state!.chunks) yield c;
  }
  return gen();
}

// ============================================================================
// Clear Cache
// ============================================================================

export function clearCache(cacheDir?: string): void {
  new FileCache({
    ...DEFAULT_CACHE_CONFIG,
    cacheDir: cacheDir || DEFAULT_CACHE_CONFIG.cacheDir,
  }).clear();
}

export type { LanguageModelMiddleware };
