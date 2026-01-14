/**
 * UI state type definitions for the Terminal UI
 */

import type { ProviderType } from "@erzencode/core/ai-provider";
import type { AgentMode as CodingAgentMode } from "@erzencode/core/ai-agent";
import type { SessionState, FileInfo } from "./sessions.js";
import type { RunningTool } from "./tools.js";

/**
 * Application stage - which screen is currently displayed.
 */
export type Stage = "welcome" | "chat";

/**
 * Modal type - which modal (if any) is currently open.
 */
export type ModalType =
  | "none"
  | "models"
  | "sessions"
  | "messages"
  | "rewind"
  | "settings"
  | "help"
  | "provider"
  | "theme"
  | "thinking"
  | "apikey"
  | "copilot-oauth"
  | "index"
  | "search";

/**
 * Thinking level for AI reasoning.
 * Controls how much "thinking" the AI does before responding.
 */
export type ThinkingLevel = "off" | "low" | "medium" | "high";

/**
 * Available thinking levels in order.
 */
export const THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "low",
  "medium",
  "high",
];

/**
 * Human-readable descriptions for each thinking level.
 */
export const THINKING_LEVEL_DESCRIPTIONS: Record<ThinkingLevel, string> = {
  off: "Disabled - No extended thinking",
  low: "Low (~1K tokens) - Quick reasoning",
  medium: "Medium (~4K tokens) - Balanced",
  high: "High (~16K tokens) - Deep reasoning",
};

/**
 * Color mapping for each agent mode.
 */
export const MODE_COLORS: Record<CodingAgentMode, string> = {
  plan: "yellow",
  agent: "blue",
  ask: "green",
};

/**
 * Available agent modes.
 */
export const MODES: CodingAgentMode[] = ["plan", "agent", "ask"];

/**
 * Slash command definition.
 */
export interface SlashCommand {
  /** Primary command name */
  name: string;
  /** Alternative names for the command */
  aliases?: string[];
  /** Description shown in help/autocomplete */
  description: string;
}

/**
 * Available slash commands.
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "help", aliases: ["h", "?"], description: "Show help and shortcuts" },
  { name: "models", aliases: ["m"], description: "Select AI model" },
  { name: "sessions", aliases: ["s"], description: "Manage sessions" },
  { name: "messages", aliases: ["msgs"], description: "Jump to a user message" },
  { name: "settings", description: "View/change settings" },
  { name: "theme", description: "Select theme" },
  { name: "thinking", aliases: ["t"], description: "Set thinking level" },
  { name: "web", description: "Open web UI" },
  { name: "vibe", aliases: ["v"], description: "Open Vibe mode (visual builder)" },
  { name: "provider", aliases: ["p"], description: "Switch provider" },
  { name: "bash", description: "Manage bash tool approvals (yolo/allow/allow-once)" },
  { name: "cost", description: "Show estimated token cost for this session" },
  {
    name: "image",
    aliases: ["img", "attach"],
    description: "Attach image (path)",
  },
  { name: "compact", description: "Compact context (summarize conversation)" },
  { name: "index", aliases: ["idx"], description: "Index codebase for semantic search" },
  { name: "indexstatus", aliases: ["idxs"], description: "Show semantic index status/details" },
  { name: "search", description: "Search indexed codebase semantically" },
  { name: "new", aliases: ["n"], description: "Create new session" },
  { name: "reset", aliases: ["r"], description: "Reset current session" },
  { name: "clear", aliases: ["c"], description: "Clear messages" },
  { name: "rewind", aliases: ["undo"], description: "Rewind session to a checkpoint" },
  { name: "save", description: "Save configuration" },
  { name: "exit", aliases: ["quit", "q"], description: "Exit erzencode" },
];

/**
 * Theme color definitions.
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  user: string;
  assistant: string;
  tool: string;
}

/**
 * Complete application state.
 * Used for state management and persistence.
 */
export interface AppState {
  stage: Stage;
  activeModal: ModalType;
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  thinking: ThinkingLevel;
  sessions: SessionState[];
  currentSessionId: string;
  input: string;
  status: string;
  isThinking: boolean;
  todos: import("@erzencode/core/tools").TodoItem[];
  activeFiles: Map<string, FileInfo>;
  sessionTokens: number;
  scrollOffset: number;
  runningTools: RunningTool[];
  elapsedTime: number;
}
