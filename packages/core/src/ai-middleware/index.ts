/**
 * AI Middleware Module
 *
 * Production-ready middleware for Vercel AI SDK v6 with:
 * - Two-tier retry system (quick + long)
 * - Persistent request queue
 * - Per-provider rate limit tracking
 * - Stream recovery & abort safety
 *
 * @module ai-middleware
 */

// ============================================================================
// Rate Limit Tracker
// ============================================================================

export {
  RateLimitTracker,
  getGlobalRateLimitTracker,
  resetGlobalRateLimitTracker,
} from "./rate-limit-tracker.js";

export type {
  ProviderType,
  RateLimitInfo,
  WaitTimeInfo,
  RateLimitTrackerConfig,
} from "./rate-limit-tracker.js";

// ============================================================================
// Request Queue
// ============================================================================

export {
  RequestQueue,
  getGlobalRequestQueue,
  resetGlobalRequestQueue,
} from "./request-queue.js";

export type {
  RequestPriority,
  QueuedRequest,
  RequestQueueConfig,
  QueueStats,
} from "./request-queue.js";

// ============================================================================
// Stream Recovery
// ============================================================================

export {
  StreamRecoveryManager,
  getGlobalStreamRecoveryManager,
  resetGlobalStreamRecoveryManager,
  createResumableGenerator,
  mergeChunks,
} from "./stream-recovery.js";

export type {
  StreamRecoveryConfig,
  StreamHealthStatus,
} from "./stream-recovery.js";

// ============================================================================
// Abort Safe Stream
// ============================================================================

export {
  AbortSafeStreamController,
  getGlobalAbortSafeController,
  resetGlobalAbortSafeController,
  wrapStreamWithAbortSafety,
  createTimeoutSignal,
  combineAbortSignals,
} from "./abort-safe-stream.js";

export type {
  AbortReason,
  AbortSafeStream,
  AbortSafeConfig,
} from "./abort-safe-stream.js";
