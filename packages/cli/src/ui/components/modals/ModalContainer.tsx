/**
 * Base modal container component.
 * Provides consistent styling for all modals.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";

export interface ModalContainerProps {
  title: string;
  children: React.ReactNode;
  footer?: string;
  width?: number;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
  title,
  children,
  footer,
  width = 60,
  borderColor = "#7dd3fc",
  textColor = "#f1f5f9",
  mutedColor = "#94a3b8",
}) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor={borderColor}
    paddingX={2}
    paddingY={1}
    width={width}
  >
    {/* Title bar with icon */}
    <Box marginBottom={1} gap={1}>
      <Text color={borderColor}>{figures.circleFilled}</Text>
      <Text bold color={textColor}>
        {title}
      </Text>
    </Box>
    
    {/* Divider line */}
    <Box marginBottom={1}>
      <Text color={mutedColor} dimColor>{"─".repeat(Math.max(10, width - 8))}</Text>
    </Box>
    
    {/* Content */}
    {children}
    
    {/* Footer */}
    {footer && (
      <Box marginTop={1} paddingTop={1}>
        <Text color={mutedColor} dimColor>
          {figures.info} {footer}
        </Text>
      </Box>
    )}
  </Box>
);
