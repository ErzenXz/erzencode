/**
 * Rate Limit Tracker
 *
 * Tracks rate limit state per AI provider and model to avoid hitting limits.
 * Parses provider-specific headers and calculates smart wait times.
 *
 * Supports:
 * - OpenAI: x-ratelimit-remaining-requests, x-ratelimit-reset-requests
 * - Anthropic: anthropic-ratelimit-requests-remaining, anthropic-ratelimit-requests-reset
 * - Generic: retry-after, x-ratelimit-reset-after
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "xai"
  | "deepseek"
  | "groq"
  | "openai-compatible"
  | "cohere"
  | "azure"
  | "bedrock";

export interface RateLimitInfo {
  provider: ProviderType;
  model: string;

  // Request-based limits
  requestsRemaining?: number;
  requestsResetAt?: number; // Unix timestamp

  // Token-based limits
  tokensRemaining?: number;
  tokensResetAt?: number;

  // Tracking
  lastRequestTime: number;
  requestCountInWindow: number;
  windowStartMs: number;

  // Rate limit errors encountered
  rateLimitErrors: number;
  lastRateLimitError?: number;
}

export interface WaitTimeInfo {
  canProceed: boolean;
  waitTimeMs: number;
  reason: string;
  limitRemaining?: number;
  limitType?: "requests" | "tokens";
}

export interface RateLimitTrackerConfig {
  enabled: boolean;
  persistPath: string;
  throttleBufferMs: number; // Wait this long before hitting limit
  onRateLimit?: (info: RateLimitInfo, waitTime: number) => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RATE_LIMIT_TRACKER_CONFIG: RateLimitTrackerConfig = {
  enabled: true,
  persistPath: join(homedir(), ".erzencode", "rate-limits.json"),
  throttleBufferMs: 1000, // 1 second buffer
};

// ============================================================================
// Rate Limit Tracker Implementation
// ============================================================================

export class RateLimitTracker {
  private states = new Map<string, RateLimitInfo>();
  private config: RateLimitTrackerConfig;
  private persistPath: string;
  private lastPersistTime = 0;
  private persistDebounceMs = 5000; // Persist every 5 seconds max

  constructor(config: Partial<RateLimitTrackerConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_TRACKER_CONFIG, ...config };
    this.persistPath = this.config.persistPath;
    this.loadFromFile();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Update rate limit state from response headers
   */
  updateFromHeaders(
    provider: ProviderType,
    model: string,
    headers: Headers | Record<string, string | undefined>
  ): void {
    if (!this.config.enabled) return;

    const key = this.getKey(provider, model);
    const state = this.getOrCreateState(provider, model);

    // Parse headers based on provider
    const parsed = this.parseHeaders(provider, headers);

    // Update state
    if (parsed.requestsRemaining !== undefined) {
      state.requestsRemaining = parsed.requestsRemaining;
    }
    if (parsed.requestsResetAt !== undefined) {
      state.requestsResetAt = parsed.requestsResetAt;
    }
    if (parsed.tokensRemaining !== undefined) {
      state.tokensRemaining = parsed.tokensRemaining;
    }
    if (parsed.tokensResetAt !== undefined) {
      state.tokensResetAt = parsed.tokensResetAt;
    }

    // Update tracking info
    state.lastRequestTime = Date.now();

    // Increment request count if within window
    const now = Date.now();
    if (now - state.windowStartMs < 60000) {
      // Within same minute window
      state.requestCountInWindow++;
    } else {
      // New window
      state.windowStartMs = now;
      state.requestCountInWindow = 1;
    }

    this.states.set(key, state);
    this.schedulePersist();
  }

  /**
   * Check if we can make a request now
   */
  canMakeRequest(
    provider: ProviderType,
    model: string
  ): WaitTimeInfo {
    if (!this.config.enabled) {
      return { canProceed: true, waitTimeMs: 0, reason: "Rate limiting disabled" };
    }

    const key = this.getKey(provider, model);
    const state = this.states.get(key);

    if (!state) {
      return { canProceed: true, waitTimeMs: 0, reason: "No rate limit data" };
    }

    const now = Date.now();

    // Check request-based limits
    if (state.requestsResetAt && state.requestsRemaining !== undefined) {
      const timeUntilReset = state.requestsResetAt - now;
      if (state.requestsRemaining <= 1 && timeUntilReset > 0) {
        const waitTime = timeUntilReset + this.config.throttleBufferMs;
        return {
          canProceed: false,
          waitTimeMs: waitTime,
          reason: "Request limit reached, waiting for reset",
          limitRemaining: state.requestsRemaining,
          limitType: "requests",
        };
      }
      if (state.requestsRemaining <= 5 && timeUntilReset > 0) {
        // Near limit, add small buffer
        return {
          canProceed: true,
          waitTimeMs: this.config.throttleBufferMs,
          reason: "Near request limit, adding buffer",
          limitRemaining: state.requestsRemaining,
          limitType: "requests",
        };
      }
    }

    // Check token-based limits
    if (state.tokensResetAt && state.tokensRemaining !== undefined) {
      const timeUntilReset = state.tokensResetAt - now;
      if (state.tokensRemaining <= 1000 && timeUntilReset > 0) {
        // Less than 1000 tokens remaining
        const waitTime = timeUntilReset + this.config.throttleBufferMs;
        return {
          canProceed: false,
          waitTimeMs: waitTime,
          reason: "Token limit reached, waiting for reset",
          limitRemaining: state.tokensRemaining,
          limitType: "tokens",
        };
      }
    }

    return { canProceed: true, waitTimeMs: 0, reason: "Within limits" };
  }

  /**
   * Get wait time before next request
   */
  getWaitTime(provider: ProviderType, model: string): number {
    const info = this.canMakeRequest(provider, model);
    return info.waitTimeMs;
  }

  /**
   * Record a rate limit error (429 status)
   */
  recordRateLimitError(
    provider: ProviderType,
    model: string,
    retryAfter?: number
  ): void {
    const key = this.getKey(provider, model);
    const state = this.getOrCreateState(provider, model);

    state.rateLimitErrors++;
    state.lastRateLimitError = Date.now();

    // If retry-after provided, set reset time
    if (retryAfter) {
      const now = Date.now();
      const resetAt = now + retryAfter * 1000;

      // Update both request and token reset times to be safe
      state.requestsResetAt = resetAt;
      state.tokensResetAt = resetAt;

      this.states.set(key, state);
      this.schedulePersist();

      // Callback
      this.config.onRateLimit?.(state, retryAfter * 1000);
    }
  }

  /**
   * Get all rate limit states
   */
  getAllStates(): Map<string, RateLimitInfo> {
    return new Map(this.states);
  }

  /**
   * Get state for specific provider/model
   */
  getState(provider: ProviderType, model: string): RateLimitInfo | undefined {
    const key = this.getKey(provider, model);
    return this.states.get(key);
  }

  /**
   * Clear all rate limit states
   */
  clear(): void {
    this.states.clear();
    this.deletePersistFile();
  }

  /**
   * Clear state for specific provider
   */
  clearProvider(provider: ProviderType): void {
    for (const [key] of this.states) {
      if (key.startsWith(`${provider}:`)) {
        this.states.delete(key);
      }
    }
    this.schedulePersist();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getKey(provider: ProviderType, model: string): string {
    return `${provider}:${model}`;
  }

  private getOrCreateState(
    provider: ProviderType,
    model: string
  ): RateLimitInfo {
    const key = this.getKey(provider, model);
    let state = this.states.get(key);

    if (!state) {
      state = {
        provider,
        model,
        lastRequestTime: 0,
        requestCountInWindow: 0,
        windowStartMs: Date.now(),
        rateLimitErrors: 0,
      };
      this.states.set(key, state);
    }

    return state;
  }

  private parseHeaders(
    provider: ProviderType,
    headers: Headers | Record<string, string | undefined>
  ): Partial<RateLimitInfo> {
    const result: Partial<RateLimitInfo> = {};

    // Normalize headers to Record
    const headersObj: Record<string, string | undefined> = {};
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    } else {
      Object.assign(headersObj, headers);
    }

    // Provider-specific parsing
    switch (provider) {
      case "openai":
      case "azure":
      case "openai-compatible":
        Object.assign(result, this.parseOpenAIHeaders(headersObj));
        break;
      case "anthropic":
        Object.assign(result, this.parseAnthropicHeaders(headersObj));
        break;
      case "google":
        Object.assign(result, this.parseGoogleHeaders(headersObj));
        break;
      default:
        Object.assign(result, this.parseGenericHeaders(headersObj));
    }

    return result;
  }

  private parseOpenAIHeaders(
    headers: Record<string, string | undefined>
  ): Partial<RateLimitInfo> {
    const result: Partial<RateLimitInfo> = {};

    // x-ratelimit-remaining-requests
    if (headers["x-ratelimit-remaining-requests"]) {
      const val = parseInt(headers["x-ratelimit-remaining-requests"], 10);
      if (!isNaN(val)) {
        result.requestsRemaining = val;
      }
    }

    // x-ratelimit-reset-requests (Unix timestamp in milliseconds)
    if (headers["x-ratelimit-reset-requests"]) {
      const val = parseFloat(headers["x-ratelimit-reset-requests"]);
      if (!isNaN(val)) {
        // OpenAI sends timestamp in seconds or milliseconds
        result.requestsResetAt = val < 10000000000 ? val * 1000 : val;
      }
    }

    // x-ratelimit-remaining-tokens
    if (headers["x-ratelimit-remaining-tokens"]) {
      const val = parseInt(headers["x-ratelimit-remaining-tokens"], 10);
      if (!isNaN(val)) {
        result.tokensRemaining = val;
      }
    }

    // x-ratelimit-reset-tokens
    if (headers["x-ratelimit-reset-tokens"]) {
      const val = parseFloat(headers["x-ratelimit-reset-tokens"]);
      if (!isNaN(val)) {
        result.tokensResetAt = val < 10000000000 ? val * 1000 : val;
      }
    }

    return result;
  }

  private parseAnthropicHeaders(
    headers: Record<string, string | undefined>
  ): Partial<RateLimitInfo> {
    const result: Partial<RateLimitInfo> = {};

    // anthropic-ratelimit-requests-remaining
    if (headers["anthropic-ratelimit-requests-remaining"]) {
      const val = parseInt(headers["anthropic-ratelimit-requests-remaining"], 10);
      if (!isNaN(val)) {
        result.requestsRemaining = val;
      }
    }

    // anthropic-ratelimit-requests-reset (Unix timestamp in microseconds)
    if (headers["anthropic-ratelimit-requests-reset"]) {
      const val = parseFloat(headers["anthropic-ratelimit-requests-reset"]);
      if (!isNaN(val)) {
        // Anthropic sends timestamp in microseconds
        result.requestsResetAt = val / 1000;
      }
    }

    // anthropic-ratelimit-tokens-remaining
    if (headers["anthropic-ratelimit-tokens-remaining"]) {
      const val = parseInt(headers["anthropic-ratelimit-tokens-remaining"], 10);
      if (!isNaN(val)) {
        result.tokensRemaining = val;
      }
    }

    // anthropic-ratelimit-tokens-reset
    if (headers["anthropic-ratelimit-tokens-reset"]) {
      const val = parseFloat(headers["anthropic-ratelimit-tokens-reset"]);
      if (!isNaN(val)) {
        result.tokensResetAt = val / 1000;
      }
    }

    return result;
  }

  private parseGoogleHeaders(
    headers: Record<string, string | undefined>
  ): Partial<RateLimitInfo> {
    const result: Partial<RateLimitInfo> = {};

    // Google uses generic headers
    return this.parseGenericHeaders(headers);
  }

  private parseGenericHeaders(
    headers: Record<string, string | undefined>
  ): Partial<RateLimitInfo> {
    const result: Partial<RateLimitInfo> = {};

    // retry-after (seconds or HTTP-date)
    const retryAfter = headers["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        result.requestsResetAt = Date.now() + seconds * 1000;
      }
    }

    // x-ratelimit-reset-after (seconds)
    if (headers["x-ratelimit-reset-after"]) {
      const seconds = parseInt(headers["x-ratelimit-reset-after"], 10);
      if (!isNaN(seconds)) {
        result.requestsResetAt = Date.now() + seconds * 1000;
      }
    }

    // x-rate-limit-reset (Unix timestamp)
    if (headers["x-rate-limit-reset"]) {
      const val = parseFloat(headers["x-rate-limit-reset"]);
      if (!isNaN(val)) {
        result.requestsResetAt = val < 10000000000 ? val * 1000 : val;
      }
    }

    return result;
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private schedulePersist(): void {
    const now = Date.now();
    if (now - this.lastPersistTime >= this.persistDebounceMs) {
      this.saveToFile();
      this.lastPersistTime = now;
    }
  }

  private saveToFile(): void {
    try {
      const dir = this.persistPath.split("/").slice(0, -1).join("/");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = Array.from(this.states.entries());
      writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      // Ignore persistence errors
      console.error("Failed to save rate limit data:", error);
    }
  }

  private loadFromFile(): void {
    try {
      if (!existsSync(this.persistPath)) {
        return;
      }

      const content = readFileSync(this.persistPath, "utf-8");
      const data = JSON.parse(content) as Array<[string, RateLimitInfo]>;

      // Clean up old entries (older than 1 hour)
      const now = Date.now();
      const hourAgo = now - 3600000;

      for (const [key, state] of data) {
        // Only load recent states
        if (state.lastRequestTime > hourAgo) {
          this.states.set(key, state);
        }
      }
    } catch (error) {
      // Ignore load errors
      console.error("Failed to load rate limit data:", error);
    }
  }

  private deletePersistFile(): void {
    try {
      if (existsSync(this.persistPath)) {
        const { unlinkSync } = require("fs");
        unlinkSync(this.persistPath);
      }
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalRateLimitTracker: RateLimitTracker | undefined;

export function getGlobalRateLimitTracker(): RateLimitTracker {
  if (!globalRateLimitTracker) {
    globalRateLimitTracker = new RateLimitTracker();
  }
  return globalRateLimitTracker;
}

export function resetGlobalRateLimitTracker(): void {
  if (globalRateLimitTracker) {
    globalRateLimitTracker.clear();
  }
  globalRateLimitTracker = undefined;
}
