/**
 * Tool formatting service for the Terminal UI.
 * Provides pure functions for formatting tool inputs and outputs.
 */

import { TOOL_DISPLAY, type ToolDisplayConfig } from "../types/tools.js";

/**
 * Maximum number of output lines to display.
 */
const MAX_OUTPUT_LINES = 6;

/**
 * Formatted output from a tool execution.
 */
export interface FormattedOutput {
  /** Lines of output to display */
  lines: string[];
  /** Whether the output represents an error */
  isError: boolean;
  /** Optional markdown content (e.g., for diffs) */
  markdown?: string;
}

/**
 * Tool formatter interface.
 */
export interface ToolFormatter {
  /** Format a summary of tool input for display */
  formatInputSummary: (name: string, args: Record<string, unknown> | undefined) => string;
  /** Format tool output for display */
  formatOutput: (name: string, output: string) => FormattedOutput;
  /** Get display configuration for a tool */
  getDisplayInfo: (name: string) => ToolDisplayConfig;
}

/**
 * Truncates a string to the specified length.
 */
function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/**
 * Makes a path relative to the workspace root.
 */
function relativePath(filePath: string, workspaceRoot?: string): string {
  if (!filePath) return "";
  if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
    const rel = filePath.slice(workspaceRoot.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

/**
 * Formats tool input into a summary string.
 * @param name - Tool name
 * @param args - Tool arguments
 * @param workspaceRoot - Optional workspace root for path relativization
 * @returns Summary string
 */
export function formatToolInputSummary(
  name: string,
  args: Record<string, unknown> | undefined,
  workspaceRoot?: string
): string {
  if (!args) return "";

  switch (name) {
    case "read":
    case "read_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot
      );
      const offset = args.offset ? `:${args.offset}` : "";
      return path + offset;
    }
    case "write":
    case "write_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot
      );
      const lines = String(args.content || "").split("\n").length;
      return `${path} (${lines} lines)`;
    }
    case "edit":
    case "edit_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot
      );
      const replaceAll = args.replaceAll ? " (all)" : "";
      return path + replaceAll;
    }
    case "bash":
    case "execute_command": {
      const desc = String(args.description || "");
      return desc || "";
    }
    case "grep": {
      const pattern = String(args.pattern || "");
      const include = args.include ? ` (${args.include})` : "";
      return `"${truncate(pattern, 30)}"${include}`;
    }
    case "glob": {
      const pattern = String(args.pattern || "");
      return `"${pattern}"`;
    }
    case "task": {
      const desc = String(args.description || "");
      const type = args.subagent_type ? `[${args.subagent_type}] ` : "";
      return type + desc;
    }
    case "todowrite":
    case "todo": {
      const todos = args.todos as Array<{ content: string }> | undefined;
      return todos ? `${todos.length} items` : "";
    }
    case "webfetch": {
      const url = String(args.url || "");
      try {
        const hostname = new URL(url).hostname;
        return hostname;
      } catch {
        return truncate(url, 40);
      }
    }
    default:
      return "";
  }
}

/**
 * Formats tool output for display.
 * @param name - Tool name
 * @param output - Raw output string
 * @param workspaceRoot - Optional workspace root for path relativization
 * @returns Formatted output
 */
export function formatToolOutput(
  name: string,
  output: string,
  workspaceRoot?: string
): FormattedOutput {
  if (!output) return { lines: [], isError: false };

  const isOutputError =
    output.startsWith("Error:") || output.includes('"success":false');

  // Try to parse JSON
  let parsed: Record<string, unknown> | null = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch {
      /* not JSON */
    }
  }

  if (parsed) {
    if (parsed.success === false) {
      return {
        lines: [String(parsed.error || "Failed")],
        isError: true,
      };
    }

    switch (name) {
      case "edit":
      case "edit_file": {
        const stats: string[] = [];
        if (typeof parsed.linesAdded === "number" && parsed.linesAdded > 0) {
          stats.push(`+${parsed.linesAdded}`);
        }
        if (typeof parsed.linesRemoved === "number" && parsed.linesRemoved > 0) {
          stats.push(`-${parsed.linesRemoved}`);
        }
        const patch = typeof parsed.patch === "string" ? parsed.patch : "";
        const patchTruncated = Boolean(parsed.patchTruncated);
        return {
          lines: [stats.join(" ") || "applied"].filter(Boolean),
          markdown: patch
            ? `\n\n\`\`\`diff\n${patch}${patchTruncated ? "\n\\ No newline at end of truncated patch" : ""}\n\`\`\`\n`
            : undefined,
          isError: false,
        };
      }
      case "write":
      case "write_file": {
        const stats: string[] = [];
        if (typeof parsed.linesAdded === "number" && parsed.linesAdded > 0) {
          stats.push(`+${parsed.linesAdded}`);
        }
        if (typeof parsed.linesRemoved === "number" && parsed.linesRemoved > 0) {
          stats.push(`-${parsed.linesRemoved}`);
        }
        const patch = typeof parsed.patch === "string" ? parsed.patch : "";
        const patchTruncated = Boolean(parsed.patchTruncated);
        return {
          lines: [`${parsed.lines} lines written`, ...stats].filter(Boolean),
          markdown: patch
            ? `\n\n\`\`\`diff\n${patch}${patchTruncated ? "\n\\ No newline at end of truncated patch" : ""}\n\`\`\`\n`
            : undefined,
          isError: false,
        };
      }
      case "read":
      case "read_file": {
        const showing = parsed.showing as { from: number; to: number } | undefined;
        const showingStr = showing ? `(${showing.from}-${showing.to})` : "";
        return {
          lines: [`${parsed.totalLines || "?"} lines ${showingStr}`],
          isError: false,
        };
      }
      case "bash":
      case "execute_command": {
        const exitCode = (parsed.exit_code ?? parsed.exitCode) as number | undefined;
        if (parsed.status === "background") {
          return {
            lines: ["started in background"],
            isError: false,
          };
        }
        const stdoutLines = String(parsed.stdout || "")
          .split("\n")
          .filter(Boolean);
        const limited = stdoutLines.slice(0, MAX_OUTPUT_LINES);
        if (stdoutLines.length > MAX_OUTPUT_LINES) {
          limited.push(
            `… (${stdoutLines.length - MAX_OUTPUT_LINES} more lines)`
          );
        }
        if (exitCode !== 0 && exitCode !== undefined) {
          limited.unshift(`exit ${exitCode}`);
        }
        return {
          lines: limited.map((l) => truncate(l, 70)),
          isError: exitCode !== 0,
        };
      }
      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const count = parsed.matches.length;
          const files = [
            ...new Set(
              (parsed.matches as Array<{ file?: string; path?: string }>).map(
                (m) => m.file || m.path
              )
            ),
          ];
          return {
            lines: [`${count} matches in ${files.length} files`],
            isError: false,
          };
        }
        return { lines: ["no matches"], isError: false };
      }
      case "glob": {
        if (Array.isArray(parsed.files)) {
          return {
            lines: [`${parsed.files.length} files found`],
            isError: false,
          };
        }
        return { lines: [], isError: false };
      }
      case "task": {
        return { lines: ["completed"], isError: false };
      }
      default: {
        if (parsed.message) {
          return {
            lines: [truncate(String(parsed.message), 70)],
            isError: false,
          };
        }
      }
    }
  }

  // Plain text output
  const textLines = output.split("\n").filter(Boolean);
  const limited = textLines
    .slice(0, MAX_OUTPUT_LINES)
    .map((l) => truncate(l, 70));
  if (textLines.length > MAX_OUTPUT_LINES) {
    limited.push(`… (${textLines.length - MAX_OUTPUT_LINES} more)`);
  }
  return { lines: limited, isError: isOutputError };
}

/**
 * Gets display configuration for a tool.
 * @param name - Tool name
 * @returns Display configuration with label and icon
 */
export function getToolDisplayInfo(name: string): ToolDisplayConfig {
  // Use Object.hasOwn to avoid prototype pollution issues
  if (Object.hasOwn(TOOL_DISPLAY, name)) {
    return TOOL_DISPLAY[name]!;
  }
  return { label: name, icon: "○" };
}

/**
 * Creates a tool formatter instance.
 * @param workspaceRoot - Optional workspace root for path relativization
 * @returns Tool formatter
 */
export function createToolFormatter(workspaceRoot?: string): ToolFormatter {
  return {
    formatInputSummary: (name, args) =>
      formatToolInputSummary(name, args, workspaceRoot),
    formatOutput: (name, output) =>
      formatToolOutput(name, output, workspaceRoot),
    getDisplayInfo: getToolDisplayInfo,
  };
}
