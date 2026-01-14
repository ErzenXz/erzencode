/**
 * Tool-related type definitions for the Terminal UI
 */

import type { TodoItem } from "@erzencode/core/tools";

// Re-export TodoItem for convenience
export type { TodoItem };

/**
 * Display configuration for a tool.
 * Defines how a tool should be rendered in the UI.
 */
export interface ToolDisplayConfig {
  /** Human-readable label for the tool */
  label: string;
  /** Icon character to display */
  icon: string;
}

/**
 * Map of tool names to their display configurations.
 */
export type ToolDisplayMap = Record<string, ToolDisplayConfig>;

/**
 * Default tool display configurations.
 */
export const TOOL_DISPLAY: ToolDisplayMap = {
  read: { label: "Read", icon: "◔" },
  read_file: { label: "Read", icon: "◔" },
  write: { label: "Write", icon: "◑" },
  write_file: { label: "Write", icon: "◑" },
  edit: { label: "Edit", icon: "◐" },
  edit_file: { label: "Edit", icon: "◐" },
  glob: { label: "Glob", icon: "◉" },
  grep: { label: "Grep", icon: "⊛" },
  list: { label: "List", icon: "▤" },
  list_directory: { label: "List", icon: "▤" },
  file_tree: { label: "Tree", icon: "▤" },
  bash: { label: "Bash", icon: "▶" },
  execute_command: { label: "Bash", icon: "▶" },
  task: { label: "Task", icon: "◈" },
  todowrite: { label: "Todo", icon: "☐" },
  todoread: { label: "Todo", icon: "☐" },
  todo: { label: "Todo", icon: "☐" },
  webfetch: { label: "Fetch", icon: "⊕" },
  exa_web_search: { label: "Search", icon: "⊗" },
  exa_code_search: { label: "Code", icon: "⊘" },
};

/**
 * Represents a running tool in the UI.
 */
export interface RunningTool {
  /** Unique identifier for the tool execution */
  id: string;
  /** Name of the tool */
  name: string;
}

/**
 * Bash approval prompt state.
 */
export interface BashApprovalPrompt {
  /** Unique identifier for the approval request */
  approvalId: string;
  /** The command requesting approval */
  command: string;
  /** Working directory for the command */
  workdir: string;
}
