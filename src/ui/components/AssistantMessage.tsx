import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ChatMessage, ToolPart, MessagePart, ThemeColors } from "../types.js";
import { renderMarkdown } from "../../markdown.js";

interface AssistantMessageProps {
  message: ChatMessage;
  width: number;
  themeColors?: ThemeColors;
}

// Default theme colors for backwards compatibility
const defaultColors: ThemeColors = {
  primary: "#7dd3fc",
  secondary: "#c4b5fd",
  success: "#4ade80",
  warning: "#fbbf24",
  error: "#f87171",
  info: "#38bdf8",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  border: "#475569",
  user: "#4ade80",
  assistant: "#7dd3fc",
  tool: "#fbbf24",
};

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  width,
  themeColors = defaultColors,
}) => {
  const parts = message.parts ?? [];

  // Group consecutive tools together
  const groupedParts: Array<
    MessagePart | { type: "tool-group"; tools: ToolPart[] }
  > = [];
  let currentToolGroup: ToolPart[] = [];

  for (const part of parts) {
    if (part.type === "tool") {
      currentToolGroup.push(part);
    } else {
      if (currentToolGroup.length > 0) {
        groupedParts.push({ type: "tool-group", tools: currentToolGroup });
        currentToolGroup = [];
      }
      groupedParts.push(part);
    }
  }
  if (currentToolGroup.length > 0) {
    groupedParts.push({ type: "tool-group", tools: currentToolGroup });
  }

  // If no parts, show content as markdown
  if (groupedParts.length === 0 && message.content) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text wrap="wrap">{renderMarkdown(message.content)}</Text>
        {message.isStreaming && <Text color={themeColors.warning}><Spinner type="dots" /></Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {groupedParts.map((item, idx) => {
        if ("tools" in item && item.type === "tool-group") {
          return <ToolGroup key={idx} tools={item.tools} themeColors={themeColors} />;
        }

        const part = item as MessagePart;

        if (part.type === "thinking") {
          // Display thinking with a visual indicator
          const thinkingLines = part.content
            .split("\n")
            .filter((line) => line.trim());
          const preview =
            thinkingLines.length > 5
              ? thinkingLines.slice(0, 5).join("\n") + "\n..."
              : part.content;
          return (
            <Box key={idx} flexDirection="column" marginY={0}>
              <Box gap={1}>
                <Text color={themeColors.secondary}>{figures.pointer}</Text>
                <Text color={themeColors.secondary} bold>
                  Thinking
                </Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color={themeColors.textDim} dimColor italic wrap="wrap">
                  {preview}
                </Text>
              </Box>
            </Box>
          );
        }

        if (part.type === "action") {
          return (
            <Text key={idx} color={themeColors.textMuted}>
              {part.content}
            </Text>
          );
        }

        if (part.type === "text" && part.content.trim()) {
          return (
            <Box key={idx} flexDirection="column">
              <Text wrap="wrap">{renderMarkdown(part.content)}</Text>
            </Box>
          );
        }

        if (part.type === "error") {
          return (
            <Box key={idx} flexDirection="column" marginY={1}>
              <Box gap={1}>
                <Text color={themeColors.error} bold>
                  {figures.cross} Error
                </Text>
              </Box>
              <Box paddingLeft={2} flexDirection="column">
                <Text color={themeColors.error} wrap="wrap">
                  {part.content}
                </Text>
              </Box>
            </Box>
          );
        }

        return null;
      })}
      {message.isStreaming && (
        <Box marginTop={1}>
          <Text color={themeColors.warning}><Spinner type="dots" /></Text>
        </Box>
      )}
    </Box>
  );
};

interface ToolGroupProps {
  tools: ToolPart[];
  themeColors: ThemeColors;
}

const ToolGroup: React.FC<ToolGroupProps> = ({ tools, themeColors }) => {
  // Group by action type
  const readTools = tools.filter((t) => t.name.toLowerCase().includes("read"));
  const otherTools = tools.filter(
    (t) => !t.name.toLowerCase().includes("read"),
  );

  const anyRunning = tools.some((t) => t.status === "running");

  return (
    <Box flexDirection="column" marginY={0}>
      {readTools.length > 0 && (
        <Box flexDirection="column">
          <Box gap={1}>
            {anyRunning && readTools.some((t) => t.status === "running") ? (
              <Text color={themeColors.warning}>
                <Spinner type="dots" />
              </Text>
            ) : (
              <Text color={themeColors.textMuted}>{figures.circleFilled}</Text>
            )}
            <Text color={themeColors.text} bold>
              Read {readTools.length}{" "}
              {readTools.length === 1 ? "file" : "files"}
            </Text>
          </Box>
          <Box flexDirection="column" paddingLeft={2}>
            {readTools.map((tool, i) => (
              <Text key={i} color={themeColors.textMuted}>
                Read {extractFileName(tool)}
              </Text>
            ))}
          </Box>
        </Box>
      )}
      {otherTools.map((tool, idx) => (
        <Box key={idx} gap={1}>
          {tool.status === "running" ? (
            <Text color={themeColors.warning}>
              <Spinner type="dots" />
            </Text>
          ) : (
            <Text color={themeColors.textMuted}>{figures.circleFilled}</Text>
          )}
          <Text color={themeColors.text} bold>{formatToolName(tool)}</Text>
        </Box>
      ))}
    </Box>
  );
};

function extractFileName(tool: ToolPart): string {
  if (!tool.args) return tool.name;
  const path = String(tool.args.path || tool.args.file_path || "");
  return path.split("/").pop() || path || tool.name;
}

function formatToolName(tool: ToolPart): string {
  const name = tool.name.replace(/_/g, " ");
  if (!tool.args) return name;

  const path = String(tool.args.path || tool.args.file_path || "");
  if (path) {
    const fileName = path.split("/").pop() || path;
    return `${name} ${fileName}`;
  }

  return name;
}
