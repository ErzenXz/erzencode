/**
 * Tool display component for rendering individual tool calls.
 * Beautiful styling with theme-aware colors.
 * Optimized with React.memo to prevent unnecessary rerenders.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ThemeColors, ToolPart } from "../../types.js";
import {
  TOOL_DISPLAY,
  truncate,
  formatToolInputSummary,
  formatToolOutput,
} from "./tool-utils.js";

export interface ToolDisplayProps {
  tool: ToolPart;
  msgId: string;
  groupIdx: number;
  toolIdx: number;
  workspaceRoot?: string;
  themeColors: ThemeColors;
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
}) => {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const display = TOOL_DISPLAY[tool.name] || { label: tool.name, icon: "○", color: "gray" };

  // Format input summary
  const inputSummary = formatToolInputSummary(tool.name, tool.args, workspaceRoot);

  // Format output (with children for task tool)
  // NOTE: We intentionally show output even while running, since many tools emit
  // progress/status updates that users want to see immediately.
  const { outputLines, isOutputError, stats, children } = tool.output
    ? formatToolOutput(tool.name, tool.output, workspaceRoot)
    : { outputLines: [], isOutputError: false, stats: undefined, children: undefined };

  const lines: React.ReactNode[] = [];

  // Determine colors based on state
  const iconColor = isRunning
    ? themeColors.warning
    : isError || isOutputError
      ? themeColors.error
      : mapToolColor(themeColors, display.color);
  const labelColor = isRunning
    ? themeColors.warning
    : isError || isOutputError
      ? themeColors.error
      : themeColors.text;

  // Header line: status icon + label + input summary + stats
  lines.push(
    <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:header`} gap={1}>
      {isRunning ? (
        <Text color={themeColors.warning}>
          <Spinner type="dots" />
        </Text>
      ) : (
        <Text color={isError || isOutputError ? themeColors.error : iconColor}>
          {isError || isOutputError ? figures.cross : display.icon}
        </Text>
      )}
      <Text color={labelColor} bold>{display.label}</Text>
      {inputSummary && <Text color={themeColors.textMuted}>{inputSummary}</Text>}
      {stats && (
        <Text color={isOutputError ? themeColors.error : themeColors.success}>
          {figures.arrowRight} {stats}
        </Text>
      )}
    </Box>
  );

  // For bash/execute_command, show the command on a separate line
  if ((tool.name === "bash" || tool.name === "execute_command") && tool.args) {
    const cmd = String(tool.args.command || "");
    if (cmd) {
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:cmd`} paddingLeft={2}>
          <Text color={themeColors.info}>$ </Text>
          <Text color={themeColors.textMuted}>{truncate(cmd, 70)}</Text>
        </Box>
      );
    }
  }

  // For edit tool, show compact diff preview (only when running or no patch in output)
  if ((tool.name === "edit" || tool.name === "edit_file") && tool.args && isRunning) {
    const oldStr = String(tool.args.oldString || tool.args.old_str || "");
    const newStr = String(tool.args.newString || tool.args.new_str || "");

    if (oldStr || newStr) {
      const oldLineCount = oldStr.split("\n").length;
      const newLineCount = newStr.split("\n").length;
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:diff-summary`} paddingLeft={2}>
          <Text color={themeColors.error}>-{oldLineCount}</Text>
          <Text color={themeColors.textMuted}> / </Text>
          <Text color={themeColors.success}>+{newLineCount}</Text>
          <Text color={themeColors.textMuted}> lines</Text>
        </Box>
      );
    }
  }

  // Render plain output lines (for bash output, errors, etc.)
  if (outputLines.length > 0) {
    outputLines.forEach((line, idx) => {
      const color = isOutputError
        ? themeColors.error
        : isRunning
          ? themeColors.textDim
          : themeColors.textMuted;
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:out:${idx}`} paddingLeft={2}>
          <Text color={color} dimColor={!isOutputError}>{line}</Text>
        </Box>
      );
    });
  }

  // Render nested children tools (for task/subagent tool)
  if (children && children.length > 0) {
    children.forEach((childTool, childIdx) => {
      const childDisplay = TOOL_DISPLAY[childTool.name] || { label: childTool.name, icon: "○", color: "gray" };
      const childIsError = childTool.status === "error";
      const childIconColor = childIsError ? themeColors.error : mapToolColor(themeColors, childDisplay.color);
      const childLabelColor = childIsError ? themeColors.error : themeColors.text;
      const childInputSummary = formatToolInputSummary(childTool.name, childTool.args, workspaceRoot);
      
      lines.push(
        <Box key={`${msgId}:tools:${groupIdx}:${toolIdx}:child:${childIdx}`} paddingLeft={3} gap={1}>
          <Text color={themeColors.textDim}>├</Text>
          <Text color={childIconColor}>
            {childIsError ? figures.cross : childDisplay.icon}
          </Text>
          <Text color={childLabelColor} bold>{childDisplay.label}</Text>
          {childInputSummary && <Text color={themeColors.textMuted}>{childInputSummary}</Text>}
          <Text color={childIsError ? themeColors.error : themeColors.success}>
            {figures.arrowRight} {childIsError ? "error" : "done"}
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
    // Only re-render if tool status or output changes
    return (
      prev.tool.name === next.tool.name &&
      prev.tool.status === next.tool.status &&
      prev.tool.output === next.tool.output &&
      prev.msgId === next.msgId &&
      prev.groupIdx === next.groupIdx &&
      prev.toolIdx === next.toolIdx
    );
  }
);

ToolDisplay.displayName = 'ToolDisplay';
