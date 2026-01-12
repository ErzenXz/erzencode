/**
 * Central export point for all Terminal UI services.
 * Import services from this file for consistency.
 */

// Tool formatters
export {
  formatToolInputSummary,
  formatToolOutput,
  getToolDisplayInfo,
  createToolFormatter,
  type FormattedOutput,
  type ToolFormatter,
} from "./tool-formatters.js";

// Command handler
export {
  parseCommand,
  getCompletions,
  isCommand,
  getCommand,
  resolveCommandName,
  validateCommandArgs,
  getCommandAction,
  createCommandHandler,
  type CommandError,
  type CommandAction,
  type CommandResult,
  type ParsedCommand,
  type CommandHandler,
} from "./command-handler.js";

// Session service
export {
  createSession,
  serializeSession,
  deserializeSession,
  mergeMessages,
  touchSession,
  addMessage,
  updateMessage,
  clearMessages,
  createSessionService,
  type SessionError,
  type SessionService,
} from "./session-service.js";
