/**
 * Command handler service for the Terminal UI.
 * Handles parsing and execution of slash commands.
 */

import { ok, err, type Result } from "../../shared/result.js";
import { SLASH_COMMANDS, type SlashCommand } from "../types/ui-state.js";

/**
 * Error types for command handling.
 */
export interface CommandError {
  type: "invalid_command" | "missing_args" | "execution_failed";
  message: string;
}

/**
 * Actions that can result from command execution.
 */
export type CommandAction =
  | { type: "openModal"; modal: string }
  | { type: "setMode"; mode: string }
  | { type: "navigate"; target: string }
  | { type: "exit" }
  | { type: "message"; text: string }
  | { type: "none" };

/**
 * Result of command execution.
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  action: CommandAction;
}

/**
 * Parsed command structure.
 */
export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

/**
 * Command handler interface.
 */
export interface CommandHandler {
  /** Parse a command string into command and arguments */
  parseCommand: (input: string) => ParsedCommand | null;
  /** Get autocomplete matches for a partial command */
  getCompletions: (partial: string) => SlashCommand[];
  /** Check if a string is a valid command */
  isCommand: (input: string) => boolean;
  /** Get command by name or alias */
  getCommand: (name: string) => SlashCommand | undefined;
}

/**
 * Parses a command string into command name and arguments.
 * @param input - The input string (should start with /)
 * @returns Parsed command or null if not a valid command
 */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);

  if (!command) {
    return null;
  }

  return {
    command,
    args,
    raw: trimmed,
  };
}

/**
 * Gets autocomplete matches for a partial command.
 * @param partial - The partial input (should start with /)
 * @returns Array of matching commands, sorted by relevance
 */
export function getCompletions(partial: string): SlashCommand[] {
  if (!partial.startsWith("/")) {
    return [];
  }

  if (partial === "/") {
    return SLASH_COMMANDS;
  }

  const query = partial.slice(1).toLowerCase();

  const matches = SLASH_COMMANDS.map((cmd) => {
    const name = cmd.name.toLowerCase();
    const aliases = (cmd.aliases ?? []).map((a) => a.toLowerCase());

    // Score based on match quality
    const namePrefix = name.startsWith(query) ? 3 : 0;
    const aliasPrefix = aliases.some((a) => a.startsWith(query)) ? 2 : 0;
    const nameIncludes = name.includes(query) ? 1 : 0;
    const aliasIncludes = aliases.some((a) => a.includes(query)) ? 1 : 0;

    const score = namePrefix + aliasPrefix + nameIncludes + aliasIncludes;
    return { cmd, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.cmd.name.localeCompare(b.cmd.name))
    .map((x) => x.cmd);

  return matches;
}

/**
 * Checks if a string is a valid command.
 * @param input - The input string
 * @returns True if the input is a recognized command
 */
export function isCommand(input: string): boolean {
  const parsed = parseCommand(input);
  if (!parsed) return false;
  return getCommand(parsed.command) !== undefined;
}

/**
 * Gets a command by name or alias.
 * @param name - Command name or alias
 * @returns The command definition or undefined
 */
export function getCommand(name: string): SlashCommand | undefined {
  const lower = name.toLowerCase();
  return SLASH_COMMANDS.find(
    (cmd) =>
      cmd.name.toLowerCase() === lower ||
      cmd.aliases?.some((a) => a.toLowerCase() === lower)
  );
}

/**
 * Resolves a command name or alias to the canonical command name.
 * @param nameOrAlias - Command name or alias
 * @returns Canonical command name or undefined
 */
export function resolveCommandName(nameOrAlias: string): string | undefined {
  const cmd = getCommand(nameOrAlias);
  return cmd?.name;
}

/**
 * Validates command arguments.
 * @param command - Command name
 * @param args - Command arguments
 * @returns Result with validation status
 */
export function validateCommandArgs(
  command: string,
  args: string[]
): Result<void, CommandError> {
  const cmd = getCommand(command);
  if (!cmd) {
    return err({
      type: "invalid_command",
      message: `Unknown command: ${command}`,
    });
  }

  // Commands that require arguments
  const requiresArgs: Record<string, number> = {
    image: 1,
    bash: 1,
  };

  const required = requiresArgs[cmd.name];
  if (required !== undefined && args.length < required) {
    return err({
      type: "missing_args",
      message: `Command /${cmd.name} requires ${required} argument(s)`,
    });
  }

  return ok(undefined);
}

/**
 * Gets the action type for a command.
 * @param command - Command name
 * @returns The action type for the command
 */
export function getCommandAction(command: string): CommandAction {
  const resolved = resolveCommandName(command);
  if (!resolved) {
    return { type: "none" };
  }

  switch (resolved) {
    case "help":
      return { type: "openModal", modal: "help" };
    case "models":
      return { type: "openModal", modal: "models" };
    case "sessions":
      return { type: "openModal", modal: "sessions" };
    case "settings":
      return { type: "openModal", modal: "settings" };
    case "theme":
      return { type: "openModal", modal: "theme" };
    case "thinking":
      return { type: "openModal", modal: "thinking" };
    case "provider":
      return { type: "openModal", modal: "provider" };
    case "web":
      return { type: "navigate", target: "web" };
    case "vibe":
      return { type: "navigate", target: "vibe" };
    case "exit":
      return { type: "exit" };
    default:
      return { type: "none" };
  }
}

/**
 * Creates a command handler instance.
 * @returns Command handler
 */
export function createCommandHandler(): CommandHandler {
  return {
    parseCommand,
    getCompletions,
    isCommand,
    getCommand,
  };
}
