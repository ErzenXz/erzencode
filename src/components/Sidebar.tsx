import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { TodoItem } from "../tools-standalone.js";

interface FileInfo {
  path: string;
  action: "read" | "write" | "edit";
  timestamp: number;
}

interface ModelContext {
  provider: string;
  model: string;
  mode: string;
  thinking: string;
  contextWindow?: number;
  tokensUsed?: number;
}

interface SidebarProps {
  modelContext: ModelContext;
  filesEdited: FileInfo[];
  todos: TodoItem[];
  width?: number;
  sessionInfo?: {
    name: string;
    messageCount: number;
    duration: number;
  };
}

const actionIcons = {
  read: figures.pointer,
  write: figures.tick,
  edit: "~",
};

const actionColors = {
  read: "blue",
  write: "green",
  edit: "yellow",
};

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m`;
}

function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return path.slice(0, maxLen - 3) + "...";
  return `.../${parts.slice(-2).join("/")}`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  modelContext,
  filesEdited,
  todos,
  width = 35,
  sessionInfo,
}) => {
  const recentFiles = filesEdited.slice(-5);
  const activeTodos = todos.filter((t) => t.status !== "completed");
  const completedTodos = todos.filter((t) => t.status === "completed");

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      {/* Model Context Section */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        marginBottom={1}
      >
        <Text bold color="cyan">
          {figures.info} Model Context
        </Text>
        <Box flexDirection="column" paddingLeft={1} marginTop={1}>
          <Box gap={1}>
            <Text color="gray">Provider:</Text>
            <Text color="yellow">{modelContext.provider}</Text>
          </Box>
          <Box gap={1}>
            <Text color="gray">Model:</Text>
            <Text color="green">{modelContext.model}</Text>
          </Box>
          <Box gap={1}>
            <Text color="gray">Mode:</Text>
            <Text color="blue">{modelContext.mode}</Text>
          </Box>
          {modelContext.thinking !== "off" && (
            <Box gap={1}>
              <Text color="gray">Thinking:</Text>
              <Text color="magenta">{modelContext.thinking}</Text>
            </Box>
          )}
          {modelContext.contextWindow !== undefined && modelContext.contextWindow > 0 && (
            <Box gap={1}>
              <Text color="gray">Context:</Text>
              <Text color="gray">
                {formatTokens(modelContext.contextWindow)} tokens
              </Text>
            </Box>
          )}
          {modelContext.tokensUsed !== undefined && modelContext.tokensUsed > 0 && (
            <Box gap={1}>
              <Text color="gray">Used:</Text>
              <Text color="yellow">{formatTokens(modelContext.tokensUsed)}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Session Info */}
      {sessionInfo && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
          marginBottom={1}
        >
          <Text bold color="blue">
            {figures.play} Session
          </Text>
          <Box flexDirection="column" paddingLeft={1} marginTop={1}>
            <Box gap={1}>
              <Text color="gray">Name:</Text>
              <Text>{sessionInfo.name}</Text>
            </Box>
            <Box gap={1}>
              <Text color="gray">Messages:</Text>
              <Text color="cyan">
                <Text>{sessionInfo.messageCount}</Text>
              </Text>
            </Box>
            <Box gap={1}>
              <Text color="gray">Duration:</Text>
              <Text color="gray">{formatDuration(sessionInfo.duration)}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Files Edited Section */}
      {recentFiles.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          marginBottom={1}
        >
          <Box justifyContent="space-between">
            <Text bold color="green">
              {figures.star} Files
            </Text>
            <Text color="gray" dimColor>
              <Text>{filesEdited.length}</Text>
            </Text>
          </Box>
          <Box flexDirection="column" paddingLeft={1} marginTop={1}>
            {recentFiles.map((file) => (
              <Box key={file.path} gap={1}>
                <Text color={actionColors[file.action]}>
                  {actionIcons[file.action]}
                </Text>
                <Text color="gray" wrap="truncate">
                  {truncatePath(file.path, 25)}
                </Text>
              </Box>
            ))}
            {filesEdited.length > 5 && (
              <Text color="gray" dimColor>
                +{filesEdited.length - 5} more
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* TODO List Section */}
      {todos.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          marginBottom={1}
        >
          <Box justifyContent="space-between">
            <Text bold color="cyan">
              {figures.bullet} Tasks
            </Text>
            <Text color="gray" dimColor>
              <Text>{completedTodos.length}</Text>/<Text>{todos.length}</Text>
            </Text>
          </Box>
          <Box flexDirection="column" paddingLeft={1} marginTop={1}>
            {activeTodos.slice(0, 5).map((todo) => {
              const icon =
                todo.status === "in_progress"
                  ? figures.play
                  : todo.status === "pending"
                    ? figures.circle
                    : figures.circleDotted;
              const color =
                todo.status === "in_progress"
                  ? "yellow"
                  : todo.status === "pending"
                    ? "gray"
                    : "blue";

              return (
                <Box key={todo.id} gap={1}>
                  <Text color={color}>{icon}</Text>
                  <Text
                    color={todo.status === "in_progress" ? "white" : "gray"}
                    wrap="truncate"
                  >
                    {todo.content.slice(0, 30)}
                    {todo.content.length > 30 ? "..." : ""}
                  </Text>
                </Box>
              );
            })}
            {completedTodos.length > 0 && (
              <Box gap={1} marginTop={1}>
                <Text color="green">{figures.tick}</Text>
                <Text color="gray" dimColor>
                  <Text>{completedTodos.length}</Text> completed
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Quick Tips */}
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          {figures.info} Quick Tips
        </Text>
        <Box flexDirection="column" paddingLeft={1}>
          <Text color="gray" dimColor>
            /help - Commands
          </Text>
          <Text color="gray" dimColor>
            /models - Switch model
          </Text>
          <Text color="gray" dimColor>
            Ctrl+C - Exit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
