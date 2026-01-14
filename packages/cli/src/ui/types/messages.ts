/**
 * Message-related type definitions for the Terminal UI
 */

/**
 * Represents a thinking/reasoning part of an assistant message.
 * Contains the AI's internal reasoning process.
 */
export interface ThinkingPart {
  type: "thinking";
  /** The thinking/reasoning content */
  content: string;
}

/**
 * Represents an action description part.
 * Describes what action the AI is taking.
 */
export interface ActionPart {
  type: "action";
  /** The action description */
  content: string;
}

/**
 * Represents a tool invocation part.
 * Contains information about a tool call and its result.
 */
export interface ToolPart {
  type: "tool";
  /** Unique identifier for the tool call */
  id?: string;
  /** Name of the tool being invoked */
  name: string;
  /** Arguments passed to the tool */
  args?: Record<string, unknown>;
  /** Output from the tool execution */
  output?: string;
  /** Current status of the tool execution */
  status: "running" | "done" | "error";
  /** Nested tool calls from subagents (for task tool) */
  children?: ToolPart[];
}

/**
 * Represents a text content part.
 * Contains plain text or markdown content.
 */
export interface TextPart {
  type: "text";
  /** The text content */
  content: string;
}

/**
 * Represents an error part.
 * Contains error information to display to the user.
 */
export interface ErrorPart {
  type: "error";
  /** The error message */
  content: string;
}

/**
 * Union type of all possible message parts.
 * A message can contain multiple parts of different types.
 */
export type MessagePart =
  | ThinkingPart
  | ActionPart
  | ToolPart
  | TextPart
  | ErrorPart;

/**
 * Represents a chat message in the conversation.
 * Can be from the user, assistant, or system.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Who sent the message */
  role: "user" | "assistant" | "system";
  /** The main text content of the message */
  content: string;
  /** When the message was created (Unix timestamp) */
  timestamp: number;
  /** Whether the message is still being streamed */
  isStreaming?: boolean;
  /** Structured parts of the message (for assistant messages) */
  parts?: MessagePart[];
}
