import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import { formatTime, truncate, stripAnsi } from "../utils.js";
import type { ThinkingLevel } from "../types.js";

interface StatusBarProps {
  status: string;
  isThinking: boolean;
  elapsedTime: number;
  cancelCountdown: number | null;
  maxWidth: number;
  thinkingLevel?: ThinkingLevel;
  supportsThinking?: boolean;
}

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: "",
  low: "Think: Low",
  medium: "Think: Med",
  high: "Think: High",
};

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  isThinking,
  elapsedTime,
  cancelCountdown,
  maxWidth,
  thinkingLevel = "off",
  supportsThinking = false,
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
          <Spinner type="dots" />
          <Text color="cyan">{statusText}</Text>
          <Text color="gray">{formatTime(elapsedTime)}</Text>
          {thinkingLabel && (
            <Text color="magenta" dimColor>
              [{thinkingLabel}]
            </Text>
          )}
        </Box>
      ) : (
        <Box gap={2}>
          <Text color="gray">
            {figures.bullet} {statusText}
          </Text>
          {thinkingLabel && (
            <Text color="magenta" dimColor>
              [{thinkingLabel}]
            </Text>
          )}
        </Box>
      )}
      {cancelCountdown !== null && (
        <Text color="red" bold>
          ESC again to cancel
        </Text>
      )}
    </Box>
  );
};
