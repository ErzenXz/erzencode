/**
 * Autocomplete dropdown component for slash commands.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { SlashCommand, ThemeColors } from "../../types.js";
import { clamp } from "../../utils.js";

export interface AutocompleteProps {
  matches: SlashCommand[];
  selectedIndex: number;
  maxItems?: number;
  prefix?: string;
  themeColors: ThemeColors;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
  matches,
  selectedIndex,
  maxItems = 5,
  prefix = "/",
  themeColors,
}) => {
  const windowStart = clamp(
    selectedIndex - Math.floor(maxItems / 2),
    0,
    Math.max(0, matches.length - maxItems),
  );
  const items = matches.slice(windowStart, windowStart + maxItems);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={themeColors.border}
      paddingX={1}
      marginX={1}
    >
      {items.map((cmd, idx) => {
        const actualIdx = windowStart + idx;
        const selected = actualIdx === selectedIndex;
        return (
          <Text
            key={cmd.name}
            color={selected ? themeColors.primary : themeColors.text}
            bold={selected}
          >
            {selected ? figures.pointer : " "} {prefix}{cmd.name}{" "}
            {cmd.description ? (
              <Text color={themeColors.textMuted} dimColor>
                - {cmd.description}
              </Text>
            ) : null}
          </Text>
        );
      })}
      <Text color={themeColors.textMuted} dimColor>
        Tab/Enter to select • Esc to close
      </Text>
    </Box>
  );
};
