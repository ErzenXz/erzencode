import React, { useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ChatMessage, MessagePart, ToolPart } from "../types.js";
import { renderMarkdownWithWidth, renderSimple } from "../../markdown.js";
import { clamp, wrapAnsiText, wrapText } from "../utils.js";

interface ChatFeedProps {
  messages: ChatMessage[];
  width: number;
  height: number;
  scrollOffset: number;
  workingDirectory: string;
  onLineCountChange?: (count: number) => void;
}

// Tool display configuration
const TOOL_DISPLAY: Record<string, { label: string; icon: string }> = {
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

const MAX_OUTPUT_LINES = 10;

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

// Truncate string
const truncate = (str: string, max: number): string => {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  width,
  height,
  scrollOffset,
  workingDirectory,
  onLineCountChange,
}) => {
  if (messages.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="gray">
          Ready in: <Text color="cyan">{workingDirectory}</Text>
        </Text>
        <Text color="gray" dimColor>
          Type a message or /help for commands
        </Text>
      </Box>
    );
  }

  const feedWidth = Math.max(20, width - 4);

  const allLines = useMemo(() => {
    const lines: Array<{ key: string; node: React.ReactNode }> = [];

    for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
      const msg = messages[msgIdx]!;

      // User message - styled with a box-like appearance
      if (msg.role === "user") {
        // Top spacing between messages
        if (msgIdx > 0) {
          lines.push({ key: `${msg.id}:spacer-top`, node: <Text> </Text> });
        }

        const wrapped = wrapText(
          msg.content ?? "",
          Math.max(10, feedWidth - 6),
        );

        // User label with icon
        lines.push({
          key: `${msg.id}:user-label`,
          node: (
            <Text>
              <Text color="cyan" bold>
                {figures.pointerSmall}
              </Text>
              <Text color="cyan" bold>
                {" "}
                You
              </Text>
            </Text>
          ),
        });

        // Message content with left border effect
        wrapped.forEach((l, idx) => {
          lines.push({
            key: `${msg.id}:user:${idx}`,
            node: (
              <Text>
                <Text color="gray">│ </Text>
                <Text color="white">{l}</Text>
              </Text>
            ),
          });
        });

        continue;
      }

      // Assistant message
      if (msg.role === "assistant") {
        // Spacing before assistant response
        lines.push({ key: `${msg.id}:spacer-top`, node: <Text> </Text> });

        const parts: MessagePart[] = msg.parts ?? [];

        // If no structured parts, just render content
        if (parts.length === 0) {
          const content = msg.content ?? "";
          if (content.trim()) {
            renderContentLines(content, feedWidth, msg.id, "text", lines);
          }
          if (msg.isStreaming) {
            lines.push({
              key: `${msg.id}:streaming`,
              node: (
                <Text color="gray" dimColor>
                  {figures.ellipsis}
                </Text>
              ),
            });
          }
          continue;
        }

        // Group consecutive tools
        const grouped = groupParts(parts);
        let hasRenderedText = false;

        grouped.forEach((item, pidx) => {
          if (item.kind === "tool-group") {
            // Add spacing before tools if we've rendered text
            if (hasRenderedText) {
              lines.push({
                key: `${msg.id}:tool-spacer:${pidx}`,
                node: <Text> </Text>,
              });
            }
            renderToolGroup(item.parts, msg.id, pidx, lines, workingDirectory);
            return;
          }

          const part = item.part;

          // Thinking - styled with a brain icon and distinct styling
          if (part.type === "thinking") {
            const content = part.content ?? "";
            if (content.trim()) {
              // Add thinking header - prominent styling
              lines.push({
                key: `${msg.id}:think-header:${pidx}`,
                node: (
                  <Text color="magenta" bold>
                    {figures.info} reasoning
                  </Text>
                ),
              });
              // Render thinking content with visible styling
              wrapText(content, Math.max(10, feedWidth - 4)).forEach(
                (l, idx) => {
                  lines.push({
                    key: `${msg.id}:think:${pidx}:${idx}`,
                    node: (
                      <Text>
                        <Text color="magenta">│ </Text>
                        <Text color="white" dimColor italic>
                          {l}
                        </Text>
                      </Text>
                    ),
                  });
                },
              );
            }
            return;
          }

          // Action - skip (too noisy)
          if (part.type === "action") {
            return;
          }

          // Error - red styling
          if (part.type === "error") {
            const content = part.content ?? "";
            if (content.trim()) {
              lines.push({
                key: `${msg.id}:error-spacer:${pidx}`,
                node: <Text> </Text>,
              });
              wrapText(content, Math.max(10, feedWidth - 4)).forEach(
                (l, idx) => {
                  lines.push({
                    key: `${msg.id}:error:${pidx}:${idx}`,
                    node: (
                      <Text>
                        {idx === 0 ? (
                          <Text color="red" bold>
                            {figures.cross}{" "}
                          </Text>
                        ) : (
                          <Text>{"  "}</Text>
                        )}
                        <Text color="red">{l}</Text>
                      </Text>
                    ),
                  });
                },
              );
            }
            return;
          }

          // Text - main response content with markdown
          if (part.type === "text") {
            const content = part.content ?? "";
            if (content.trim()) {
              // Add spacing before text if we've had tools
              if (pidx > 0 && !hasRenderedText) {
                lines.push({
                  key: `${msg.id}:text-spacer:${pidx}`,
                  node: <Text> </Text>,
                });
              }
              renderContentLines(
                content,
                feedWidth,
                msg.id,
                `text:${pidx}`,
                lines,
              );
              hasRenderedText = true;
            }
          }
        });

        if (msg.isStreaming) {
          lines.push({
            key: `${msg.id}:streaming`,
            node: (
              <Text color="gray" dimColor>
                {figures.ellipsis}
              </Text>
            ),
          });
        }
      }
    }

    return lines;
  }, [messages, feedWidth]);

  useEffect(() => {
    onLineCountChange?.(allLines.length);
  }, [allLines.length, onLineCountChange]);

  const visibleLines = useMemo(() => {
    const maxScroll = Math.max(0, allLines.length - height);
    const effectiveOffset = clamp(scrollOffset, 0, maxScroll);
    const end = allLines.length - effectiveOffset;
    const start = Math.max(0, end - height);
    return allLines.slice(start, end);
  }, [allLines, height, scrollOffset]);

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {visibleLines.map((l) => (
        <Box key={l.key}>{l.node}</Box>
      ))}
    </Box>
  );
};

// Helper: Group consecutive tool parts
function groupParts(
  parts: MessagePart[],
): Array<
  | { kind: "tool-group"; parts: ToolPart[] }
  | { kind: "part"; part: MessagePart }
> {
  const grouped: Array<
    | { kind: "tool-group"; parts: ToolPart[] }
    | { kind: "part"; part: MessagePart }
  > = [];
  let currentTools: ToolPart[] = [];

  for (const p of parts) {
    if (p.type === "tool") {
      currentTools.push(p);
      continue;
    }
    if (currentTools.length > 0) {
      grouped.push({ kind: "tool-group", parts: currentTools });
      currentTools = [];
    }
    grouped.push({ kind: "part", part: p });
  }
  if (currentTools.length > 0) {
    grouped.push({ kind: "tool-group", parts: currentTools });
  }

  return grouped;
}

// Helper: Render tool group with full input/output display
function renderToolGroup(
  toolParts: ToolPart[],
  msgId: string,
  groupIdx: number,
  lines: Array<{ key: string; node: React.ReactNode }>,
  workspaceRoot?: string,
) {
  // Render each tool with full details
  toolParts.forEach((t, i) => {
    const isRunning = t.status === "running";
    const isError = t.status === "error";
    const display = TOOL_DISPLAY[t.name] || { label: t.name, icon: "○" };

    // Icon and color based on status
    const icon = isRunning
      ? figures.pointer
      : isError
        ? figures.cross
        : display.icon;
    const iconColor = isRunning ? "yellow" : isError ? "red" : "cyan";
    const labelColor = isRunning ? "yellow" : isError ? "red" : "whiteBright";

    // Format input summary
    const inputSummary = formatToolInputSummary(t.name, t.args, workspaceRoot);

    // Header line: icon + label + input summary
    lines.push({
      key: `${msgId}:tools:${groupIdx}:${i}:header`,
      node: (
        <Text>
          <Text color={iconColor}>{icon} </Text>
          <Text bold color={labelColor}>
            {display.label}
          </Text>
          {inputSummary && <Text color="gray"> {inputSummary}</Text>}
        </Text>
      ),
    });

    // For edit tool, show diff-style input
    if ((t.name === "edit" || t.name === "edit_file") && t.args) {
      const oldStr = String(t.args.oldString || "");
      const newStr = String(t.args.newString || "");

      if (oldStr || newStr) {
        // Show a few lines of old/new
        const oldLines = oldStr.split("\n").slice(0, 3);
        const newLines = newStr.split("\n").slice(0, 3);

        oldLines.forEach((line, idx) => {
          lines.push({
            key: `${msgId}:tools:${groupIdx}:${i}:old:${idx}`,
            node: <Text color="red"> - {truncate(line, 70)}</Text>,
          });
        });
        if (oldStr.split("\n").length > 3) {
          lines.push({
            key: `${msgId}:tools:${groupIdx}:${i}:old:more`,
            node: (
              <Text color="gray" dimColor>
                {" "}
                … ({oldStr.split("\n").length - 3} more)
              </Text>
            ),
          });
        }

        newLines.forEach((line, idx) => {
          lines.push({
            key: `${msgId}:tools:${groupIdx}:${i}:new:${idx}`,
            node: <Text color="green"> + {truncate(line, 70)}</Text>,
          });
        });
        if (newStr.split("\n").length > 3) {
          lines.push({
            key: `${msgId}:tools:${groupIdx}:${i}:new:more`,
            node: (
              <Text color="gray" dimColor>
                {" "}
                … ({newStr.split("\n").length - 3} more)
              </Text>
            ),
          });
        }
      }
    }

    // For bash tool, show the command
    if ((t.name === "bash" || t.name === "execute_command") && t.args) {
      const cmd = String(t.args.command || "");
      if (cmd) {
        lines.push({
          key: `${msgId}:tools:${groupIdx}:${i}:cmd`,
          node: <Text color="gray"> $ {truncate(cmd, 70)}</Text>,
        });
      }
    }

    // Output (if done)
    if (!isRunning && t.output) {
      const { outputLines, isOutputError, markdown } = formatToolOutput(
        t.name,
        t.output,
        workspaceRoot,
      );

      if (markdown) {
        const rendered = renderMarkdownWithWidth(
          markdown,
          Math.max(40, Math.max(10, (workspaceRoot ? 0 : 0) + 70)),
        );
        const renderedLines = wrapAnsiText(rendered, 76);
        renderedLines.forEach((l, idx) => {
          lines.push({
            key: `${msgId}:tools:${groupIdx}:${i}:patch:${idx}`,
            node: <Text>{l}</Text>,
          });
        });
      } else if (outputLines.length > 0) {
        outputLines.forEach((line, idx) => {
          const color = isOutputError
            ? "red"
            : line.startsWith("+")
              ? "green"
              : line.startsWith("-")
                ? "red"
                : "gray";
          lines.push({
            key: `${msgId}:tools:${groupIdx}:${i}:out:${idx}`,
            node: (
              <Text
                color={color}
                dimColor={
                  !isOutputError &&
                  !line.startsWith("+") &&
                  !line.startsWith("-")
                }
              >
                {" "}
                → {line}
              </Text>
            ),
          });
        });
      }
    }
  });
}

// Format tool input summary (single line)
function formatToolInputSummary(
  name: string,
  args: Record<string, unknown> | undefined,
  workspaceRoot?: string,
): string {
  if (!args) return "";

  switch (name) {
    case "read":
    case "read_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot,
      );
      const offset = args.offset ? `:${args.offset}` : "";
      return path + offset;
    }
    case "write":
    case "write_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot,
      );
      const lines = String(args.content || "").split("\n").length;
      return `${path} (${lines} lines)`;
    }
    case "edit":
    case "edit_file": {
      const path = relativePath(
        String(args.filePath || args.path || ""),
        workspaceRoot,
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

// Format tool output (returns lines)
function formatToolOutput(
  name: string,
  output: string,
  workspaceRoot?: string,
): { outputLines: string[]; isOutputError: boolean; markdown?: string } {
  if (!output) return { outputLines: [], isOutputError: false };

  const isOutputError =
    output.startsWith("Error:") || output.includes('"success":false');

  // Try to parse JSON
  let parsed: any = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch {
      /* not JSON */
    }
  }

  if (parsed) {
    if (parsed.success === false) {
      return { outputLines: [parsed.error || "Failed"], isOutputError: true };
    }

    switch (name) {
      case "edit":
      case "edit_file": {
        const stats: string[] = [];
        if (parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        const patch = typeof parsed.patch === "string" ? parsed.patch : "";
        const patchTruncated = Boolean(parsed.patchTruncated);
        return {
          outputLines: [stats.join(" ") || "applied"].filter(Boolean),
          markdown: patch
            ? `\n\n\`\`\`diff\n${patch}${patchTruncated ? "\n\\ No newline at end of truncated patch" : ""}\n\`\`\`\n`
            : undefined,
          isOutputError: false,
        };
      }
      case "write":
      case "write_file": {
        const stats: string[] = [];
        if (parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        const patch = typeof parsed.patch === "string" ? parsed.patch : "";
        const patchTruncated = Boolean(parsed.patchTruncated);
        return {
          outputLines: [`${parsed.lines} lines written`, ...stats].filter(Boolean),
          markdown: patch
            ? `\n\n\`\`\`diff\n${patch}${patchTruncated ? "\n\\ No newline at end of truncated patch" : ""}\n\`\`\`\n`
            : undefined,
          isOutputError: false,
        };
      }
      case "read":
      case "read_file": {
        const showing = parsed.showing
          ? `(${parsed.showing.from}-${parsed.showing.to})`
          : "";
        return {
          outputLines: [`${parsed.totalLines || "?"} lines ${showing}`],
          isOutputError: false,
        };
      }
      case "bash":
      case "execute_command": {
        const exitCode = parsed.exit_code ?? parsed.exitCode;
        if (parsed.status === "background") {
          return {
            outputLines: ["started in background"],
            isOutputError: false,
          };
        }
        const stdoutLines = String(parsed.stdout || "")
          .split("\n")
          .filter(Boolean);
        const limited = stdoutLines.slice(0, MAX_OUTPUT_LINES);
        if (stdoutLines.length > MAX_OUTPUT_LINES) {
          limited.push(
            `… (${stdoutLines.length - MAX_OUTPUT_LINES} more lines)`,
          );
        }
        if (exitCode !== 0 && exitCode !== undefined) {
          limited.unshift(`exit ${exitCode}`);
        }
        return {
          outputLines: limited.map((l) => truncate(l, 70)),
          isOutputError: exitCode !== 0,
        };
      }
      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const count = parsed.matches.length;
          const files = [
            ...new Set(parsed.matches.map((m: any) => m.file || m.path)),
          ];
          return {
            outputLines: [`${count} matches in ${files.length} files`],
            isOutputError: false,
          };
        }
        return { outputLines: ["no matches"], isOutputError: false };
      }
      case "glob": {
        if (Array.isArray(parsed.files)) {
          return {
            outputLines: [`${parsed.files.length} files found`],
            isOutputError: false,
          };
        }
        return { outputLines: [], isOutputError: false };
      }
      case "task": {
        return { outputLines: ["completed"], isOutputError: false };
      }
      default: {
        if (parsed.message)
          return {
            outputLines: [truncate(parsed.message, 70)],
            isOutputError: false,
          };
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
  return { outputLines: limited, isOutputError };
}

// Helper: Render text content with markdown support
function renderContentLines(
  content: string,
  feedWidth: number,
  msgId: string,
  prefix: string,
  lines: Array<{ key: string; node: React.ReactNode }>,
) {
  try {
    const rendered = renderMarkdownWithWidth(content, Math.max(40, feedWidth));
    const wrappedLines = wrapAnsiText(rendered, Math.max(10, feedWidth - 2));

    wrappedLines.forEach((l, idx) => {
      lines.push({
        key: `${msgId}:${prefix}:${idx}`,
        node: <Text>{l}</Text>,
      });
    });
  } catch {
    // Fallback to plain text
    wrapText(content, Math.max(10, feedWidth - 2)).forEach((l, idx) => {
      lines.push({
        key: `${msgId}:${prefix}:${idx}`,
        node: <Text color="white">{l}</Text>,
      });
    });
  }
}
