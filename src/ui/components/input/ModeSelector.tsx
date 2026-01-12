/**
 * Mode selector component for switching between agent modes.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { AgentMode as CodingAgentMode } from "../../../ai-agent.js";
import { MODES, type ThemeColors } from "../../types.js";

export interface ModeSelectorProps {
  mode: CodingAgentMode;
  themeColors: ThemeColors;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, themeColors }) => {
  const modeColor =
    mode === "agent"
      ? themeColors.primary
      : mode === "plan"
        ? themeColors.warning
        : themeColors.success;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <Box paddingX={2} gap={2}>
      {MODES.map((m) => (
        <Text
          key={m}
          color={m === mode ? modeColor : themeColors.textMuted}
          dimColor={m !== mode}
          bold={m === mode}
        >
          {m === mode ? figures.circleFilled : figures.circle} {capitalize(m)}
        </Text>
      ))}
      <Text color={themeColors.textMuted} dimColor>
        [Tab]
      </Text>
    </Box>
  );
};
