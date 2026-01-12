import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ChatMessage, ThemeColors } from "../types.js";

interface UserMessageProps {
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

export const UserMessage: React.FC<UserMessageProps> = ({ 
  message, 
  width,
  themeColors = defaultColors,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1} marginBottom={0}>
        <Text color={themeColors.user} bold>{figures.pointerSmall}</Text>
        <Text color={themeColors.user} bold>You</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color={themeColors.user} dimColor>│ </Text>
        <Text color={themeColors.text} wrap="wrap">{message.content}</Text>
      </Box>
    </Box>
  );
};
