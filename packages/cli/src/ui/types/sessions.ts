/**
 * Session-related type definitions for the Terminal UI
 */

import type { ProviderType } from "@erzencode/core/ai-provider";
import type { ChatMessage } from "./messages.js";

/**
 * Represents a chat session with its complete state.
 * Sessions allow users to maintain multiple conversation contexts.
 */
export interface SessionState {
  /** Unique identifier for the session */
  id: string;
  /** User-friendly name for the session */
  name: string;
  /** When the session was created (Unix timestamp) */
  createdAt: number;
  /** When the session was last updated (Unix timestamp) */
  updatedAt: number;
  /** The working directory for this session */
  workingDirectory: string;
  /** All messages in this session */
  messages: ChatMessage[];
  /** The AI provider used for this session */
  provider: ProviderType;
  /** The AI model used for this session */
  model: string;
}

/**
 * Information about a file that has been accessed during the session.
 * Used to track which files the AI has read, written, or edited.
 */
export interface FileInfo {
  /** Path to the file */
  path: string;
  /** What action was performed on the file */
  action: "read" | "write" | "edit";
  /** When the action occurred (Unix timestamp) */
  timestamp: number;
}
