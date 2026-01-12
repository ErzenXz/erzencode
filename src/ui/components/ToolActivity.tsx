/**
 * Tool Activity Component
 * Claude Code style: ● ToolName(input) with detail line below.
 * Uses bright colors for better visibility in both light and dark modes.
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
  isExpanded?: boolean;
}

const TOOL_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  read: { label: "Read", icon: "●", color: "blueBright" },
  read_file: { label: "Read", icon: "●", color: "blueBright" },
  write: { label: "Write", icon: "●", color: "greenBright" },
  write_file: { label: "Write", icon: "●", color: "greenBright" },
  edit: { label: "Edit", icon: "●", color: "yellowBright" },
  edit_file: { label: "Edit", icon: "●", color: "yellowBright" },
  glob: { label: "Search", icon: "●", color: "magentaBright" },
  grep: { label: "Search", icon: "●", color: "magentaBright" },
  list: { label: "List", icon: "●", color: "cyanBright" },
  list_directory: { label: "List", icon: "●", color: "cyanBright" },
  file_tree: { label: "Tree", icon: "●", color: "cyanBright" },
  bash: { label: "Run", icon: "●", color: "yellowBright" },
  execute_command: { label: "Run", icon: "●", color: "yellowBright" },
  task: { label: "Subagent", icon: "●", color: "blueBright" },
  todowrite: { label: "Todo", icon: "●", color: "greenBright" },
  todoread: { label: "Todo", icon: "●", color: "cyanBright" },
  todo: { label: "Todo", icon: "●", color: "greenBright" },
  webfetch: { label: "Fetch", icon: "●", color: "cyanBright" },
  exa_web_search: { label: "Search", icon: "●", color: "magentaBright" },
  exa_code_search: { label: "Code", icon: "●", color: "magentaBright" },
  semantic_search: { label: "Search", icon: "●", color: "magentaBright" },
};

const truncate = (str: string, max: number): string => {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

const relativePath = (filePath: string, workspaceRoot?: string): string => {
  if (!filePath) return "";
  if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
    const rel = filePath.slice(workspaceRoot.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
};

function formatToolInputAsCall(
  name: string,
  args?: Record<string, unknown>,
  workspaceRoot?: string,
): string {
  if (!args) return "";

  switch (name) {
    case "read":
    case "read_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      return path;
    }
    case "write":
    case "write_file":
    case "edit":
    case "edit_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      return path;
    }
    case "bash":
    case "execute_command": {
      const cmd = String(args.command || "");
      return truncate(cmd, 55);
    }
    case "grep": {
      const pattern = String(args.pattern || args.query || "");
      const pathArg = args.path ? relativePath(String(args.path), workspaceRoot) : "";
      const parts: string[] = [];
      if (pattern) parts.push(`pattern: "${truncate(pattern, 25)}"`);
      if (pathArg && pathArg !== ".") parts.push(`path: "${pathArg}"`);
      return parts.join(", ");
    }
    case "glob": {
      const pattern = String(args.pattern || args.filePattern || "");
      return `pattern: "${pattern}"`;
    }
    case "list":
    case "list_directory":
    case "file_tree": {
      const path = relativePath(String(args.path || "."), workspaceRoot);
      return `path: "${path}"`;
    }
    case "task": {
      const desc = String(args.description || "");
      return `task: "${truncate(desc, 40)}"`;
    }
    default:
      return "";
  }
}

function formatToolResultSummary(
  name: string,
  output?: string,
): { summary: string; isError: boolean; isExpandable: boolean } {
  if (!output) return { summary: "", isError: false, isExpandable: false };

  const isError = output.startsWith("Error:") || output.includes('"success":false');

  let parsed: Record<string, unknown> | null = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch { /* not JSON */ }
  }

  if (parsed) {
    if (parsed.success === false) {
      return { summary: truncate(String(parsed.error || parsed.message || "Failed"), 50), isError: true, isExpandable: false };
    }

    switch (name) {
      case "read":
      case "read_file": {
        const totalLines = parsed.totalLines || parsed.lines;
        if (totalLines) return { summary: `Read ${totalLines} lines`, isError: false, isExpandable: true };
        const content = parsed.content || parsed.text;
        if (content && typeof content === "string") {
          return { summary: `Read ${content.split("\n").length} lines`, isError: false, isExpandable: true };
        }
        return { summary: "Read file", isError: false, isExpandable: true };
      }
      case "write":
      case "write_file": {
        const linesWritten = parsed.lines || parsed.linesWritten;
        return { summary: linesWritten ? `Wrote ${linesWritten} lines` : "File written", isError: false, isExpandable: false };
      }
      case "edit":
      case "edit_file": {
        const stats: string[] = [];
        if (typeof parsed.linesAdded === "number" && parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (typeof parsed.linesRemoved === "number" && parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        return { summary: stats.length > 0 ? `Applied ${stats.join(" ")}` : "Edit applied", isError: false, isExpandable: true };
      }
      case "bash":
      case "execute_command": {
        const exitCode = (parsed.exit_code ?? parsed.exitCode) as number | undefined;
        if (parsed.status === "background") {
          const pid = parsed.process_id || parsed.pid;
          return { summary: pid ? `Background pid:${pid}` : "Running in background", isError: false, isExpandable: false };
        }
        if (exitCode !== 0 && exitCode !== undefined) {
          return { summary: `Exit ${exitCode}`, isError: true, isExpandable: true };
        }
        const stdout = String(parsed.stdout || "").trim();
        const lineCount = stdout ? stdout.split("\n").length : 0;
        return { summary: lineCount > 0 ? `Done (${lineCount} lines)` : "Done", isError: false, isExpandable: lineCount > 3 };
      }
      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const count = parsed.matches.length;
          const files = [...new Set(parsed.matches.map((m: any) => m.file || m.path))];
          return { summary: `Found ${count} matches across ${files.length} files`, isError: false, isExpandable: true };
        }
        return { summary: "No matches", isError: false, isExpandable: false };
      }
      case "glob": {
        if (Array.isArray(parsed.files)) {
          return { summary: `Found ${parsed.files.length} files`, isError: false, isExpandable: true };
        }
        return { summary: "Search complete", isError: false, isExpandable: false };
      }
      case "list":
      case "list_directory":
      case "file_tree": {
        const entries = parsed.entries || parsed.files || parsed.items;
        if (Array.isArray(entries)) {
          return { summary: `${entries.length} items`, isError: false, isExpandable: true };
        }
        return { summary: "Listed", isError: false, isExpandable: false };
      }
      case "task": {
        const tools = parsed.tools as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(tools) && tools.length > 0) {
          return { summary: `Done (${tools.length} tool calls)`, isError: false, isExpandable: true };
        }
        return { summary: "Done", isError: false, isExpandable: false };
      }
      default:
        if (parsed.message) {
          return { summary: truncate(String(parsed.message), 50), isError: false, isExpandable: false };
        }
    }
  }

  const lineCount = output.split("\n").filter(Boolean).length;
  return { summary: lineCount > 0 ? `${lineCount} lines` : "Done", isError, isExpandable: lineCount > 3 };
}

export const ToolActivity: React.FC<ToolActivityProps> = ({
  tools,
  isStreaming,
  workspaceRoot,
  isExpanded = false,
}) => {
  if (tools.length === 0) return null;

  return (
    <Box flexDirection="column" marginY={1}>
      {tools.map((tool, idx) => {
        const display = TOOL_DISPLAY[tool.name] || { label: tool.name, icon: "●", color: "gray" };
        const isRunning = tool.status === "running";
        const isDone = tool.status === "done" || tool.status === "error";
        const isError = tool.status === "error";

        const inputCall = formatToolInputAsCall(tool.name, tool.args, workspaceRoot);
        const { summary, isError: isResultError, isExpandable } = isDone
          ? formatToolResultSummary(tool.name, tool.output)
          : { summary: "", isError: false, isExpandable: false };

        const iconColor = isRunning ? "yellow" : isError || isResultError ? "redBright" : display.color;

        return (
          <Box key={tool.id || idx} flexDirection="column" marginBottom={0}>
            {/* Header: ● ToolName(input) */}
            <Box gap={0}>
              {isRunning ? (
                <Text color="yellow">
                  <Spinner type="dots" />
                </Text>
              ) : (
                <Text color={iconColor}>{display.icon}</Text>
              )}
              <Text> </Text>
              <Text bold color={isRunning ? "yellow" : isError || isResultError ? "redBright" : "whiteBright"}>
                {display.label}
              </Text>
              {inputCall && (
                <>
                  <Text color="gray">(</Text>
                  <Text color="gray">{inputCall}</Text>
                  <Text color="gray">)</Text>
                </>
              )}
            </Box>

            {/* Detail line: └─ Result summary (ctrl+o to expand) */}
            {isDone && summary && (
              <Box paddingLeft={1}>
                <Text color="gray">└─ </Text>
                <Text color={isResultError ? "redBright" : "greenBright"}>
                  {summary}
                </Text>
                {isExpandable && !isExpanded && (
                  <Text color="gray"> (ctrl+o to expand)</Text>
                )}
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
