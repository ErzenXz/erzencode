import React, { useMemo } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ProviderType } from "@erzencode/core/ai-provider";
import type { AgentMode as CodingAgentMode } from "@erzencode/core/ai-agent";
import type { TodoItem } from "@erzencode/core/tools";
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
  height: number;
  contextLimit: number;
  pricing?: { input: number; output: number };
  queueCount?: number;
  isCompacting?: boolean;
}

// Format cost in dollars
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

// Fixed sidebar width for consistency
const SIDEBAR_WIDTH = 24;

export const ContextSidebar: React.FC<ContextSidebarProps> = ({
  model,
  mode,
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
  height,
  contextLimit,
  pricing,
  queueCount = 0,
  isCompacting = false,
}) => {
  const width = SIDEBAR_WIDTH;
  // Memoize calculations for performance
  const { contextPercent, contextColor, progressBar, totalCost, lastTaskCost } = useMemo(() => {
    const pct = contextLimit > 0 ? Math.min(100, Math.round((sessionTokens / contextLimit) * 100)) : 0;
    const color = pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
    
    // Compact progress bar
    const barWidth = 16;
    const filledWidth = Math.round((pct / 100) * barWidth);
    const bar = "█".repeat(filledWidth) + "░".repeat(barWidth - filledWidth);
    
    // Costs
    const inCost = pricing ? (inputTokens / 1_000_000) * pricing.input : 0;
    const outCost = pricing ? (outputTokens / 1_000_000) * pricing.output : 0;
    const total = inCost + outCost;
    
    const lastIn = pricing ? (lastTaskInputTokens / 1_000_000) * pricing.input : 0;
    const lastOut = pricing ? (lastTaskOutputTokens / 1_000_000) * pricing.output : 0;
    const lastTotal = lastIn + lastOut;
    
    return { contextPercent: pct, contextColor: color, progressBar: bar, totalCost: total, lastTaskCost: lastTotal };
  }, [sessionTokens, contextLimit, pricing, inputTokens, outputTokens, lastTaskInputTokens, lastTaskOutputTokens]);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {/* Header: Mode */}
      <Box justifyContent="center" marginBottom={0}>
        <Text color={mode === "agent" ? "blue" : mode === "plan" ? "yellow" : "green"} bold>
          {mode.toUpperCase()}
        </Text>
      </Box>

      {/* Context usage - compact display */}
      <Box flexDirection="column" marginTop={0}>
        <Box justifyContent="space-between">
          <Text color="gray">Context</Text>
          <Text color={contextColor} bold>{contextPercent}%</Text>
        </Box>
        <Text color={contextColor}>{progressBar}</Text>
        <Text color="gray" dimColor>
          {formatTokens(sessionTokens)}/{formatTokens(contextLimit)}
        </Text>
        {isCompacting && (
          <Box gap={1}>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text color="yellow">Compacting...</Text>
          </Box>
        )}
      </Box>

      {/* Cost - compact */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">Cost</Text>
        <Text color="green" bold>{formatCost(totalCost)}</Text>
      </Box>
      {lastTaskCost > 0 && (
        <Text color="gray" dimColor>+{formatCost(lastTaskCost)} last</Text>
      )}

      {/* Tokens: input/output */}
      {(inputTokens > 0 || outputTokens > 0) && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>
            {figures.arrowDown}{formatTokens(inputTokens)} {figures.arrowUp}{formatTokens(outputTokens)}
          </Text>
        </Box>
      )}

      {/* Queue indicator */}
      {queueCount > 0 && (
        <Text color="cyan" bold>{figures.info} {queueCount} queued</Text>
      )}

      {/* Running Tools - compact */}
      {runningTools.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box gap={1}>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text color="yellow" bold>Tools</Text>
          </Box>
          {runningTools.slice(0, 2).map((t) => (
            <Text key={t.id} color="yellow" dimColor>
              {truncate(t.name.replace(/_/g, " "), width - 3)}
            </Text>
          ))}
          {runningTools.length > 2 && (
            <Text color="gray" dimColor>+{runningTools.length - 2} more</Text>
          )}
        </Box>
      )}

      {/* Active Files - compact */}
      {activeFiles.size > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green" bold>{figures.tick} Files ({activeFiles.size})</Text>
          {Array.from(activeFiles.values()).slice(0, 3).map((f) => (
            <Text key={f.path} color="gray" dimColor>
              {truncate(f.path.split("/").pop() ?? "", width - 3)}
            </Text>
          ))}
          {activeFiles.size > 3 && (
            <Text color="gray" dimColor>+{activeFiles.size - 3} more</Text>
          )}
        </Box>
      )}

      {/* Tasks - compact */}
      {todos.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>
            {figures.bullet} {todos.filter((t) => t.status === "completed").length}/{todos.length} Tasks
          </Text>
          {todos.filter((t) => t.status !== "completed").slice(0, 3).map((t) => (
            <Text key={t.id} color={t.status === "in_progress" ? "yellow" : "gray"} dimColor>
              {t.status === "in_progress" ? figures.pointer : figures.circle} {truncate(t.content, width - 4)}
            </Text>
          ))}
        </Box>
      )}

      {/* Spacer */}
      <Box flexGrow={1} />

      {/* Status when thinking */}
      {isThinking && status && (
        <Text color="blue" dimColor>{truncate(status, width - 2)}</Text>
      )}

      {/* Model name at bottom */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>{truncate(model, width - 2)}</Text>
      </Box>
    </Box>
  );
};

export { SIDEBAR_WIDTH };
