import type { ProviderType } from "../ai-provider.js";
import type { AgentMode as CodingAgentMode } from "../ai-agent.js";
import type { TodoItem } from "../tools-standalone.js";

export type Stage = "welcome" | "chat";
export type ModalType =
  | "none"
  | "models"
  | "sessions"
  | "settings"
  | "help"
  | "provider"
  | "theme"
  | "thinking"
  | "apikey"
  | "copilot-oauth";
export type ThinkingLevel = "off" | "low" | "medium" | "high";

export const THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "low",
  "medium",
  "high",
];

export const THINKING_LEVEL_DESCRIPTIONS: Record<ThinkingLevel, string> = {
  off: "Disabled - No extended thinking",
  low: "Low (~1K tokens) - Quick reasoning",
  medium: "Medium (~4K tokens) - Balanced",
  high: "High (~16K tokens) - Deep reasoning",
};

export interface ThinkingPart {
  type: "thinking";
  content: string;
}

export interface ActionPart {
  type: "action";
  content: string;
}

export interface ToolPart {
  type: "tool";
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  output?: string;
  status: "running" | "done" | "error";
}

export interface TextPart {
  type: "text";
  content: string;
}

export interface ErrorPart {
  type: "error";
  content: string;
}

export type MessagePart =
  | ThinkingPart
  | ActionPart
  | ToolPart
  | TextPart
  | ErrorPart;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  parts?: MessagePart[];
}

export interface FileInfo {
  path: string;
  action: "read" | "write" | "edit";
  timestamp: number;
}

export interface SessionState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  messages: ChatMessage[];
  provider: ProviderType;
  model: string;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
}

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
  todos: TodoItem[];
  activeFiles: Map<string, FileInfo>;
  sessionTokens: number;
  scrollOffset: number;
  runningTools: Array<{ id: string; name: string }>;
  elapsedTime: number;
}

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

export const MODE_COLORS: Record<CodingAgentMode, string> = {
  plan: "yellow",
  agent: "blue",
  ask: "green",
};

export const MODES: CodingAgentMode[] = ["plan", "agent", "ask"];

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "help", aliases: ["h", "?"], description: "Show help and shortcuts" },
  { name: "models", aliases: ["m"], description: "Select AI model" },
  { name: "sessions", aliases: ["s"], description: "Manage sessions" },
  { name: "settings", description: "View/change settings" },
  { name: "theme", description: "Select theme" },
  { name: "thinking", aliases: ["t"], description: "Set thinking level" },
  { name: "web", description: "Open web UI" },
  { name: "vibe", aliases: ["v"], description: "Open Vibe mode (visual builder)" },
  { name: "provider", aliases: ["p"], description: "Switch provider" },
  { name: "bash", description: "Manage bash tool approvals (yolo/allow/allow-once)" },
  {
    name: "image",
    aliases: ["img", "attach"],
    description: "Attach image (path)",
  },
  { name: "compact", description: "Compact context (summarize conversation)" },
  { name: "new", aliases: ["n"], description: "Create new session" },
  { name: "reset", aliases: ["r"], description: "Reset current session" },
  { name: "clear", aliases: ["c"], description: "Clear messages" },
  { name: "save", description: "Save configuration" },
  { name: "exit", aliases: ["quit", "q"], description: "Exit erzencode" },
];
