import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ToolPart } from "../types.js";

interface ToolActivityProps {
  tools: ToolPart[];
  isStreaming?: boolean;
  workspaceRoot?: string;
}

// Tool display names and icons
const TOOL_DISPLAY: Record<string, { label: string; icon: string }> = {
  // File operations
  read: { label: "Read", icon: "◔" },
  read_file: { label: "Read", icon: "◔" },
  write: { label: "Write", icon: "◑" },
  write_file: { label: "Write", icon: "◑" },
  edit: { label: "Edit", icon: "◐" },
  edit_file: { label: "Edit", icon: "◐" },

  // Search & navigation
  glob: { label: "Glob", icon: "◉" },
  grep: { label: "Grep", icon: "⊛" },
  list: { label: "List", icon: "▤" },
  list_directory: { label: "List", icon: "▤" },
  file_tree: { label: "Tree", icon: "▤" },

  // Execution
  bash: { label: "Bash", icon: "▶" },
  execute_command: { label: "Bash", icon: "▶" },

  // Tasks & todos
  task: { label: "Task", icon: "◈" },
  todowrite: { label: "Todo", icon: "☐" },
  todoread: { label: "Todo", icon: "☐" },
  todo: { label: "Todo", icon: "☐" },

  // Web & external
  webfetch: { label: "Fetch", icon: "⊕" },
  exa_web_search: { label: "Search", icon: "⊗" },
  exa_code_search: { label: "Code", icon: "⊘" },
};

const MAX_LINES = 15;

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
  // Fallback: just get filename
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
};

// Limit lines and add truncation indicator
const limitLines = (
  lines: string[],
  max: number,
): { lines: string[]; truncated: boolean } => {
  if (lines.length <= max) return { lines, truncated: false };
  return { lines: lines.slice(0, max), truncated: true };
};

// Format input for each tool type - returns lines to display
const formatToolInput = (
  name: string,
  args?: Record<string, unknown>,
  workspaceRoot?: string,
): string[] => {
  if (!args) return [];

  switch (name) {
    case "read":
    case "read_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot,
      );
      const offset = args.offset ? ` (from line ${args.offset})` : "";
      return [`${path}${offset}`];
    }

    case "write":
    case "write_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot,
      );
      const content = String(args.content || "");
      const contentLines = content.split("\n");
      const { lines, truncated } = limitLines(contentLines, MAX_LINES);
      const result = [`${path}`, ...lines.map((l) => `  ${truncate(l, 70)}`)];
      if (truncated)
        result.push(`  … (${contentLines.length - MAX_LINES} more lines)`);
      return result;
    }

    case "edit":
    case "edit_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot,
      );
      const oldStr = String(args.oldString || "");
      const newStr = String(args.newString || "");
      const replaceAll = args.replaceAll ? " (all)" : "";

      const oldLines = oldStr.split("\n");
      const newLines = newStr.split("\n");

      const result = [`${path}${replaceAll}`];

      // Show old (what's being replaced)
      const { lines: oldLimited, truncated: oldTrunc } = limitLines(
        oldLines,
        Math.floor(MAX_LINES / 2),
      );
      oldLimited.forEach((l) => result.push(`  - ${truncate(l, 65)}`));
      if (oldTrunc)
        result.push(`  … (${oldLines.length - oldLimited.length} more)`);

      // Show new (replacement)
      const { lines: newLimited, truncated: newTrunc } = limitLines(
        newLines,
        Math.floor(MAX_LINES / 2),
      );
      newLimited.forEach((l) => result.push(`  + ${truncate(l, 65)}`));
      if (newTrunc)
        result.push(`  … (${newLines.length - newLimited.length} more)`);

      return result;
    }

    case "bash":
    case "execute_command": {
      const cmd = String(args.command || "");
      const workdir = args.workdir
        ? relativePath(String(args.workdir), workspaceRoot)
        : "";
      const bg = args.run_in_background ? " (background)" : "";
      const desc = args.description ? String(args.description) : "";

      const result: string[] = [];
      if (desc) result.push(desc);
      if (workdir) result.push(`cd ${workdir}`);
      result.push(`$ ${cmd}${bg}`);
      return result;
    }

    case "grep": {
      const pattern = String(args.pattern || "");
      const path = args.path
        ? relativePath(String(args.path), workspaceRoot)
        : ".";
      const include = args.include ? ` --include="${args.include}"` : "";
      return [`"${pattern}" in ${path}${include}`];
    }

    case "glob": {
      const pattern = String(args.pattern || "");
      const path = args.path
        ? relativePath(String(args.path), workspaceRoot)
        : ".";
      return [`${pattern} in ${path}`];
    }

    case "list":
    case "list_directory":
    case "file_tree": {
      const path = relativePath(String(args.path || "."), workspaceRoot);
      const depth = args.depth ? ` (depth: ${args.depth})` : "";
      return [`${path}${depth}`];
    }

    case "task": {
      const desc = String(args.description || "");
      const type = args.subagent_type ? `[${args.subagent_type}] ` : "";
      const prompt = String(args.prompt || "");
      const promptLines = prompt.split("\n");
      const { lines, truncated } = limitLines(promptLines, MAX_LINES - 1);
      const result = [`${type}${desc}`];
      lines.forEach((l) => result.push(`  ${truncate(l, 68)}`));
      if (truncated)
        result.push(`  … (${promptLines.length - lines.length} more)`);
      return result;
    }

    case "todowrite":
    case "todo": {
      const todos = args.todos as
        | Array<{ content: string; status: string; priority?: string }>
        | undefined;
      if (!todos || !Array.isArray(todos)) return ["(no items)"];

      const result: string[] = [`${todos.length} items:`];
      const { lines: limited, truncated } = limitLines(
        todos.map((t) => {
          const icon =
            t.status === "completed"
              ? "✓"
              : t.status === "in_progress"
                ? "→"
                : "○";
          const pri = t.priority === "high" ? "!" : "";
          return `  ${icon}${pri} ${truncate(t.content, 60)}`;
        }),
        MAX_LINES - 1,
      );
      result.push(...limited);
      if (truncated) result.push(`  … (${todos.length - limited.length} more)`);
      return result;
    }

    case "todoread": {
      return ["reading todo list"];
    }

    case "webfetch": {
      const url = String(args.url || "");
      const format = args.format ? ` (${args.format})` : "";
      return [`${url}${format}`];
    }

    case "exa_web_search":
    case "exa_code_search": {
      const query = String(args.query || "");
      const numResults = args.numResults ? ` (${args.numResults} results)` : "";
      return [`"${query}"${numResults}`];
    }

    default: {
      // Generic: show all string args
      const lines: string[] = [];
      for (const [key, val] of Object.entries(args)) {
        if (typeof val === "string") {
          lines.push(`${key}: ${truncate(val, 60)}`);
        } else if (val !== undefined) {
          lines.push(`${key}: ${truncate(JSON.stringify(val), 60)}`);
        }
      }
      return limitLines(lines, MAX_LINES).lines;
    }
  }
};

// Format output for each tool type - returns lines to display
const formatToolOutput = (
  name: string,
  output?: string,
  workspaceRoot?: string,
): { lines: string[]; isError: boolean } => {
  if (!output) return { lines: [], isError: false };

  // Check for error
  const isError =
    output.startsWith("Error:") || output.includes('"success":false');

  // Try to parse JSON
  let parsed: any = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch {
      // Not valid JSON
    }
  }

  // Handle specific tool outputs
  if (parsed) {
    if (parsed.success === false) {
      return { lines: [`Error: ${parsed.error || "Failed"}`], isError: true };
    }

    switch (name) {
      case "edit":
      case "edit_file": {
        const stats = [];
        if (parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        const summary = stats.length > 0 ? stats.join(" ") : "no changes";

        const result = [summary];
        if (parsed.diff && Array.isArray(parsed.diff)) {
          const { lines, truncated } = limitLines(parsed.diff, MAX_LINES - 1);
          lines.forEach((l: string) => result.push(`  ${truncate(l, 68)}`));
          if (truncated)
            result.push(`  … (${parsed.diff.length - lines.length} more)`);
        }
        return { lines: result, isError: false };
      }

      case "write":
      case "write_file": {
        return {
          lines: [`${parsed.lines} lines, ${formatBytes(parsed.bytes)}`],
          isError: false,
        };
      }

      case "read":
      case "read_file": {
        if (parsed.showing) {
          return {
            lines: [
              `${parsed.showing.of} lines (showing ${parsed.showing.from}-${parsed.showing.to})`,
            ],
            isError: false,
          };
        }
        return {
          lines: [`${parsed.totalLines || parsed.lines || "?"} lines`],
          isError: false,
        };
      }

      case "bash":
      case "execute_command": {
        const result: string[] = [];
        const exitCode = parsed.exit_code ?? parsed.exitCode;

        if (parsed.status === "background") {
          return {
            lines: [`Started in background (pid: ${parsed.process_id})`],
            isError: false,
          };
        }

        if (exitCode !== undefined && exitCode !== 0) {
          result.push(`Exit code: ${exitCode}`);
        }

        // Show stdout
        if (parsed.stdout) {
          const stdoutLines = String(parsed.stdout).split("\n").filter(Boolean);
          const { lines, truncated } = limitLines(stdoutLines, MAX_LINES - 1);
          lines.forEach((l) => result.push(truncate(l, 70)));
          if (truncated)
            result.push(`… (${stdoutLines.length - lines.length} more lines)`);
        }

        // Show stderr if there's an error
        if (exitCode !== 0 && parsed.stderr) {
          const stderrLines = String(parsed.stderr).split("\n").filter(Boolean);
          const { lines, truncated } = limitLines(stderrLines, 5);
          result.push("stderr:");
          lines.forEach((l) => result.push(`  ${truncate(l, 68)}`));
          if (truncated)
            result.push(`  … (${stderrLines.length - lines.length} more)`);
        }

        if (result.length === 0) result.push("done");
        return { lines: result, isError: exitCode !== 0 };
      }

      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const result = [`${parsed.matches.length} matches`];
          const { lines, truncated } = limitLines(
            parsed.matches.map((m: any) => {
              const path = relativePath(m.file || m.path || "", workspaceRoot);
              return `  ${path}:${m.line || "?"}`;
            }),
            MAX_LINES - 1,
          );
          result.push(...lines);
          if (truncated)
            result.push(`  … (${parsed.matches.length - lines.length} more)`);
          return { lines: result, isError: false };
        }
        return { lines: [parsed.message || "no matches"], isError: false };
      }

      case "glob": {
        if (Array.isArray(parsed.files)) {
          const result = [`${parsed.files.length} files`];
          const { lines, truncated } = limitLines(
            parsed.files.map(
              (f: string) => `  ${relativePath(f, workspaceRoot)}`,
            ),
            MAX_LINES - 1,
          );
          result.push(...lines);
          if (truncated)
            result.push(`  … (${parsed.files.length - lines.length} more)`);
          return { lines: result, isError: false };
        }
        return { lines: [], isError: false };
      }

      case "todowrite":
      case "todoread":
      case "todo": {
        return { lines: [parsed.message || "updated"], isError: false };
      }

      case "task": {
        const result = ["completed"];
        if (parsed.result) {
          const resultLines = String(parsed.result).split("\n");
          const { lines, truncated } = limitLines(resultLines, MAX_LINES - 1);
          lines.forEach((l) => result.push(`  ${truncate(l, 68)}`));
          if (truncated)
            result.push(`  … (${resultLines.length - lines.length} more)`);
        }
        return { lines: result, isError: false };
      }

      default: {
        if (parsed.message)
          return { lines: [truncate(parsed.message, 70)], isError: false };
      }
    }
  }

  // Plain text output
  const outputLines = output.split("\n").filter(Boolean);
  const { lines, truncated } = limitLines(outputLines, MAX_LINES);
  const result = lines.map((l) => truncate(l, 70));
  if (truncated)
    result.push(`… (${outputLines.length - lines.length} more lines)`);
  return { lines: result, isError };
};

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
        const display = TOOL_DISPLAY[tool.name] || {
          label: tool.name,
          icon: "○",
        };
        const isRunning = tool.status === "running";
        const isDone = tool.status === "done" || tool.status === "error";

        const inputLines = formatToolInput(tool.name, tool.args, workspaceRoot);
        const { lines: outputLines, isError } = isDone
          ? formatToolOutput(tool.name, tool.output, workspaceRoot)
          : { lines: [], isError: false };

        // Determine colors
        const iconColor = isRunning ? "yellow" : isError ? "red" : "cyan";
        const labelColor = isRunning
          ? "yellow"
          : isError
            ? "red"
            : "whiteBright";

        return (
          <Box key={tool.id || idx} flexDirection="column" marginBottom={1}>
            {/* Header: icon + label */}
            <Box gap={1}>
              {isRunning ? (
                <Text color="yellow">
                  <Spinner type="dots" />
                </Text>
              ) : (
                <Text color={iconColor}>{display.icon}</Text>
              )}
              <Text bold color={labelColor}>
                {display.label}
              </Text>
            </Box>

            {/* Input lines */}
            {inputLines.length > 0 && (
              <Box flexDirection="column" paddingLeft={2}>
                {inputLines.map((line, i) => (
                  <Text key={`in-${i}`} color="gray">
                    {line}
                  </Text>
                ))}
              </Box>
            )}

            {/* Output lines */}
            {outputLines.length > 0 && (
              <Box flexDirection="column" paddingLeft={2} marginTop={0}>
                <Text color="gray" dimColor>
                  →
                </Text>
                {outputLines.map((line, i) => {
                  // Color diff lines
                  const isAdd = line.trimStart().startsWith("+");
                  const isRemove = line.trimStart().startsWith("-");
                  const color = isError
                    ? "red"
                    : isAdd
                      ? "green"
                      : isRemove
                        ? "red"
                        : "gray";
                  return (
                    <Text
                      key={`out-${i}`}
                      color={color}
                      dimColor={!isAdd && !isRemove && !isError}
                    >
                      {line}
                    </Text>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}

      {isStreaming && tools.every((t) => t.status === "done") && (
        <Box gap={1} marginTop={1}>
          <Spinner type="dots" />
          <Text color="gray" dimColor>
            thinking...
          </Text>
        </Box>
      )}
    </Box>
  );
};
