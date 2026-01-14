/**
 * Stream Recovery Manager
 *
 * Handles automatic recovery of interrupted streams due to network issues.
 * Monitors stream health and attempts to resume stale streams.
 *
 * Features:
 * - Auto-detects stale streams (no chunks for 30+ seconds)
 * - Attempts to recover from last known good state
 * - Limits recovery attempts to prevent infinite loops
 * - Provides callbacks for UI feedback
 */

import type { ProviderType } from "./rate-limit-tracker.js";

// ============================================================================
// Types
// ============================================================================

export interface StreamRecoveryConfig {
  enabled: boolean;
  recoveryAttempts: number;
  healthCheckIntervalMs: number;
  staleTimeoutMs: number;
  onRecovery?: (streamId: string, attempt: number, success: boolean) => void;
  onStale?: (streamId: string, staleTime: number) => void;
}

export interface StreamHealthStatus {
  streamId: string;
  isHealthy: boolean;
  isStale: boolean;
  lastChunkTime: number;
  timeSinceLastChunk: number;
  recoveryAttempts: number;
  canRecover: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_STREAM_RECOVERY_CONFIG: StreamRecoveryConfig = {
  enabled: true,
  recoveryAttempts: 5,
  healthCheckIntervalMs: 5000, // Check every 5 seconds
  staleTimeoutMs: 30000, // 30 seconds without chunks = stale
};

// ============================================================================
// Stream Recovery Manager Implementation
// ============================================================================

export class StreamRecoveryManager {
  private config: StreamRecoveryConfig;
  private healthMonitors = new Map<string, NodeJS.Timeout>();
  private recoveryAttempts = new Map<string, number>();

  // Recovery function - set externally to handle actual stream recovery
  public recoveryFunction?: (
    streamId: string,
    originalRequest: any
  ) => Promise<AsyncGenerator<any> | null>;

  constructor(config: Partial<StreamRecoveryConfig> = {}) {
    this.config = { ...DEFAULT_STREAM_RECOVERY_CONFIG, ...config };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start monitoring a stream for health issues
   */
  startMonitoring(
    streamId: string,
    getLastChunkTime: () => number,
    onStaleDetected: () => void | Promise<void>
  ): () => void {
    if (!this.config.enabled) {
      return () => {}; // No-op if disabled
    }

    // Clear any existing monitor for this stream
    this.stopMonitoring(streamId);

    // Reset recovery attempts
    this.recoveryAttempts.set(streamId, 0);

    // Start health check interval
    const interval = setInterval(async () => {
      const lastChunkTime = getLastChunkTime();
      const timeSinceLastChunk = Date.now() - lastChunkTime;

      // Check if stream is stale
      if (timeSinceLastChunk > this.config.staleTimeoutMs) {
        // Callback for stale detection
        this.config.onStale?.(streamId, timeSinceLastChunk);

        // Trigger recovery callback
        await onStaleDetected();

        // Stop monitoring after stale detection
        this.stopMonitoring(streamId);
      }
    }, this.config.healthCheckIntervalMs);

    this.healthMonitors.set(streamId, interval);

    // Return cleanup function
    return () => this.stopMonitoring(streamId);
  }

  /**
   * Stop monitoring a stream
   */
  stopMonitoring(streamId: string): void {
    const interval = this.healthMonitors.get(streamId);
    if (interval) {
      clearInterval(interval);
      this.healthMonitors.delete(streamId);
    }
  }

  /**
   * Attempt to recover a failed stream
   */
  async recoverStream(
    streamId: string,
    originalRequest: any,
    streamState?: {
      chunks: any[];
      completed: boolean;
      error?: string;
      timestamp: number;
    }
  ): Promise<{ success: boolean; generator?: AsyncGenerator<any>; error?: Error }> {
    if (!this.config.enabled || !this.recoveryFunction) {
      return { success: false, error: new Error("Stream recovery is disabled") };
    }

    // Check recovery attempt limit
    const attempts = this.recoveryAttempts.get(streamId) || 0;
    if (attempts >= this.config.recoveryAttempts) {
      return {
        success: false,
        error: new Error(
          `Max recovery attempts (${this.config.recoveryAttempts}) exceeded`
        ),
      };
    }

    // Check if stream can be recovered
    if (streamState?.completed) {
      return { success: false, error: new Error("Stream already completed") };
    }

    // Increment recovery attempts
    this.recoveryAttempts.set(streamId, attempts + 1);

    try {
      // Attempt recovery
      const generator = await this.recoveryFunction(streamId, originalRequest);

      if (generator) {
        // Success
        this.config.onRecovery?.(streamId, attempts + 1, true);

        // Reset recovery attempts on success
        this.recoveryAttempts.set(streamId, 0);

        return { success: true, generator };
      } else {
        // Recovery function returned null
        this.config.onRecovery?.(streamId, attempts + 1, false);

        return {
          success: false,
          error: new Error("Stream recovery function returned null"),
        };
      }
    } catch (error) {
      // Recovery failed
      this.config.onRecovery?.(streamId, attempts + 1, false);

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Get health status for a stream
   */
  getHealthStatus(
    streamId: string,
    lastChunkTime: number,
    streamState?: {
      completed: boolean;
      error?: string;
    }
  ): StreamHealthStatus {
    const now = Date.now();
    const timeSinceLastChunk = now - lastChunkTime;
    const recoveryAttempts = this.recoveryAttempts.get(streamId) || 0;

    const isStale = timeSinceLastChunk > this.config.staleTimeoutMs;
    const isHealthy = !isStale && !streamState?.completed && !streamState?.error;
    const canRecover =
      this.config.enabled &&
      !streamState?.completed &&
      recoveryAttempts < this.config.recoveryAttempts;

    return {
      streamId,
      isHealthy,
      isStale,
      lastChunkTime,
      timeSinceLastChunk,
      recoveryAttempts,
      canRecover,
    };
  }

  /**
   * Reset recovery attempts for a stream
   */
  resetRecoveryAttempts(streamId: string): void {
    this.recoveryAttempts.set(streamId, 0);
  }

  /**
   * Get all monitored streams
   */
  getMonitoredStreams(): string[] {
    return Array.from(this.healthMonitors.keys());
  }

  /**
   * Stop monitoring all streams
   */
  stopAllMonitoring(): void {
    for (const [streamId, interval] of this.healthMonitors) {
      clearInterval(interval);
    }
    this.healthMonitors.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamRecoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalStreamRecoveryManager: StreamRecoveryManager | undefined;

export function getGlobalStreamRecoveryManager(): StreamRecoveryManager {
  if (!globalStreamRecoveryManager) {
    globalStreamRecoveryManager = new StreamRecoveryManager();
  }
  return globalStreamRecoveryManager;
}

export function resetGlobalStreamRecoveryManager(): void {
  if (globalStreamRecoveryManager) {
    globalStreamRecoveryManager.stopAllMonitoring();
  }
  globalStreamRecoveryManager = undefined;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a resumable async generator from stream state
 */
export async function* createResumableGenerator(
  chunks: any[],
  newStream?: AsyncGenerator<any>
): AsyncGenerator<any> {
  // Yield existing chunks first
  for (const chunk of chunks) {
    yield chunk;
  }

  // Then yield new chunks if available
  if (newStream) {
    for await (const chunk of newStream) {
      yield chunk;
    }
  }
}

/**
 * Merge chunk arrays, deduplicating by index/hash
 */
export function mergeChunks(
  existing: any[],
  newChunks: any[],
  getKey: (chunk: any) => string = (c) => JSON.stringify(c)
): any[] {
  const seen = new Set(existing.map(getKey));
  const merged = [...existing];

  for (const chunk of newChunks) {
    const key = getKey(chunk);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(chunk);
    }
  }

  return merged;
}
