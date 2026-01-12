/**
 * Central export point for all Terminal UI utilities.
 * Import utilities from this file for consistency.
 */

// Text manipulation utilities
export {
  truncate,
  truncatePath,
  stripAnsi,
  wrapText,
  wrapAnsiText,
} from "./text-utils.js";

// Formatting utilities
export {
  generateId,
  formatTokens,
  formatTime,
  clamp,
  getToolDisplayName,
  formatBytes,
  formatRelativeTime,
} from "./format-utils.js";

// Charm TUI - Beautiful terminal styling integration with Ink
export * from "./charm-ink.js";
