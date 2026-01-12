import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import Spinner from "ink-spinner";
import { formatTime, truncate, stripAnsi } from "../utils.js";
import type { ThinkingLevel, ThemeColors } from "../types.js";

interface StatusBarProps {
  status: string;
  isThinking: boolean;
  elapsedTime: number;
  cancelCountdown: number | null;
  maxWidth: number;
  thinkingLevel?: ThinkingLevel;
  supportsThinking?: boolean;
  themeColors: ThemeColors;
}

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: "",
  low: "Think: Low",
  medium: "Think: Med",
  high: "Think: High",
};

const StatusBarImpl: React.FC<StatusBarProps> = ({
  status,
  isThinking,
  elapsedTime,
  cancelCountdown,
  maxWidth,
  thinkingLevel = "off",
  supportsThinking = false,
  themeColors,
}) => {
  const statusText = truncate(stripAnsi(status), maxWidth);
  const thinkingLabel =
    supportsThinking && thinkingLevel !== "off"
      ? THINKING_LABELS[thinkingLevel]
      : "";

  return (
    <Box paddingX={1} gap={2}>
      {isThinking ? (
        <Box gap={1}>
          <Text color={themeColors.warning}><Spinner type="dots" /></Text>
          <Text color={themeColors.primary}>{statusText}</Text>
          <Text color={themeColors.textMuted}>{formatTime(elapsedTime)}</Text>
          {thinkingLabel && (
            <Text color={themeColors.secondary}>[{thinkingLabel}]</Text>
          )}
        </Box>
      ) : (
        <Box gap={2}>
          <Text color={themeColors.textMuted}>
            {figures.bullet} {statusText}
          </Text>
          {thinkingLabel && (
            <Text color={themeColors.secondary}>[{thinkingLabel}]</Text>
          )}
        </Box>
      )}
      {cancelCountdown !== null && (
        <Text color={themeColors.error} bold>ESC again to cancel</Text>
      )}
    </Box>
  );
};

// Memoize StatusBar to prevent unnecessary re-renders
export const StatusBar = React.memo(
  StatusBarImpl,
  (prev, next) => {
    return (
      prev.status === next.status &&
      prev.isThinking === next.isThinking &&
      prev.elapsedTime === next.elapsedTime &&
      prev.cancelCountdown === next.cancelCountdown &&
      prev.maxWidth === next.maxWidth &&
      prev.thinkingLevel === next.thinkingLevel &&
      prev.supportsThinking === next.supportsThinking &&
      prev.themeColors === next.themeColors
    );
  }
);
