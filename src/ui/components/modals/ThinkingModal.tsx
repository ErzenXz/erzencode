/**
 * Thinking level selection modal.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ThemeColors, ThinkingLevel } from "../../types.js";
import { THINKING_LEVELS, THINKING_LEVEL_DESCRIPTIONS } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

export interface ThinkingModalProps {
  currentLevel: ThinkingLevel;
  selectedIndex: number;
  supportsThinking: boolean;
  themeColors: ThemeColors;
}

const LEVEL_ICONS: Record<ThinkingLevel, string> = {
  off: figures.circleFilled,
  low: figures.line,
  medium: figures.pointer,
  high: figures.star,
};

export const ThinkingModal: React.FC<ThinkingModalProps> = ({
  currentLevel,
  selectedIndex,
  supportsThinking,
  themeColors,
}) => {
  return (
    <ModalContainer
      title="Thinking Level"
      width={55}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
      borderColor={themeColors.secondary}
      textColor={themeColors.text}
      mutedColor={themeColors.textMuted}
    >
      <Box flexDirection="column">
        {!supportsThinking && (
          <Box marginBottom={1} paddingX={1}>
            <Text color={themeColors.warning}>
              {figures.warning} Current model may not support native thinking
            </Text>
          </Box>
        )}
        {THINKING_LEVELS.map((level, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = level === currentLevel;
          const color = isSelected ? themeColors.primary : isCurrent ? themeColors.success : themeColors.text;
          
          return (
            <Box key={level} flexDirection="column" marginBottom={isSelected ? 1 : 0}>
              <Box gap={1}>
                <Text color={color} bold={isSelected}>
                  {isSelected ? figures.pointer : " "}
                </Text>
                <Text color={isSelected ? themeColors.secondary : themeColors.textMuted}>
                  {LEVEL_ICONS[level]}
                </Text>
                <Text color={color} bold={isSelected}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
                {isCurrent && <Text color={themeColors.success}>✓</Text>}
              </Box>
              {isSelected && (
                <Box paddingLeft={4}>
                  <Text color={themeColors.textMuted}>
                    {THINKING_LEVEL_DESCRIPTIONS[level]}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </ModalContainer>
  );
};
