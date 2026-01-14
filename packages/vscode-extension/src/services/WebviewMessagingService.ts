/**
 * WebviewMessagingService - Type-safe communication between extension and webview
 * Handles request/response and event-based messaging patterns
 */

import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Message Protocol Definitions
// ============================================================================

/**
 * Request message types (request-response pattern)
 */
export type WebviewRequest =
  | ConfigRequest
  | ApiKeyRequest
  | ModelRequest
  | SessionRequest
  | IndexRequest
  | ChatRequest;

// Config Management
type ConfigRequest =
  | { type: "config/get"; requestId?: string }
  | { type: "config/update"; data: Partial<ErzencodeConfig>; requestId?: string }
  | { type: "config/reset"; requestId?: string }
  | { type: "config/validate"; data: unknown; requestId?: string }
  | { type: "config/openFile"; data: { type: "local" | "global" }; requestId?: string };

// API Key Management
type ApiKeyRequest =
  | { type: "apiKey/set"; data: { provider: string; key: string }; requestId?: string }
  | { type: "apiKey/get"; data: { provider: string }; requestId?: string }
  | { type: "apiKey/delete"; data: { provider: string }; requestId?: string }
  | { type: "apiKey/list"; requestId?: string }
  | { type: "apiKey/test"; data: { provider: string; key: string }; requestId?: string };

// Model Management
type ModelRequest =
  | { type: "models/listProviders"; requestId?: string }
  | { type: "models/getModels"; data: { provider: string }; requestId?: string }
  | { type: "models/search"; data: { provider: string; query: string }; requestId?: string }
  | { type: "models/preload"; requestId?: string };

// Session Management
type SessionRequest =
  | { type: "session/list"; requestId?: string }
  | { type: "session/load"; data: { sessionId: string }; requestId?: string }
  | { type: "session/create"; data: { name?: string }; requestId?: string }
  | { type: "session/update"; data: { sessionId: string; updates: Partial<SessionData> }; requestId?: string }
  | { type: "session/delete"; data: { sessionId: string }; requestId?: string }
  | { type: "session/export"; data: { sessionId: string; format: "json" | "markdown" }; requestId?: string }
  | { type: "session/import"; data: { data: string }; requestId?: string };

// Indexing
type IndexRequest =
  | { type: "index/getStatus"; requestId?: string }
  | { type: "index/start"; data: { voyageApiKey?: string }; requestId?: string }
  | { type: "index/search"; data: { query: string; limit?: number }; requestId?: string }
  | { type: "index/cancel"; requestId?: string };

// Chat
type ChatRequest =
  | { type: "chat/sendMessage"; data: { content: string; images?: string[] }; requestId?: string }
  | { type: "chat/stream"; data: { messageId: string }; requestId?: string }
  | { type: "chat/cancel"; data: { messageId: string }; requestId?: string };

/**
 * Response message types
 */
export interface WebviewResponse<T = unknown> {
  requestId: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

/**
 * Event message types (one-way fire-and-forget)
 */
export type WebviewEvent =
  | { type: "config/changed"; data: ErzencodeConfig }
  | { type: "apiKey/changed"; data: { provider: string; hasKey: boolean } }
  | { type: "models/loaded"; data: { provider: string; models: ModelInfo[] } }
  | { type: "session/created"; data: SessionData }
  | { type: "session/deleted"; data: { sessionId: string } }
  | { type: "index/progress"; data: IndexingProgress }
  | { type: "index/complete"; data: IndexResult }
  | { type: "stream/event"; data: StreamEvent }
  | { type: "error"; data: { message: string; code?: string } };

// ============================================================================
// Type Imports (these should match your core types)
// ============================================================================

export interface ErzencodeConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  workspaceRoot?: string;
  lockWorkspace?: boolean;
  mode?: string;
  renderer?: "raw" | "markdown";
  thinkingLevel?: "off" | "low" | "medium" | "high";
  allowUnknownModels?: boolean;
  theme?: string;
  sessions?: SessionData[];
  lastSessionId?: string;
  setupComplete?: boolean;
  firstRunAt?: number;
  dynamicModels?: boolean;
}

export interface SessionData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  provider?: string;
  model?: string;
  messages: any[];
}

export interface ModelInfo {
  id: string;
  name?: string;
  contextLength?: number;
  pricing?: { input: number; output: number };
  capabilities?: string[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  description?: string;
  baseUrl?: string;
  models?: string[];
}

export interface IndexingProgress {
  stage: string;
  current: number;
  total: number;
  currentFile?: string;
}

export interface IndexResult {
  filesIndexed: number;
  totalTime: number;
  indexSize: number;
}

export interface StreamEvent {
  type: string;
  data: any;
}

// ============================================================================
// Webview Messaging Service
// ============================================================================

export interface PendingRequest {
  resolve: (response: WebviewResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class WebviewMessagingService {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestHandlers: Map<string, (request: WebviewRequest) => Promise<unknown>> = new Map();
  private eventHandlers: Map<string, (event: WebviewEvent) => void> = new Map();
  private requestTimeout = 30000; // 30 seconds

  constructor(private webview: vscode.Webview) {
    this.setupMessageListener();
  }

  /**
   * Send a request to the webview and wait for response
   */
  async sendRequest<T = unknown>(request: WebviewRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = request.requestId || uuidv4();

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${request.type}`));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: (response: WebviewResponse) => {
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(new Error(response.error?.message || "Request failed"));
          }
        },
        reject,
        timeout,
      });

      // Send message
      this.webview.postMessage({
        ...request,
        requestId,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Send an event to the webview (fire-and-forget)
   */
  sendEvent(event: WebviewEvent): void {
    this.webview.postMessage({
      ...event,
      timestamp: Date.now(),
    });
  }

  /**
   * Register a handler for a specific request type
   */
  onRequest<T = unknown>(
    type: string,
    handler: (request: WebviewRequest) => Promise<T>
  ): vscode.Disposable {
    this.requestHandlers.set(type, handler as (request: WebviewRequest) => Promise<unknown>);

    return {
      dispose: () => {
        this.requestHandlers.delete(type);
      },
    };
  }

  /**
   * Register a handler for a specific event type
   */
  onEvent(
    type: string,
    handler: (event: WebviewEvent) => void
  ): vscode.Disposable {
    this.eventHandlers.set(type, handler);

    return {
      dispose: () => {
        this.eventHandlers.delete(type);
      },
    };
  }

  /**
   * Setup message listener from webview
   */
  private setupMessageListener(): void {
    this.webview.onDidReceiveMessage(async (message: WebviewRequest | WebviewResponse) => {
      // Check if this is a response
      if ("requestId" in message && "success" in message) {
        this.handleResponse(message as WebviewResponse);
        return;
      }

      // This is a request
      await this.handleRequest(message as WebviewRequest);
    });
  }

  /**
   * Handle response from webview
   */
  private handleResponse(response: WebviewResponse): void {
    const pending = this.pendingRequests.get(response.requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.requestId);
      pending.resolve(response);
    }
  }

  /**
   * Handle request from webview
   */
  private async handleRequest(request: WebviewRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.type);

    if (!handler) {
      // Send error response
      this.webview.postMessage({
        requestId: request.requestId || uuidv4(),
        success: false,
        error: {
          code: "NO_HANDLER",
          message: `No handler registered for request type: ${request.type}`,
        },
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const data = await handler(request);

      // Send success response
      this.webview.postMessage({
        requestId: request.requestId || uuidv4(),
        success: true,
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Send error response
      this.webview.postMessage({
        requestId: request.requestId || uuidv4(),
        success: false,
        error: {
          code: "HANDLER_ERROR",
          message: error instanceof Error ? error.message : String(error),
          details: error,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Emit an event to registered handlers
   */
  emit(event: WebviewEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers(event);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Clear all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Service disposed"));
    }
    this.pendingRequests.clear();

    // Clear handlers
    this.requestHandlers.clear();
    this.eventHandlers.clear();
  }
}

// ============================================================================
// Helper Types for Webview Side
// ============================================================================

/**
 * Helper class for webview side to communicate with extension
 * NOTE: This class should be used in the webview (browser) context, not in the extension host.
 * It will be bundled with the React app when we create the settings webview.
 */
export class WebviewExtensionMessenger {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private eventHandlers: Map<string, (event: WebviewEvent) => void> = new Map();
  private requestTimeout = 30000;

  constructor(private vscode: any) {
    // This will be initialized in the browser context
    // The setupMessageListener will be called when running in browser
  }

  /**
   * Send a request to extension and wait for response
   */
  async sendRequest<T = unknown>(request: WebviewRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = request.requestId || uuidv4();

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${request.type}`));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: (response: WebviewResponse) => {
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(new Error(response.error?.message || "Request failed"));
          }
        },
        reject,
        timeout,
      });

      // Send message
      this.vscode.postMessage({
        ...request,
        requestId,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Send an event to extension (fire-and-forget)
   */
  sendEvent(event: WebviewEvent): void {
    this.vscode.postMessage({
      ...event,
      timestamp: Date.now(),
    });
  }

  /**
   * Register a handler for events from extension
   */
  onEvent(type: string, handler: (event: WebviewEvent) => void): () => void {
    this.eventHandlers.set(type, handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.delete(type);
    };
  }

  /**
   * Handle response from extension
   */
  private handleResponse(response: WebviewResponse): void {
    const pending = this.pendingRequests.get(response.requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.requestId);
      pending.resolve(response);
    }
  }

  /**
   * Handle event from extension
   */
  private handleEvent(event: WebviewEvent): void {
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      handler(event);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Clear all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Messenger disposed"));
    }
    this.pendingRequests.clear();

    // Clear handlers
    this.eventHandlers.clear();
  }
}
