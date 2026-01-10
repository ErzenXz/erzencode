import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ProviderType } from "../../ai-provider.js";
import type { AgentMode as CodingAgentMode } from "../../ai-agent.js";
import type { TodoItem } from "../../tools-standalone.js";
import type { FileInfo } from "../types.js";
import { formatTokens, truncate, wrapText } from "../utils.js";

interface ContextSidebarProps {
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  themeId: string;
  status: string;
  isThinking: boolean;
  sessionTokens: number;
  inputTokens: number;
  outputTokens: number;
  lastTaskInputTokens: number;
  lastTaskOutputTokens: number;
  activeFiles: Map<string, FileInfo>;
  runningTools: Array<{ id: string; name: string }>;
  todos: TodoItem[];
  width: number;
  height: number;
  contextLimit?: number; // Max context window in tokens
  pricing?: { input: number; output: number }; // per million tokens
  queueCount?: number; // Number of queued messages
}

// Format cost in dollars
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({
  model,
  status,
  isThinking,
  sessionTokens,
  inputTokens,
  outputTokens,
  lastTaskInputTokens,
  lastTaskOutputTokens,
  activeFiles,
  runningTools,
  todos,
  width,
  height,
  contextLimit = 200000, // Default 200k context
  pricing,
  queueCount = 0,
}) => {
  // Calculate context usage percentage
  const contextPercent = Math.min(
    100,
    Math.round((sessionTokens / contextLimit) * 100),
  );
  const contextColor =
    contextPercent > 80 ? "red" : contextPercent > 50 ? "yellow" : "green";

  // Create a minimal progress bar
  const barWidth = Math.max(8, width - 12);
  const filledWidth = Math.round((contextPercent / 100) * barWidth);
  const progressBar =
    "█".repeat(filledWidth) + "░".repeat(barWidth - filledWidth);

  // Calculate cost
  const inputCost = pricing ? (inputTokens / 1_000_000) * pricing.input : 0;
  const outputCost = pricing ? (outputTokens / 1_000_000) * pricing.output : 0;
  const totalCost = inputCost + outputCost;

  // Calculate last task cost
  const lastTaskInputCost = pricing
    ? (lastTaskInputTokens / 1_000_000) * pricing.input
    : 0;
  const lastTaskOutputCost = pricing
    ? (lastTaskOutputTokens / 1_000_000) * pricing.output
    : 0;
  const lastTaskCost = lastTaskInputCost + lastTaskOutputCost;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderLeft
      borderColor="gray"
      paddingLeft={1}
      overflow="hidden"
    >
      {/* Model & Context */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>
          {truncate(model, Math.max(10, width - 4))}
        </Text>

        {/* Context usage with progress bar - always show */}
        <Box flexDirection="column" marginTop={0}>
          <Box>
            <Text color="gray" dimColor>
              Context{" "}
            </Text>
            <Text color={contextColor} bold>
              {contextPercent}%
            </Text>
          </Box>
          <Text color={contextColor} dimColor>
            {progressBar}
          </Text>
          <Text color="gray" dimColor>
            {formatTokens(sessionTokens)}/{formatTokens(contextLimit)}
          </Text>
        </Box>

        {/* Cost tracking - always show */}
        <Box flexDirection="column" marginTop={0}>
          <Box>
            <Text color="gray" dimColor>
              Cost:{" "}
            </Text>
            <Text color="green" bold>
              {formatCost(totalCost)}
            </Text>
            {lastTaskCost > 0 && (
              <Text color="gray" dimColor>
                {" "}
                (+{formatCost(lastTaskCost)})
              </Text>
            )}
          </Box>
        </Box>

        {/* Token breakdown */}
        {(inputTokens > 0 || outputTokens > 0) && (
          <Text color="gray" dimColor>
            {figures.arrowDown}
            {formatTokens(inputTokens)} {figures.arrowUp}
            {formatTokens(outputTokens)}
          </Text>
        )}

        {/* Message queue indicator */}
        {queueCount > 0 && (
          <Box marginTop={0}>
            <Text color="cyan" bold>
              {figures.info} {queueCount} queued
            </Text>
          </Box>
        )}
      </Box>

      {/* Running Tools */}
      {runningTools.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Box gap={1}>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text bold color="yellow">
              Running
            </Text>
          </Box>
          {runningTools.slice(0, 3).map((t) => (
            <Text key={t.id} color="yellow" dimColor>
              {truncate(t.name.replace(/_/g, " "), Math.max(10, width - 4))}
            </Text>
          ))}
          {runningTools.length > 3 && (
            <Text color="gray" dimColor>
              +{runningTools.length - 3} more
            </Text>
          )}
        </Box>
      )}

      {/* Active Files */}
      {activeFiles.size > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            {figures.tick} Files
          </Text>
          {Array.from(activeFiles.values())
            .slice(0, 5)
            .map((f) => (
              <Text key={f.path} color="gray" dimColor>
                {f.action === "read"
                  ? figures.circle
                  : f.action === "write"
                    ? figures.tick
                    : figures.pointer}{" "}
                {truncate(
                  f.path.split("/").pop() ?? "",
                  Math.max(8, width - 6),
                )}
              </Text>
            ))}
          {activeFiles.size > 5 && (
            <Text color="gray" dimColor>
              +{activeFiles.size - 5} more
            </Text>
          )}
        </Box>
      )}

      {/* Tasks */}
      {todos.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            {figures.bullet} Tasks (
            {todos.filter((t) => t.status === "completed").length}/
            {todos.length})
          </Text>
          {todos
            .filter((t) => t.status !== "completed")
            .slice(0, 4)
            .flatMap((t) => {
              const icon =
                t.status === "in_progress" ? figures.pointer : figures.circle;
              const color = t.status === "in_progress" ? "yellow" : "gray";
              const wrapped = wrapText(t.content, Math.max(8, width - 5));
              return wrapped.slice(0, 2).map((line, idx) => (
                <Text key={`${t.id}:${idx}`} color={color} dimColor={idx > 0}>
                  {idx === 0
                    ? `${icon} ${line}`
                    : `  ${line.slice(0, Math.max(5, width - 6))}...`}
                </Text>
              ));
            })}
        </Box>
      )}

      {/* Status - only when thinking */}
      {isThinking && status && (
        <Box flexDirection="column" marginTop={0}>
          <Text color="blue" dimColor>
            {truncate(status, Math.max(10, width - 4))}
          </Text>
        </Box>
      )}

      {/* Spacer */}
      <Box flexGrow={1} />

      {/* Help hints */}
      <Box flexDirection="column">
        <Text color="gray" dimColor>
          {"─".repeat(Math.min(12, width - 4))}
        </Text>
        <Text color="gray" dimColor>
          /help • ESC×2 cancel
        </Text>
      </Box>
    </Box>
  );
};
