import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ChatMessage, ToolPart, MessagePart } from "../types.js";
import { renderMarkdown } from "../../markdown.js";

interface AssistantMessageProps {
  message: ChatMessage;
  width: number;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  width,
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
        {message.isStreaming && <Spinner type="dots" />}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {groupedParts.map((item, idx) => {
        if ("tools" in item && item.type === "tool-group") {
          return <ToolGroup key={idx} tools={item.tools} />;
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
                <Text color="magenta">{figures.pointer}</Text>
                <Text color="magenta" bold>
                  Thinking
                </Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color="gray" dimColor italic wrap="wrap">
                  {preview}
                </Text>
              </Box>
            </Box>
          );
        }

        if (part.type === "action") {
          return (
            <Text key={idx} color="gray">
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
                <Text color="red" bold>
                  {figures.cross} Error
                </Text>
              </Box>
              <Box paddingLeft={2} flexDirection="column">
                <Text color="red" wrap="wrap">
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
          <Spinner type="dots" />
        </Box>
      )}
    </Box>
  );
};

interface ToolGroupProps {
  tools: ToolPart[];
}

const ToolGroup: React.FC<ToolGroupProps> = ({ tools }) => {
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
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
            ) : (
              <Text color="gray">{figures.circleFilled}</Text>
            )}
            <Text bold>
              Read {readTools.length}{" "}
              {readTools.length === 1 ? "file" : "files"}
            </Text>
          </Box>
          <Box flexDirection="column" paddingLeft={2}>
            {readTools.map((tool, i) => (
              <Text key={i} color="gray">
                Read {extractFileName(tool)}
              </Text>
            ))}
          </Box>
        </Box>
      )}
      {otherTools.map((tool, idx) => (
        <Box key={idx} gap={1}>
          {tool.status === "running" ? (
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
          ) : (
            <Text color="gray">{figures.circleFilled}</Text>
          )}
          <Text bold>{formatToolName(tool)}</Text>
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
