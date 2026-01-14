/**
 * Request Queue
 *
 * Persistent disk-backed queue for long-duration retries (30+ minutes).
 * Handles network outages, long rate limits, and other extended retry scenarios.
 *
 * Features:
 * - Persists across process restarts
 * - Priority-based processing (high/normal/low)
 * - Configurable retry intervals
 * - Automatic queue processor
 * - Manual inspection APIs
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ProviderType } from "./rate-limit-tracker.js";

// ============================================================================
// Types
// ============================================================================

export type RequestPriority = "high" | "normal" | "low";

export interface QueuedRequest {
  id: string;
  timestamp: number;
  retryAt: number; // Unix timestamp when to retry
  attemptNumber: number;
  priority: RequestPriority;

  // Request details
  provider: ProviderType;
  model: string;
  operation: "generate" | "stream";
  params: {
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    tools?: Record<string, any>;
    maxTokens?: number;
    temperature?: number;
    [key: string]: any;
  };

  // Error tracking
  lastError?: {
    code: string;
    message: string;
    statusCode?: number;
    timestamp: number;
  };

  // Status
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";

  // Metadata
  metadata?: {
    sessionId?: string;
    userId?: string;
    [key: string]: any;
  };
}

export interface RequestQueueConfig {
  enabled: boolean;
  maxQueueSize: number;
  maxRetryDuration: number; // 30 minutes in ms
  persistPath: string;
  processorIntervalMs: number;
  retryIntervals: number[]; // Configurable retry intervals
  onQueued?: (requestId: string, retryAt: number) => void;
  onProcessed?: (requestId: string, success: boolean, result?: any) => void;
  onFailed?: (requestId: string, error: Error) => void;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  byPriority: Record<RequestPriority, number>;
  oldestRequest?: {
    id: string;
    age: number; // milliseconds
    retryAt: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_REQUEST_QUEUE_CONFIG: RequestQueueConfig = {
  enabled: true,
  maxQueueSize: 100,
  maxRetryDuration: 1800000, // 30 minutes
  persistPath: join(homedir(), ".erzencode", "request-queue"),
  processorIntervalMs: 30000, // Process every 30 seconds
  retryIntervals: [
    60000, // 1 minute
    120000, // 2 minutes
    300000, // 5 minutes
    600000, // 10 minutes
    900000, // 15 minutes
    1200000, // 20 minutes
    1500000, // 25 minutes
    1800000, // 30 minutes
  ],
};

// ============================================================================
// Request Queue Implementation
// ============================================================================

export class RequestQueue {
  private queue = new Map<string, QueuedRequest>();
  private config: RequestQueueConfig;
  private processorTimer?: NodeJS.Timeout;
  private isProcessing = false;
  private persistPath: string;

  // Processor hook - set externally to handle queued requests
  public requestProcessor?: (request: QueuedRequest) => Promise<any>;

  constructor(config: Partial<RequestQueueConfig> = {}) {
    this.config = { ...DEFAULT_REQUEST_QUEUE_CONFIG, ...config };
    this.persistPath = this.config.persistPath;

    // Ensure directory exists
    this.ensureDirectory();

    // Load existing queue from disk
    this.loadFromDisk();

    // Start processor if enabled
    if (this.config.enabled) {
      this.startProcessor();
    }
  }

  // ============================================================================
  // Public API - Queue Management
  // ============================================================================

  /**
   * Add a request to the queue
   */
  enqueue(request: Omit<QueuedRequest, "id" | "timestamp" | "status">): string {
    if (!this.config.enabled) {
      throw new Error("Request queue is disabled");
    }

    // Check queue size
    if (this.queue.size >= this.config.maxQueueSize) {
      // Remove oldest low-priority request
      this.removeOldestRequest("low");
    }

    // Create request
    const id = this.generateId();
    const queuedRequest: QueuedRequest = {
      ...request,
      id,
      timestamp: Date.now(),
      status: "pending",
    };

    // Add to queue
    this.queue.set(id, queuedRequest);

    // Persist to disk
    this.saveRequestToDisk(id, queuedRequest);

    // Callback
    this.config.onQueued?.(id, queuedRequest.retryAt);

    return id;
  }

  /**
   * Remove a request from the queue
   */
  dequeue(requestId: string): boolean {
    const removed = this.queue.delete(requestId);
    if (removed) {
      this.deleteRequestFromDisk(requestId);
    }
    return removed;
  }

  /**
   * Get a request by ID
   */
  getRequest(requestId: string): QueuedRequest | undefined {
    return this.queue.get(requestId);
  }

  /**
   * Get all requests
   */
  getAllRequests(): QueuedRequest[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get pending requests (ready to retry)
   */
  getPendingRequests(): QueuedRequest[] {
    const now = Date.now();
    return this.getAllRequests().filter(
      (req) => req.status === "pending" && req.retryAt <= now
    );
  }

  /**
   * Get requests by status
   */
  getRequestsByStatus(status: QueuedRequest["status"]): QueuedRequest[] {
    return this.getAllRequests().filter((req) => req.status === status);
  }

  /**
   * Get requests by priority
   */
  getRequestsByPriority(priority: RequestPriority): QueuedRequest[] {
    return this.getAllRequests().filter((req) => req.priority === priority);
  }

  /**
   * Update request status
   */
  updateStatus(
    requestId: string,
    status: QueuedRequest["status"],
    result?: any,
    error?: Error
  ): void {
    const request = this.queue.get(requestId);
    if (!request) return;

    request.status = status;

    // Update retry timestamp for pending requests
    if (status === "pending") {
      const nextInterval = this.config.retryIntervals[request.attemptNumber] ||
                          this.config.retryIntervals[this.config.retryIntervals.length - 1];
      request.retryAt = Date.now() + nextInterval;
    }

    // Save to disk
    this.saveRequestToDisk(requestId, request);

    // Callbacks
    if (status === "completed") {
      this.config.onProcessed?.(requestId, true, result);
      // Remove from queue after completion
      setTimeout(() => this.dequeue(requestId), 60000); // Keep for 1 minute
    } else if (status === "failed") {
      this.config.onFailed?.(requestId, error || new Error("Unknown error"));
      this.config.onProcessed?.(requestId, false);
      // Keep failed requests for inspection
    }
  }

  /**
   * Cancel a request
   */
  cancel(requestId: string): boolean {
    const request = this.queue.get(requestId);
    if (!request || request.status !== "pending") {
      return false;
    }

    this.updateStatus(requestId, "cancelled");
    this.dequeue(requestId);
    return true;
  }

  /**
   * Retry a failed request immediately
   */
  async retry(requestId: string): Promise<boolean> {
    const request = this.queue.get(requestId);
    if (!request || request.status !== "failed") {
      return false;
    }

    // Reset to pending with immediate retry
    request.status = "pending";
    request.retryAt = Date.now();
    request.attemptNumber++;
    request.lastError = undefined;

    this.saveRequestToDisk(requestId, request);

    // Trigger immediate processing
    if (this.requestProcessor) {
      try {
        const result = await this.requestProcessor(request);
        this.updateStatus(requestId, "completed", result);
        return true;
      } catch (error) {
        this.updateStatus(requestId, "failed", undefined, error as Error);
        return false;
      }
    }

    return false;
  }

  /**
   * Clear all completed/failed/cancelled requests
   */
  clearFinished(): number {
    let cleared = 0;
    for (const [id, request] of this.queue) {
      if (
        request.status === "completed" ||
        request.status === "failed" ||
        request.status === "cancelled"
      ) {
        this.dequeue(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Clear all requests
   */
  clear(): number {
    const count = this.queue.size;
    this.queue.clear();
    this.clearDisk();
    return count;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const requests = this.getAllRequests();
    const now = Date.now();

    const stats: QueueStats = {
      total: requests.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      byPriority: {
        high: 0,
        normal: 0,
        low: 0,
      },
    };

    let oldestRequest: QueuedRequest | undefined;

    for (const request of requests) {
      // Count by status
      stats[request.status]++;

      // Count by priority
      stats.byPriority[request.priority]++;

      // Track oldest pending request
      if (
        request.status === "pending" &&
        (!oldestRequest || request.retryAt < oldestRequest.retryAt)
      ) {
        oldestRequest = request;
      }
    }

    // Add oldest request info
    if (oldestRequest) {
      stats.oldestRequest = {
        id: oldestRequest.id,
        age: now - oldestRequest.timestamp,
        retryAt: oldestRequest.retryAt,
      };
    }

    return stats;
  }

  // ============================================================================
  // Processor
  // ============================================================================

  /**
   * Start the automatic queue processor
   */
  startProcessor(): void {
    if (this.processorTimer) {
      return; // Already running
    }

    this.processorTimer = setInterval(async () => {
      if (!this.isProcessing && this.requestProcessor) {
        await this.processPendingRequests();
      }
    }, this.config.processorIntervalMs);
  }

  /**
   * Stop the automatic queue processor
   */
  stopProcessor(): void {
    if (this.processorTimer) {
      clearInterval(this.processorTimer);
      this.processorTimer = undefined;
    }
  }

  /**
   * Process all pending requests that are ready
   */
  async processPendingRequests(): Promise<void> {
    if (!this.requestProcessor || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending requests sorted by priority and retry time
      const pending = this.getPendingRequests().sort((a, b) => {
        // First by priority
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by retry time
        return a.retryAt - b.retryAt;
      });

      // Process each request
      for (const request of pending) {
        // Skip if already being processed
        if (request.status !== "pending") continue;

        // Check if we've exceeded max retry duration
        const age = Date.now() - request.timestamp;
        if (age > this.config.maxRetryDuration) {
          this.updateStatus(
            request.id,
            "failed",
            undefined,
            new Error(`Max retry duration (${this.config.maxRetryDuration}ms) exceeded`)
          );
          continue;
        }

        // Mark as processing
        this.updateStatus(request.id, "processing");

        try {
          // Process the request
          const result = await this.requestProcessor(request);
          this.updateStatus(request.id, "completed", result);
        } catch (error) {
          // Mark as pending again for retry
          request.lastError = {
            code: (error as any).code || "UNKNOWN",
            message: (error as Error).message,
            statusCode: (error as any).statusCode,
            timestamp: Date.now(),
          };

          // Increment attempt number
          request.attemptNumber++;

          // Check if we've exhausted retries
          const maxRetries = this.config.retryIntervals.length;
          if (request.attemptNumber >= maxRetries) {
            this.updateStatus(request.id, "failed", undefined, error as Error);
          } else {
            this.updateStatus(request.id, "pending");
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private removeOldestRequest(priority: RequestPriority): void {
    let oldestId: string | undefined;
    let oldestTimestamp = Infinity;

    for (const [id, request] of this.queue) {
      if (
        request.priority === priority &&
        request.status === "pending" &&
        request.timestamp < oldestTimestamp
      ) {
        oldestId = id;
        oldestTimestamp = request.timestamp;
      }
    }

    if (oldestId) {
      this.dequeue(oldestId);
    }
  }

  private ensureDirectory(): void {
    if (!existsSync(this.persistPath)) {
      mkdirSync(this.persistPath, { recursive: true });
    }
  }

  private getRequestFilePath(id: string): string {
    return join(this.persistPath, `${id}.json`);
  }

  private saveRequestToDisk(id: string, request: QueuedRequest): void {
    try {
      this.ensureDirectory();
      const filePath = this.getRequestFilePath(id);
      writeFileSync(filePath, JSON.stringify(request, null, 2), "utf-8");
    } catch (error) {
      console.error(`Failed to save request ${id} to disk:`, error);
    }
  }

  private deleteRequestFromDisk(id: string): void {
    try {
      const filePath = this.getRequestFilePath(id);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to delete request ${id} from disk:`, error);
    }
  }

  private loadFromDisk(): void {
    try {
      this.ensureDirectory();
      const files = readdirSync(this.persistPath).filter((f) =>
        f.endsWith(".json")
      );

      for (const file of files) {
        try {
          const filePath = join(this.persistPath, file);
          const content = readFileSync(filePath, "utf-8");
          const request = JSON.parse(content) as QueuedRequest;

          // Clean up old completed/failed requests
          const age = Date.now() - request.timestamp;
          const isOld = age > 3600000; // 1 hour

          if (
            isOld &&
            (request.status === "completed" ||
              request.status === "failed" ||
              request.status === "cancelled")
          ) {
            this.deleteRequestFromDisk(request.id);
            continue;
          }

          // Load into memory
          this.queue.set(request.id, request);
        } catch (error) {
          console.error(`Failed to load request from ${file}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to load request queue from disk:", error);
    }
  }

  private clearDisk(): void {
    try {
      const files = readdirSync(this.persistPath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = join(this.persistPath, file);
          unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error("Failed to clear request queue from disk:", error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalRequestQueue: RequestQueue | undefined;

export function getGlobalRequestQueue(): RequestQueue {
  if (!globalRequestQueue) {
    globalRequestQueue = new RequestQueue();
  }
  return globalRequestQueue;
}

export function resetGlobalRequestQueue(): void {
  if (globalRequestQueue) {
    globalRequestQueue.stopProcessor();
    globalRequestQueue.clear();
  }
  globalRequestQueue = undefined;
}
