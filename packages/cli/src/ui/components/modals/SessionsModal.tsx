/**
 * Sessions selection modal.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { SessionState, ThemeColors } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

export interface SessionsModalProps {
  sessions: SessionState[];
  currentSessionId: string;
  selectedIndex: number;
  themeColors: ThemeColors;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({
  sessions,
  currentSessionId,
  selectedIndex,
  themeColors,
}) => {
  const maxVisible = 10;
  const windowStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      sessions.length - maxVisible,
    ),
  );
  const visibleSessions = sessions.slice(windowStart, windowStart + maxVisible);

  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < sessions.length;

  return (
    <ModalContainer
      title="Sessions"
      width={50}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
      borderColor={themeColors.primary}
    >
      <Box flexDirection="column">
        {showScrollUp && (
          <Text color={themeColors.textMuted} dimColor>
            {figures.arrowUp} {windowStart} more above
          </Text>
        )}
        {visibleSessions.map((s, idx) => {
          const actualIdx = windowStart + idx;
          return (
            <Box key={s.id} gap={1}>
              <Text
                color={
                  actualIdx === selectedIndex
                    ? themeColors.primary
                    : s.id === currentSessionId
                      ? themeColors.success
                      : themeColors.text
                }
                bold={actualIdx === selectedIndex}
              >
                {actualIdx === selectedIndex ? figures.pointer : " "} {s.name}{" "}
                <Text color={themeColors.textMuted}>
                  (<Text>{s.messages.length}</Text>)
                </Text>
                {s.id === currentSessionId && <Text color={themeColors.success}>✓</Text>}
              </Text>
            </Box>
          );
        })}
        {showScrollDown && (
          <Text color={themeColors.textMuted} dimColor>
            {figures.arrowDown} {sessions.length - windowStart - maxVisible}{" "}
            more below
          </Text>
        )}
      </Box>
    </ModalContainer>
  );
};
