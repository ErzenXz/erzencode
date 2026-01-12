/**
 * Session service for the Terminal UI.
 * Handles session creation, serialization, and management.
 */

import { ok, err, type Result } from "../../shared/result.js";
import type { SessionState, ChatMessage } from "../types/index.js";
import { generateId } from "../utils/format-utils.js";

/**
 * Error types for session operations.
 */
export interface SessionError {
  type: "not_found" | "invalid_state" | "serialization_failed";
  message: string;
}

/**
 * Session service interface.
 */
export interface SessionService {
  /** Create a new session */
  createSession: (workingDirectory: string, name?: string, provider?: string, model?: string) => SessionState;
  /** Serialize a session to JSON string */
  serializeSession: (session: SessionState) => Result<string, SessionError>;
  /** Deserialize a session from JSON string */
  deserializeSession: (data: string) => Result<SessionState, SessionError>;
  /** Merge messages into a session */
  mergeMessages: (existing: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[];
  /** Update a session's timestamp */
  touchSession: (session: SessionState) => SessionState;
  /** Add a message to a session */
  addMessage: (session: SessionState, message: ChatMessage) => SessionState;
  /** Update a message in a session */
  updateMessage: (session: SessionState, messageId: string, updates: Partial<ChatMessage>) => SessionState;
  /** Clear messages from a session */
  clearMessages: (session: SessionState) => SessionState;
}

/**
 * Creates a new session with default values.
 * @param workingDirectory - The working directory for the session
 * @param name - Optional session name
 * @param provider - Optional AI provider
 * @param model - Optional AI model
 * @returns A new session state
 */
export function createSession(
  workingDirectory: string,
  name?: string,
  provider: string = "openai",
  model: string = "gpt-4o"
): SessionState {
  const now = Date.now();
  return {
    id: generateId(),
    name: name ?? `Session ${new Date(now).toLocaleTimeString()}`,
    createdAt: now,
    updatedAt: now,
    workingDirectory,
    messages: [],
    provider: provider as SessionState["provider"],
    model,
  };
}

/**
 * Serializes a session to a JSON string.
 * @param session - The session to serialize
 * @returns Result with JSON string or error
 */
export function serializeSession(
  session: SessionState
): Result<string, SessionError> {
  try {
    const json = JSON.stringify(session, null, 2);
    return ok(json);
  } catch (e) {
    return err({
      type: "serialization_failed",
      message: `Failed to serialize session: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

/**
 * Deserializes a session from a JSON string.
 * @param data - The JSON string to deserialize
 * @returns Result with session state or error
 */
export function deserializeSession(
  data: string
): Result<SessionState, SessionError> {
  try {
    const parsed = JSON.parse(data);
    
    // Validate required fields
    if (!parsed.id || typeof parsed.id !== "string") {
      return err({
        type: "invalid_state",
        message: "Session missing required field: id",
      });
    }
    if (!parsed.name || typeof parsed.name !== "string") {
      return err({
        type: "invalid_state",
        message: "Session missing required field: name",
      });
    }
    if (!parsed.workingDirectory || typeof parsed.workingDirectory !== "string") {
      return err({
        type: "invalid_state",
        message: "Session missing required field: workingDirectory",
      });
    }
    if (!Array.isArray(parsed.messages)) {
      return err({
        type: "invalid_state",
        message: "Session missing required field: messages",
      });
    }

    const session: SessionState = {
      id: parsed.id,
      name: parsed.name,
      createdAt: parsed.createdAt ?? Date.now(),
      updatedAt: parsed.updatedAt ?? Date.now(),
      workingDirectory: parsed.workingDirectory,
      messages: parsed.messages,
      provider: parsed.provider ?? "openai",
      model: parsed.model ?? "gpt-4o",
    };

    return ok(session);
  } catch (e) {
    return err({
      type: "serialization_failed",
      message: `Failed to deserialize session: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

/**
 * Merges incoming messages with existing messages.
 * Updates existing messages by ID, appends new ones.
 * @param existing - Existing messages
 * @param incoming - Incoming messages to merge
 * @returns Merged message array
 */
export function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const result = [...existing];
  const existingIds = new Set(existing.map((m) => m.id));

  for (const msg of incoming) {
    if (existingIds.has(msg.id)) {
      // Update existing message
      const idx = result.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        result[idx] = { ...result[idx], ...msg };
      }
    } else {
      // Append new message
      result.push(msg);
    }
  }

  return result;
}

/**
 * Updates a session's timestamp to now.
 * @param session - The session to update
 * @returns Updated session
 */
export function touchSession(session: SessionState): SessionState {
  return {
    ...session,
    updatedAt: Date.now(),
  };
}

/**
 * Adds a message to a session.
 * @param session - The session to update
 * @param message - The message to add
 * @returns Updated session
 */
export function addMessage(
  session: SessionState,
  message: ChatMessage
): SessionState {
  return {
    ...session,
    messages: [...session.messages, message],
    updatedAt: Date.now(),
  };
}

/**
 * Updates a message in a session.
 * @param session - The session to update
 * @param messageId - ID of the message to update
 * @param updates - Partial message updates
 * @returns Updated session
 */
export function updateMessage(
  session: SessionState,
  messageId: string,
  updates: Partial<ChatMessage>
): SessionState {
  const messages = session.messages.map((m) =>
    m.id === messageId ? { ...m, ...updates } : m
  );
  return {
    ...session,
    messages,
    updatedAt: Date.now(),
  };
}

/**
 * Clears all messages from a session.
 * @param session - The session to clear
 * @returns Updated session with empty messages
 */
export function clearMessages(session: SessionState): SessionState {
  return {
    ...session,
    messages: [],
    updatedAt: Date.now(),
  };
}

/**
 * Creates a session service instance.
 * @returns Session service
 */
export function createSessionService(): SessionService {
  return {
    createSession,
    serializeSession,
    deserializeSession,
    mergeMessages,
    touchSession,
    addMessage,
    updateMessage,
    clearMessages,
  };
}
