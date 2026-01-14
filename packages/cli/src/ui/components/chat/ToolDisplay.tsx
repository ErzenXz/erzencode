/**
 * Tool display component for rendering individual tool calls.
 * Claude Code style: ● ToolName(input) with detail line below.
 * Supports ctrl+o to expand full output.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ThemeColors, ToolPart } from "../../types.js";
import {
  TOOL_DISPLAY,
  truncate,
  formatToolInputAsCall,
  formatToolResultSummary,
  formatToolOutput,
} from "./tool-utils.js";

export interface ToolDisplayProps {
  tool: ToolPart;
  msgId: string;
  groupIdx: number;
  toolIdx: number;
  workspaceRoot?: string;
  themeColors: ThemeColors;
  isExpanded?: boolean;
}

function mapToolColor(themeColors: ThemeColors, c: string | undefined): string {
  switch (c) {
    case "success":
    case "greenBright":
    case "green":
      return themeColors.success;
    case "warning":
    case "yellowBright":
    case "yellow":
      return themeColors.warning;
    case "error":
    case "redBright":
    case "red":
      return themeColors.error;
    case "secondary":
    case "magentaBright":
    case "magenta":
      return themeColors.secondary;
    case "info":
    case "cyanBright":
    case "cyan":
    case "blueBright":
    case "blue":
      return themeColors.info;
    case "gray":
    default:
      return themeColors.textMuted;
  }
}

const ToolDisplayImpl: React.FC<ToolDisplayProps> = ({
  tool,
  msgId,
  groupIdx,
  toolIdx,
  workspaceRoot,
  themeColors,
  isExpanded = false,
}) => {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const display = TOOL_DISPLAY[tool.name] || { label: tool.name, icon: "●", color: "gray" };

  // Format input as function call style: ToolName(params)
  const inputCall = formatToolInputAsCall(tool.name, tool.args, workspaceRoot);

  // Get result summary
  const { summary: resultSummary, isError: isResultError, isExpandable } = tool.output
    ? formatToolResultSummary(tool.name, tool.output, workspaceRoot)
    : { summary: "", isError: false, isExpandable: false };

  // Get full output for expanded view
  const { outputLines, children } = isExpanded && tool.output
    ? formatToolOutput(tool.name, tool.output, workspaceRoot)
    : { outputLines: [], children: undefined };

  const lines: React.ReactNode[] = [];

  // Determine icon color based on state
  const iconColor = isRunning
    ? themeColors.warning
    : isError || isResultError
      ? themeColors.error
      : mapToolColor(themeColors, display.color);

  // Header line: ● ToolName(input_params)
  // Format: "● Search(pattern: "**/*.{ts,js,json}", path: "~/Projects/erzencode")"
  lines.push(
    <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:header`} gap={0}>
      {isRunning ? (
        <Text color={themeColors.warning}>
          <Spinner type="dots" />
        </Text>
      ) : (
        <Text color={iconColor}>{display.icon}</Text>
      )}
      <Text> </Text>
      <Text color={themeColors.text} bold>{display.label}</Text>
      {inputCall && (
        <>
          <Text color={themeColors.textMuted}>(</Text>
          <Text color={themeColors.textMuted}>{inputCall}</Text>
          <Text color={themeColors.textMuted}>)</Text>
        </>
      )}
    </Box>
  );

  // Detail line: └─ Result summary (ctrl+o to expand)
  if (!isRunning && resultSummary) {
    const showExpandHint = isExpandable && !isExpanded;
    lines.push(
      <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:result`} paddingLeft={1}>
        <Text color={themeColors.textDim}>└─ </Text>
        <Text color={isResultError ? themeColors.error : themeColors.success}>
          {resultSummary}
        </Text>
        {showExpandHint && (
          <Text color={themeColors.textDim}> (ctrl+o to expand)</Text>
        )}
      </Box>
    );
  }

  // Expanded output lines
  if (isExpanded && outputLines.length > 0) {
    outputLines.forEach((line, idx) => {
      const color = isResultError
        ? themeColors.error
        : themeColors.textMuted;
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:out:${idx}`} paddingLeft={3}>
          <Text color={color}>{line}</Text>
        </Box>
      );
    });
  }

  // For bash/execute_command running, show the command
  if ((tool.name === "bash" || tool.name === "execute_command") && tool.args && isRunning) {
    const cmd = String(tool.args.command || "");
    if (cmd) {
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:cmd`} paddingLeft={3}>
          <Text color={themeColors.textDim}>$ </Text>
          <Text color={themeColors.textMuted}>{truncate(cmd, 70)}</Text>
        </Box>
      );
    }
  }

  // Render nested children tools (for task/subagent tool)
  if (children && children.length > 0) {
    children.forEach((childTool, childIdx) => {
      const childDisplay = TOOL_DISPLAY[childTool.name] || { label: childTool.name, icon: "●", color: "gray" };
      const childIsError = childTool.status === "error";
      const childIconColor = childIsError ? themeColors.error : mapToolColor(themeColors, childDisplay.color);
      const childInput = formatToolInputAsCall(childTool.name, childTool.args, workspaceRoot);
      
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:child:${childIdx}`} paddingLeft={3} gap={0}>
          <Text color={themeColors.textDim}>├─ </Text>
          <Text color={childIconColor}>{childDisplay.icon}</Text>
          <Text> </Text>
          <Text color={childIsError ? themeColors.error : themeColors.text} bold>
            {childDisplay.label}
          </Text>
          {childInput && (
            <>
              <Text color={themeColors.textMuted}>(</Text>
              <Text color={themeColors.textMuted}>{childInput}</Text>
              <Text color={themeColors.textMuted}>)</Text>
            </>
          )}
          <Text color={childIsError ? themeColors.error : themeColors.success}>
            {" "}{figures.arrowRight} {childIsError ? "error" : "done"}
          </Text>
        </Box>
      );
    });
  }

  return <Box flexDirection="column" marginBottom={0}>{lines}</Box>;
};

// Memoize to prevent unnecessary rerenders
export const ToolDisplay = React.memo(
  ToolDisplayImpl,
  (prev, next) => {
    return (
      prev.tool.name === next.tool.name &&
      prev.tool.status === next.tool.status &&
      prev.tool.output === next.tool.output &&
      prev.msgId === next.msgId &&
      prev.groupIdx === next.groupIdx &&
      prev.toolIdx === next.toolIdx &&
      prev.isExpanded === next.isExpanded
    );
  }
);

ToolDisplay.displayName = 'ToolDisplay';
