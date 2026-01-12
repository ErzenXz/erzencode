/**
 * Central export point for all Terminal UI types.
 * Import types from this file for consistency.
 */

// Message types
export type {
  ThinkingPart,
  ActionPart,
  ToolPart,
  TextPart,
  ErrorPart,
  MessagePart,
  ChatMessage,
} from "./messages.js";

// Session types
export type { SessionState, FileInfo } from "./sessions.js";

// Tool types
export type {
  TodoItem,
  ToolDisplayConfig,
  ToolDisplayMap,
  RunningTool,
  BashApprovalPrompt,
} from "./tools.js";
export { TOOL_DISPLAY } from "./tools.js";

// UI state types
export type {
  Stage,
  ModalType,
  ThinkingLevel,
  SlashCommand,
  ThemeColors,
  AppState,
} from "./ui-state.js";
export {
  THINKING_LEVELS,
  THINKING_LEVEL_DESCRIPTIONS,
  MODE_COLORS,
  MODES,
  SLASH_COMMANDS,
} from "./ui-state.js";
