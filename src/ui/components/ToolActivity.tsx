/**
 * Tool Activity Component
 * Displays tool execution with nice colors for light/dark terminals
 * Uses bright colors for better visibility in both modes
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ToolPart } from "../types.js";

interface ToolActivityProps {
  tools: ToolPart[];
  isStreaming?: boolean;
  workspaceRoot?: string;
}

// Tool display names and icons - using Unicode that works in most terminals
// Colors use "Bright" variants for better visibility in both light and dark modes
const TOOL_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  // File operations
  read: { label: "Read", icon: "○", color: "blueBright" },
  read_file: { label: "Read", icon: "○", color: "blueBright" },
  write: { label: "Write", icon: "●", color: "greenBright" },
  write_file: { label: "Write", icon: "●", color: "greenBright" },
  edit: { label: "Edit", icon: "◐", color: "yellowBright" },
  edit_file: { label: "Edit", icon: "◐", color: "yellowBright" },

  // Search & navigation
  glob: { label: "Glob", icon: "◎", color: "magentaBright" },
  grep: { label: "Grep", icon: "⦿", color: "magentaBright" },
  list: { label: "List", icon: "▸", color: "cyanBright" },
  list_directory: { label: "List", icon: "▸", color: "cyanBright" },
  file_tree: { label: "Tree", icon: "▾", color: "cyanBright" },

  // Execution
  bash: { label: "Run", icon: "▶", color: "yellowBright" },
  execute_command: { label: "Run", icon: "▶", color: "yellowBright" },

  // Tasks & todos
  task: { label: "Task", icon: "◆", color: "blueBright" },
  todowrite: { label: "Todo", icon: "☑", color: "greenBright" },
  todoread: { label: "Todo", icon: "☐", color: "cyanBright" },
  todo: { label: "Todo", icon: "☐", color: "greenBright" },

  // Web & external
  webfetch: { label: "Fetch", icon: "⊕", color: "cyanBright" },
  exa_web_search: { label: "Search", icon: "⊛", color: "magentaBright" },
  exa_code_search: { label: "Code", icon: "⊘", color: "magentaBright" },
};

const MAX_LINES = 8;
const MAX_DIFF_LINES = 6;

// Truncate string with ellipsis
const truncate = (str: string, max: number): string => {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

// Make path relative to workspace
const relativePath = (filePath: string, workspaceRoot?: string): string => {
  if (!filePath) return "";
  if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
    const rel = filePath.slice(workspaceRoot.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
};

// Limit lines and add truncation indicator
const limitLines = (lines: string[], max: number): { lines: string[]; truncated: number } => {
  if (lines.length <= max) return { lines, truncated: 0 };
  return { lines: lines.slice(0, max), truncated: lines.length - max };
};

// Format input for each tool type - concise summaries
const formatToolInput = (
  name: string,
  args?: Record<string, unknown>,
  workspaceRoot?: string,
): { summary: string; details: string[] } => {
  if (!args) return { summary: "", details: [] };

  switch (name) {
    case "read":
    case "read_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      const startLine = args.start_line || args.offset;
      const endLine = args.end_line;
      let range = "";
      if (startLine && endLine) range = ` L${startLine}-${endLine}`;
      else if (startLine) range = ` L${startLine}+`;
      return { summary: path + range, details: [] };
    }

    case "write":
    case "write_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      return { summary: path, details: [] };
    }

    case "edit":
    case "edit_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      return { summary: path, details: [] };
    }

    case "bash":
    case "execute_command": {
      const cmd = String(args.command || "");
      const desc = args.description ? String(args.description) : "";
      const bg = args.run_in_background ? " (bg)" : "";
      // Show description or just command name
      if (desc) return { summary: truncate(desc, 45) + bg, details: [`$ ${truncate(cmd, 60)}`] };
      const cmdParts = cmd.trim().split(/\s+/);
      return { summary: (cmdParts[0] || "") + (cmdParts.length > 1 ? " ..." : "") + bg, details: [`$ ${truncate(cmd, 60)}`] };
    }

    case "grep": {
      const pattern = String(args.pattern || args.query || "");
      const path = args.path ? relativePath(String(args.path), workspaceRoot) : ".";
      const include = args.include || args.includePattern;
      return { 
        summary: `"${truncate(pattern, 25)}"${include ? ` in ${include}` : path !== "." ? ` in ${path}` : ""}`, 
        details: [] 
      };
    }

    case "glob": {
      const pattern = String(args.pattern || "");
      const path = args.path ? relativePath(String(args.path), workspaceRoot) : ".";
      return { summary: path !== "." ? `${pattern} in ${path}` : pattern, details: [] };
    }

    case "list":
    case "list_directory":
    case "file_tree": {
      const path = relativePath(String(args.path || "."), workspaceRoot);
      const depth = args.depth ? ` (d:${args.depth})` : "";
      return { summary: path + depth, details: [] };
    }

    case "task": {
      const desc = String(args.description || "");
      const type = args.subagent_type ? `[${args.subagent_type}] ` : "";
      return { summary: type + truncate(desc, 40), details: [] };
    }

    case "todowrite":
    case "todo": {
      const todos = args.todos as Array<{ content: string; status: string }> | undefined;
      if (!todos || !Array.isArray(todos)) return { summary: "(no items)", details: [] };
      return { summary: `${todos.length} items`, details: [] };
    }

    case "webfetch": {
      const url = String(args.url || "");
      try {
        const hostname = new URL(url).hostname;
        return { summary: hostname, details: [] };
      } catch {
        return { summary: truncate(url, 40), details: [] };
      }
    }

    case "exa_web_search":
    case "exa_code_search": {
      const query = String(args.query || "");
      return { summary: `"${truncate(query, 35)}"`, details: [] };
    }

    default:
      return { summary: "", details: [] };
  }
};

// Format output for each tool type - concise stats
const formatToolOutput = (
  name: string,
  output?: string,
  workspaceRoot?: string,
): { lines: string[]; isError: boolean; stats?: string; diffLines?: string[] } => {
  if (!output) return { lines: [], isError: false };

  const isError = output.startsWith("Error:") || output.includes('"success":false');

  // Try to parse JSON
  let parsed: any = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch { /* not JSON */ }
  }

  if (parsed) {
    if (parsed.success === false) {
      return { lines: [truncate(String(parsed.error || parsed.message || "Failed"), 60)], isError: true };
    }

    switch (name) {
      case "read":
      case "read_file": {
        const totalLines = parsed.totalLines || parsed.lines || "?";
        const showing = parsed.showing;
        const stats = showing 
          ? `${totalLines} lines (${showing.from}-${showing.to})`
          : `${totalLines} lines`;
        return { lines: [], isError: false, stats };
      }

      case "write":
      case "write_file": {
        const linesWritten = parsed.lines || parsed.linesWritten;
        const stats: string[] = [];
        if (parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        
        // Extract diff if available
        let diffLines: string[] | undefined;
        if (parsed.patch) {
          const patchLines = String(parsed.patch).split("\n");
          diffLines = patchLines.slice(0, MAX_DIFF_LINES);
          if (patchLines.length > MAX_DIFF_LINES) {
            diffLines.push(`... ${patchLines.length - MAX_DIFF_LINES} more`);
          }
        }
        
        return { 
          lines: [], 
          isError: false, 
          stats: linesWritten ? `${linesWritten} lines${stats.length ? ` (${stats.join(" ")})` : ""}` : stats.join(" ") || "written",
          diffLines,
        };
      }

      case "edit":
      case "edit_file": {
        const stats: string[] = [];
        if (parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        
        // Extract diff if available
        let diffLines: string[] | undefined;
        if (parsed.patch || parsed.diff) {
          const diffContent = parsed.patch || (Array.isArray(parsed.diff) ? parsed.diff.join("\n") : parsed.diff);
          if (diffContent) {
            const patchLines = String(diffContent).split("\n");
            diffLines = patchLines.slice(0, MAX_DIFF_LINES);
            if (patchLines.length > MAX_DIFF_LINES) {
              diffLines.push(`... ${patchLines.length - MAX_DIFF_LINES} more`);
            }
          }
        }
        
        return { 
          lines: [], 
          isError: false, 
          stats: stats.join(" ") || "applied",
          diffLines,
        };
      }

      case "bash":
      case "execute_command": {
        const exitCode = parsed.exit_code ?? parsed.exitCode;
        
        if (parsed.status === "background") {
          const pid = parsed.process_id || parsed.pid;
          return { lines: [], isError: false, stats: pid ? `bg pid:${pid}` : "background" };
        }

        const result: string[] = [];
        const stdout = String(parsed.stdout || "").trim();
        const stderr = String(parsed.stderr || "").trim();
        const hasError = exitCode !== 0 && exitCode !== undefined;
        
        const outputText = hasError && stderr ? stderr : stdout;
        if (outputText) {
          const outputLines = outputText.split("\n").filter(Boolean);
          const { lines, truncated } = limitLines(outputLines, MAX_LINES);
          result.push(...lines.map(l => truncate(l, 65)));
          if (truncated > 0) result.push(`... ${truncated} more lines`);
        }

        const stats = hasError ? `exit ${exitCode}` : result.length === 0 ? "done" : undefined;
        return { lines: result, isError: hasError, stats };
      }

      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const count = parsed.matches.length;
          const files = [...new Set(parsed.matches.map((m: any) => m.file || m.path))];
          return { lines: [], isError: false, stats: `${count} in ${files.length} files` };
        }
        return { lines: [], isError: false, stats: "no matches" };
      }

      case "glob": {
        if (Array.isArray(parsed.files)) {
          return { lines: [], isError: false, stats: `${parsed.files.length} files` };
        }
        return { lines: [], isError: false };
      }

      case "list":
      case "list_directory":
      case "file_tree": {
        const entries = parsed.entries || parsed.files || parsed.items;
        if (Array.isArray(entries)) {
          const dirs = entries.filter((e: any) => e.type === "directory" || e.isDirectory).length;
          const files = entries.length - dirs;
          const parts = [];
          if (files > 0) parts.push(`${files} files`);
          if (dirs > 0) parts.push(`${dirs} dirs`);
          return { lines: [], isError: false, stats: parts.join(", ") || `${entries.length} items` };
        }
        return { lines: [], isError: false };
      }

      case "task": {
        return { lines: [], isError: false, stats: "done" };
      }

      default: {
        if (parsed.message) {
          return { lines: [truncate(String(parsed.message), 60)], isError: false };
        }
      }
    }
  }

  // Plain text output
  const textLines = output.split("\n").filter(Boolean);
  const { lines, truncated } = limitLines(textLines, MAX_LINES);
  const result = lines.map(l => truncate(l, 65));
  if (truncated > 0) result.push(`... ${truncated} more lines`);
  return { lines: result, isError };
};

export const ToolActivity: React.FC<ToolActivityProps> = ({
  tools,
  isStreaming,
  workspaceRoot,
}) => {
  if (tools.length === 0) return null;

  return (
    <Box flexDirection="column" marginY={1}>
      {tools.map((tool, idx) => {
        const display = TOOL_DISPLAY[tool.name] || { label: tool.name, icon: "○", color: "gray" };
        const isRunning = tool.status === "running";
        const isDone = tool.status === "done" || tool.status === "error";

        const { summary, details } = formatToolInput(tool.name, tool.args, workspaceRoot);
        const { lines: outputLines, isError, stats, diffLines } = isDone
          ? formatToolOutput(tool.name, tool.output, workspaceRoot)
          : { lines: [], isError: false, stats: undefined, diffLines: undefined };

        // Colors that work well in both light and dark terminals
        const headerColor = isRunning ? "yellow" : isError ? "redBright" : display.color;

        return (
          <Box key={tool.id || idx} flexDirection="column" marginBottom={0}>
            {/* Header: icon + label + summary + stats */}
            <Box gap={1}>
              {isRunning ? (
                <Text color="yellow">
                  <Spinner type="dots" />
                </Text>
              ) : (
                <Text color={headerColor}>{isError ? figures.cross : display.icon}</Text>
              )}
              <Text bold color={isRunning ? "yellow" : isError ? "redBright" : "whiteBright"}>
                {display.label}
              </Text>
              {summary && (
                <Text color="gray">{summary}</Text>
              )}
              {stats && (
                <Text color={isError ? "redBright" : "greenBright"}>
                  {figures.arrowRight} {stats}
                </Text>
              )}
            </Box>

            {/* Input details (like bash command) */}
            {details.length > 0 && (
              <Box flexDirection="column" paddingLeft={2}>
                {details.map((line, i) => (
                  <Text key={`detail-${i}`} color="gray" dimColor>{line}</Text>
                ))}
              </Box>
            )}

            {/* Diff output for edit/write */}
            {diffLines && diffLines.length > 0 && (
              <Box flexDirection="column" paddingLeft={2}>
                {diffLines.map((line, i) => {
                  const trimmed = line.trimStart();
                  let lineColor: string = "gray";
                  if (trimmed.startsWith("+") && !trimmed.startsWith("+++")) lineColor = "greenBright";
                  else if (trimmed.startsWith("-") && !trimmed.startsWith("---")) lineColor = "redBright";
                  else if (trimmed.startsWith("@@")) lineColor = "cyanBright";
                  else if (trimmed.startsWith("...")) lineColor = "gray";
                  
                  return (
                    <Text key={`diff-${i}`} color={lineColor} dimColor={lineColor === "gray"}>
                      {truncate(line, 70)}
                    </Text>
                  );
                })}
              </Box>
            )}

            {/* Output lines (for bash output, errors, etc.) */}
            {outputLines.length > 0 && !diffLines && (
              <Box flexDirection="column" paddingLeft={2}>
                {outputLines.map((line, i) => (
                  <Text key={`out-${i}`} color={isError ? "redBright" : "gray"} dimColor={!isError}>
                    {line}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        );
      })}

      {isStreaming && tools.every((t) => t.status === "done") && (
        <Box gap={1} marginTop={1}>
          <Spinner type="dots" />
          <Text color="gray" dimColor>thinking...</Text>
        </Box>
      )}
    </Box>
  );
};
