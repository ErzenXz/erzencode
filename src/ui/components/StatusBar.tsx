/**
 * Status Bar - Clean, minimal status display
 * Shows current status, thinking indicator, and elapsed time
 */

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

const THINKING_ICONS: Record<ThinkingLevel, string> = {
  off: "",
  low: "◐",
  medium: "◑",
  high: "◓",
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
  const showThinking = supportsThinking && thinkingLevel !== "off";

  return (
    <Box paddingX={1} marginY={0}>
      {isThinking ? (
        <Box gap={1}>
          <Text color={themeColors.warning}>
            <Spinner type="dots" />
          </Text>
          <Text color={themeColors.text} bold>{statusText}</Text>
          <Text color={themeColors.textMuted}>
            {formatTime(elapsedTime)}
          </Text>
          {showThinking && (
            <Text color={themeColors.secondary}>
              {THINKING_ICONS[thinkingLevel]} {thinkingLevel}
            </Text>
          )}
          {cancelCountdown !== null && (
            <Text color={themeColors.error} bold>
              ESC again to cancel
            </Text>
          )}
        </Box>
      ) : (
        <Box gap={1}>
          <Text color={themeColors.success}>{figures.tick}</Text>
          <Text color={themeColors.textMuted}>{statusText}</Text>
          {showThinking && (
            <Text color={themeColors.textDim}>
              [{thinkingLevel}]
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

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
