/**
 * Platform abstraction types for cross-platform compatibility
 * Allows the same core logic to run in Node.js (CLI) and VSCode extension
 */

// ============================================================================
// File System Types
// ============================================================================

export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime?: Date;
}

export interface ListOptions {
  recursive?: boolean;
  ignore?: string[];
}

export interface SearchResult {
  path: string;
  line?: number;
  column?: number;
  content?: string;
}

// ============================================================================
// Terminal Types
// ============================================================================

export interface TerminalResult {
  output: string;
  exitCode: number;
  error?: string;
}

export interface Terminal {
  show(): void;
  sendText(text: string): void;
  dispose(): void;
}

// ============================================================================
// Question Types
// ============================================================================

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionRequest {
  id: string;
  question: string;
  header: string;
  options: QuestionOption[];
  multiple: boolean;
  createdAt: number;
}

export interface QuestionResponse {
  requestId: string;
  answers: string[];
}
