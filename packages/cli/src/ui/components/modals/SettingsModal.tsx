/**
 * Settings display modal.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { AgentMode as CodingAgentMode } from "@erzencode/core/ai-agent";
import type { ProviderType } from "@erzencode/core/ai-provider";
import type { ThemeColors } from "../../types.js";
import { formatTokens, truncate } from "../../utils.js";
import { ModalContainer } from "./ModalContainer.js";

export interface SettingsModalProps {
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  workingDirectory: string;
  sessionTokens: number;
  themeColors: ThemeColors;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  provider,
  model,
  mode,
  workingDirectory,
  sessionTokens,
  themeColors,
}) => {
  const modeColor =
    mode === "agent"
      ? themeColors.primary
      : mode === "plan"
        ? themeColors.warning
        : themeColors.success;

  const modeIcon = mode === "agent" ? figures.pointer : mode === "plan" ? figures.star : figures.info;

  return (
    <ModalContainer
      title="Current Settings"
      width={55}
      borderColor={themeColors.secondary}
      textColor={themeColors.text}
      mutedColor={themeColors.textMuted}
      footer="ESC to close"
    >
      <Box flexDirection="column">
        {/* Provider & Model */}
        <Box marginBottom={1}>
          <Text color={themeColors.secondary} bold>{figures.circleFilled} AI Configuration</Text>
        </Box>
        
        <Box gap={1} marginBottom={0}>
          <Box width={12}><Text color={themeColors.textMuted}>Provider</Text></Box>
          <Text color={themeColors.primary} bold>{provider}</Text>
        </Box>
        <Box gap={1} marginBottom={0}>
          <Box width={12}><Text color={themeColors.textMuted}>Model</Text></Box>
          <Text color={themeColors.text}>{model}</Text>
        </Box>
        <Box gap={1} marginBottom={1}>
          <Box width={12}><Text color={themeColors.textMuted}>Mode</Text></Box>
          <Text color={modeColor}>{modeIcon} {mode}</Text>
        </Box>

        {/* Session Info */}
        <Box marginBottom={1}>
          <Text color={themeColors.secondary} bold>{figures.circleFilled} Session</Text>
        </Box>
        
        <Box gap={1} marginBottom={0}>
          <Box width={12}><Text color={themeColors.textMuted}>Tokens</Text></Box>
          <Text color={themeColors.text}>{formatTokens(sessionTokens)}</Text>
        </Box>
        <Box gap={1}>
          <Box width={12}><Text color={themeColors.textMuted}>Directory</Text></Box>
          <Text color={themeColors.info}>{truncate(workingDirectory, 32)}</Text>
        </Box>
      </Box>
    </ModalContainer>
  );
};
