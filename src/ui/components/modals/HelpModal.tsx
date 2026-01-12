/**
 * Help modal showing commands and shortcuts.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ThemeColors } from "../../types.js";
import { SLASH_COMMANDS } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

export interface HelpModalProps {
  themeColors: ThemeColors;
}

export const HelpModal: React.FC<HelpModalProps> = ({ themeColors }) => (
  <ModalContainer
    title="Help & Commands"
    width={68}
    footer="ESC to close"
    borderColor={themeColors.info}
    textColor={themeColors.text}
    mutedColor={themeColors.textMuted}
  >
    <Box flexDirection="column">
      {/* Commands section */}
      <Box marginBottom={1}>
        <Text color={themeColors.secondary} bold>{figures.circleFilled} Commands</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {SLASH_COMMANDS.slice(0, 10).map((cmd) => (
          <Box key={cmd.name} gap={1}>
            <Box width={14}>
              <Text color={themeColors.primary} bold>/{cmd.name}</Text>
            </Box>
            <Text color={themeColors.textMuted}>{cmd.description}</Text>
          </Box>
        ))}
      </Box>
      
      {/* More commands */}
      <Box flexDirection="column" marginBottom={1}>
        {SLASH_COMMANDS.slice(10).map((cmd) => (
          <Box key={cmd.name} gap={1}>
            <Box width={14}>
              <Text color={themeColors.primary} bold>/{cmd.name}</Text>
            </Box>
            <Text color={themeColors.textMuted}>{cmd.description}</Text>
          </Box>
        ))}
      </Box>

      {/* Shortcuts section */}
      <Box marginBottom={1} marginTop={1}>
        <Text color={themeColors.secondary} bold>{figures.circleFilled} Keyboard Shortcuts</Text>
      </Box>
      
      <Box flexDirection="column">
        <Box gap={1}>
          <Box width={14}><Text color={themeColors.warning} bold>Tab</Text></Box>
          <Text color={themeColors.text}>Switch agent mode</Text>
        </Box>
        <Box gap={1}>
          <Box width={14}><Text color={themeColors.warning} bold>ESC ESC</Text></Box>
          <Text color={themeColors.text}>Cancel AI response</Text>
        </Box>
        <Box gap={1}>
          <Box width={14}><Text color={themeColors.warning} bold>↑/↓</Text></Box>
          <Text color={themeColors.text}>History / Navigate lists</Text>
        </Box>
        <Box gap={1}>
          <Box width={14}><Text color={themeColors.warning} bold>PgUp/PgDn</Text></Box>
          <Text color={themeColors.text}>Scroll chat history</Text>
        </Box>
        <Box gap={1}>
          <Box width={14}><Text color={themeColors.warning} bold>Ctrl+Enter</Text></Box>
          <Text color={themeColors.text}>Insert newline</Text>
        </Box>
        <Box gap={1}>
          <Box width={14}><Text color={themeColors.warning} bold>Ctrl+C</Text></Box>
          <Text color={themeColors.text}>Exit erzencode</Text>
        </Box>
      </Box>
    </Box>
  </ModalContainer>
);
