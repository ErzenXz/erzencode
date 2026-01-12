/**
 * API key input modal.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ThemeColors } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

export interface ApiKeyModalProps {
  provider: string;
  providerName: string;
  envVar: string;
  apiKeyInput: string;
  cursorIndex: number;
  themeColors: ThemeColors;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  provider,
  providerName,
  envVar,
  apiKeyInput,
  cursorIndex,
  themeColors,
}) => {
  const maskedValue =
    apiKeyInput.length > 0
      ? apiKeyInput.slice(0, 4) +
        "•".repeat(Math.max(0, apiKeyInput.length - 4))
      : "";
  const cursor = "│";
  const safeCursorIndex = Math.max(
    0,
    Math.min(cursorIndex, maskedValue.length),
  );
  const displayValue =
    maskedValue.length === 0
      ? ""
      : maskedValue.slice(0, safeCursorIndex) +
        cursor +
        maskedValue.slice(safeCursorIndex);

  return (
    <ModalContainer
      title={`API Key: ${providerName}`}
      width={58}
      borderColor={themeColors.warning}
      textColor={themeColors.text}
      mutedColor={themeColors.textMuted}
      footer="Enter to save • ESC to cancel"
    >
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={themeColors.text}>
            {figures.warning} Enter your API key for{" "}
            <Text color={themeColors.primary} bold>{providerName}</Text>
          </Text>
        </Box>
        
        {/* Input field */}
        <Box marginBottom={1}>
          <Box 
            borderStyle="round" 
            borderColor={apiKeyInput ? themeColors.primary : themeColors.textDim} 
            paddingX={1} 
            width={48}
          >
            <Text color={themeColors.textMuted}>{figures.circleFilled} </Text>
            {apiKeyInput ? (
              <Text color={themeColors.text}>{displayValue}</Text>
            ) : (
              <>
                <Text color={themeColors.primary}>{cursor}</Text>
                <Text color={themeColors.textDim}> paste or type API key...</Text>
              </>
            )}
          </Box>
        </Box>

        {/* Status indicator */}
        {apiKeyInput && (
          <Box marginBottom={1}>
            <Text color={themeColors.success}>
              {figures.tick} {apiKeyInput.length} characters entered
            </Text>
          </Box>
        )}

        {/* Help text */}
        <Box flexDirection="column">
          <Text color={themeColors.textDim}>
            {figures.info} Alternative: set {envVar} env variable
          </Text>
          <Text color={themeColors.textDim}>
            {figures.info} Key saved to ~/.config/erzencode/global.json
          </Text>
        </Box>
      </Box>
    </ModalContainer>
  );
};
