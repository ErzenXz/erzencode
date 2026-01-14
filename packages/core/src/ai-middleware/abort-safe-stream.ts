/**
 * Abort-Safe Stream Wrapper
 *
 * Isolates abort signals to prevent them from breaking resumable streams.
 * Distinguishes between user-initiated aborts (cancel button) and system aborts
 * (page refresh, tab close, timeout).
 *
 * Problem: Vercel AI SDK v6 has issues where abort signals break resumable streams
 * (GitHub issue #6502). This wrapper provides a workaround.
 *
 * Features:
 * - Creates isolated abort controller for the stream
 * - Detects user vs system aborts
 * - Prevents page refresh from aborting streams
 * - Allows explicit user cancellation
 */

// ============================================================================
// Types
// ============================================================================

export type AbortReason = "user" | "network" | "timeout" | "system";

export interface AbortSafeStream {
  streamId: string;
  isolatedAbort: AbortController;
  originalAbort: AbortSignal;
  isUserInitiated: boolean;
  abortReason?: AbortReason;
  markUserInitiated: () => void;
  abort: (reason?: AbortReason) => void;
  cleanup: () => void;
}

export interface AbortSafeConfig {
  streamId: string;
  abortSignal?: AbortSignal;
  onAbort?: (reason: AbortReason, streamId: string) => void;
}

// ============================================================================
// Abort-Safe Stream Implementation
// ============================================================================

export class AbortSafeStreamController {
  private streams = new Map<string, AbortSafeStream>();

  /**
   * Create an abort-safe stream wrapper
   */
  createAbortSafeStream(config: AbortSafeConfig): AbortSafeStream {
    const { streamId, abortSignal, onAbort } = config;

    // Create isolated abort controller for the stream
    const isolatedAbort = new AbortController();

    // Track user-initiated vs system aborts
    let isUserInitiated = false;
    let abortReason: AbortReason = "system";

    // Handler for original abort signal
    let abortHandler: (() => void) | undefined;

    if (abortSignal) {
      abortHandler = () => {
        // Only propagate if it's a user-initiated abort
        if (isUserInitiated) {
          isolatedAbort.abort();
          onAbort?.(abortReason, streamId);
        }
        // Otherwise ignore (e.g., page refresh, tab close)
      };

      // Listen for abort on original signal
      abortSignal.addEventListener("abort", abortHandler);
    }

    // Create the abort-safe stream object
    const abortSafeStream: AbortSafeStream = {
      streamId,
      isolatedAbort,
      originalAbort: abortSignal || (new AbortController().signal as any),
      isUserInitiated,
      abortReason,
      markUserInitiated: () => {
        isUserInitiated = true;
      },
      abort: (reason: AbortReason = "user") => {
        abortReason = reason;
        isUserInitiated = true;
        isolatedAbort.abort(reason);
        onAbort?.(reason, streamId);
      },
      cleanup: () => {
        if (abortHandler && abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
      },
    };

    // Store reference
    this.streams.set(streamId, abortSafeStream);

    return abortSafeStream;
  }

  /**
   * Get an abort-safe stream by ID
   */
  getStream(streamId: string): AbortSafeStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Remove and cleanup an abort-safe stream
   */
  removeStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.cleanup();
      this.streams.delete(streamId);
    }
  }

  /**
   * Mark a stream as user-initiated (so aborts will propagate)
   */
  markUserInitiated(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.markUserInitiated();
    }
  }

  /**
   * Abort a stream (user-initiated)
   */
  abortStream(streamId: string, reason: AbortReason = "user"): boolean {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.abort(reason);
      return true;
    }
    return false;
  }

  /**
   * Clean up all streams
   */
  cleanup(): void {
    for (const [streamId, stream] of this.streams) {
      stream.cleanup();
    }
    this.streams.clear();
  }

  /**
   * Get all active stream IDs
   */
  getActiveStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalAbortSafeController: AbortSafeStreamController | undefined;

export function getGlobalAbortSafeController(): AbortSafeStreamController {
  if (!globalAbortSafeController) {
    globalAbortSafeController = new AbortSafeStreamController();
  }
  return globalAbortSafeController;
}

export function resetGlobalAbortSafeController(): void {
  if (globalAbortSafeController) {
    globalAbortSafeController.cleanup();
  }
  globalAbortSafeController = undefined;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap a stream with abort-safe handling
 */
export async function* wrapStreamWithAbortSafety<T>(
  stream: AsyncGenerator<T>,
  abortSafe: AbortSafeStream
): AsyncGenerator<T> {
  const { isolatedAbort, streamId } = abortSafe;

  try {
    // Check if already aborted
    if (isolatedAbort.signal.aborted) {
      throw new Error(`Stream ${streamId} was aborted before starting`);
    }

    // Yield chunks from stream
    for await (const chunk of stream) {
      // Check for abort before each chunk
      if (isolatedAbort.signal.aborted) {
        throw new Error(`Stream ${streamId} was aborted during generation`);
      }

      yield chunk;
    }
  } catch (error) {
    // Check if it's an abort error
    if (
      isolatedAbort.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error(`Stream ${streamId} aborted: ${abortSafe.abortReason || "unknown"}`);
    }
    throw error;
  }
}

/**
 * Create a timeout abort signal
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort("timeout"), timeoutMs);
  return controller.signal;
}

/**
 * Combine multiple abort signals (aborts if any signal aborts)
 */
export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }

    signal.addEventListener("abort", () => {
      controller.abort();
    });
  }

  return controller.signal;
}
