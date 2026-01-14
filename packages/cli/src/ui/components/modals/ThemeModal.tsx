/**
 * Theme selection modal.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ThemeColors } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

export interface ThemeModalProps {
  themes: Array<{ id: string; name: string; description?: string }>;
  currentThemeId: string;
  selectedIndex: number;
  themeColors: ThemeColors;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  themes,
  currentThemeId,
  selectedIndex,
  themeColors,
}) => {
  const maxVisible = 12;
  const windowStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      themes.length - maxVisible,
    ),
  );
  const visibleThemes = themes.slice(windowStart, windowStart + maxVisible);
  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < themes.length;

  return (
    <ModalContainer
      title="Select Theme"
      width={50}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
      borderColor={themeColors.primary}
      textColor={themeColors.text}
      mutedColor={themeColors.textMuted}
    >
      <Box flexDirection="column">
        {showScrollUp && (
          <Box>
            <Text color={themeColors.textMuted}>
              {figures.arrowUp} {windowStart} more above
            </Text>
          </Box>
        )}
        {visibleThemes.map((t, idx) => {
          const actualIdx = windowStart + idx;
          const isSelected = actualIdx === selectedIndex;
          const isCurrent = t.id === currentThemeId;
          
          return (
            <Box key={t.id} gap={1}>
              <Text
                color={isSelected ? themeColors.primary : isCurrent ? themeColors.success : themeColors.text}
                bold={isSelected}
              >
                {isSelected ? figures.pointer : " "}
              </Text>
              <Text
                color={isSelected ? themeColors.primary : isCurrent ? themeColors.success : themeColors.text}
                bold={isSelected}
              >
                {t.name}
              </Text>
              <Text color={themeColors.textDim}>({t.id})</Text>
              {isCurrent && <Text color={themeColors.success}>✓</Text>}
            </Box>
          );
        })}
        {showScrollDown && (
          <Box>
            <Text color={themeColors.textMuted}>
              {figures.arrowDown} {themes.length - windowStart - maxVisible} more below
            </Text>
          </Box>
        )}
      </Box>
    </ModalContainer>
  );
};
