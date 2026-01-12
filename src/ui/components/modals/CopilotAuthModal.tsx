/**
 * GitHub Copilot authentication modal.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ThemeColors } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

export interface CopilotAuthModalProps {
  userCode: string | null;
  verificationUri: string | null;
  status: "waiting" | "polling" | "success" | "error";
  errorMessage?: string;
  themeColors: ThemeColors;
}

export const CopilotAuthModal: React.FC<CopilotAuthModalProps> = ({
  userCode,
  verificationUri,
  status,
  errorMessage,
  themeColors,
}) => {
  const borderColor =
    status === "error"
      ? themeColors.error
      : status === "success"
        ? themeColors.success
        : themeColors.primary;

  return (
    <ModalContainer
      title="GitHub Copilot Authentication"
      width={60}
      borderColor={borderColor}
      footer={
        status === "success" ? "Press any key to continue" : "ESC to cancel"
      }
    >
      <Box flexDirection="column" gap={1}>
        {status === "waiting" && (
          <>
            <Box gap={1}>
              <Spinner type="dots" />
              <Text>Requesting authorization code...</Text>
            </Box>
          </>
        )}

        {status === "polling" && userCode && verificationUri && (
          <>
            <Text color={themeColors.textMuted}>
              To authenticate with GitHub Copilot, visit:
            </Text>
            <Box marginY={1}>
              <Text color={themeColors.primary} bold>
                {verificationUri}
              </Text>
            </Box>
            <Text color={themeColors.textMuted}>And enter this code:</Text>
            <Box marginY={1}>
              <Box
                borderStyle="double"
                borderColor={themeColors.secondary}
                paddingX={3}
                paddingY={1}
              >
                <Text color={themeColors.secondary} bold>
                  {userCode}
                </Text>
              </Box>
            </Box>
            <Box gap={1}>
              <Spinner type="dots" />
              <Text color={themeColors.textMuted} dimColor>
                Waiting for authorization...
              </Text>
            </Box>
          </>
        )}

        {status === "success" && (
          <>
            <Text color={themeColors.success} bold>
              {figures.tick} Authentication successful!
            </Text>
            <Text color={themeColors.textMuted}>You can now use GitHub Copilot models.</Text>
          </>
        )}

        {status === "error" && (
          <>
            <Text color={themeColors.error} bold>
              {figures.cross} Authentication failed
            </Text>
            <Text color={themeColors.textMuted}>{errorMessage ?? "Unknown error"}</Text>
          </>
        )}
      </Box>
    </ModalContainer>
  );
};
