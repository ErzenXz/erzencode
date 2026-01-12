/**
 * Input box component for user input.
 * Refactored to use smaller, focused components.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { AgentMode as CodingAgentMode } from "../../ai-agent.js";
import type { SlashCommand, ThemeColors } from "../types.js";
import { Autocomplete } from "./input/Autocomplete.js";
import { ModeSelector } from "./input/ModeSelector.js";

export interface InputBoxProps {
  value: string;
  cursorIndex: number;
  mode: CodingAgentMode;
  provider?: string;
  model?: string;
  isThinking: boolean;
  showAutocomplete: boolean;
  autocompleteMatches: SlashCommand[];
  autocompleteIndex: number;
  autocompletePrefix?: string;
  attachedImages?: string[];
  maxLines?: number;
  themeColors: ThemeColors;
  hideComposer?: boolean;
}

const InputBoxImpl: React.FC<InputBoxProps> = ({
  value,
  cursorIndex,
  mode,
  isThinking,
  showAutocomplete,
  autocompleteMatches,
  autocompleteIndex,
  autocompletePrefix = "/",
  attachedImages = [],
  maxLines = 8,
  themeColors,
  hideComposer = false,
}) => {
  const cursor = isThinking ? "" : "│";
  const safeCursorIndex = Math.max(0, Math.min(cursorIndex, value.length));

  const modeColor =
    mode === "agent"
      ? themeColors.primary
      : mode === "plan"
        ? themeColors.warning
        : themeColors.success;

  // Insert cursor into the value
  const displayValue =
    value.length === 0
      ? cursor
      : value.slice(0, safeCursorIndex) + cursor + value.slice(safeCursorIndex);

  // Split into lines
  const allLines = displayValue.split("\n");
  const totalLines = allLines.length;

  // Find which line the cursor is on
  let cursorLine = 0;
  let charCount = 0;
  for (let i = 0; i < allLines.length; i++) {
    const lineLength = allLines[i]!.length + (i < allLines.length - 1 ? 1 : 0);
    if (charCount + lineLength > safeCursorIndex) {
      cursorLine = i;
      break;
    }
    charCount += lineLength;
    cursorLine = i;
  }

  // Calculate visible window (scroll to keep cursor visible)
  let visibleLines: string[];
  let showTopIndicator = false;
  let showBottomIndicator = false;

  if (totalLines <= maxLines) {
    visibleLines = allLines;
  } else {
    const halfWindow = Math.floor((maxLines - 1) / 2);
    let startLine = Math.max(0, cursorLine - halfWindow);
    let endLine = startLine + maxLines;

    if (endLine > totalLines) {
      endLine = totalLines;
      startLine = Math.max(0, endLine - maxLines);
    }

    visibleLines = allLines.slice(startLine, endLine);
    showTopIndicator = startLine > 0;
    showBottomIndicator = endLine < totalLines;
  }

  return (
    <Box flexDirection="column">
      {/* Autocomplete dropdown */}
      {showAutocomplete && (
        <Autocomplete
          matches={autocompleteMatches}
          selectedIndex={autocompleteIndex}
          prefix={autocompletePrefix}
          themeColors={themeColors}
        />
      )}

      {/* Attached images indicator */}
      {!hideComposer && attachedImages.length > 0 && (
        <Box paddingX={2} marginBottom={0}>
          <Text color={themeColors.secondary}>
            {figures.circleFilled}{" "}
            {attachedImages.map((_, i) => `[Image ${i + 1}]`).join(" ")}
          </Text>
          <Text color={themeColors.textMuted} dimColor>
            {" "}
            (
            {attachedImages
              .map((p, i) =>
                p.startsWith("data:image/")
                  ? `clipboard-${i + 1}`
                  : p.split("/").pop()
              )
              .join(", ")}
            )
          </Text>
        </Box>
      )}

      {/* Input box - hidden when selector is open */}
      {!hideComposer && (
        <Box
          borderStyle="round"
          borderColor={isThinking ? themeColors.warning : modeColor}
          paddingX={1}
          marginX={1}
          flexDirection="column"
        >
          {/* Top scroll indicator */}
          {showTopIndicator && (
            <Box>
              <Text color={themeColors.textMuted} dimColor>
                {figures.arrowUp} {totalLines - visibleLines.length} more lines
                above
              </Text>
            </Box>
          )}

          {/* Visible lines */}
          {visibleLines.map((line, idx) => (
            <Box key={idx} flexDirection="row">
              {idx === 0 && !showTopIndicator ? (
                <Text color={modeColor}>{figures.pointer} </Text>
              ) : (
                <Text color={modeColor}>{"  "}</Text>
              )}
              {line.length === 0 && value.length === 0 ? (
                <Text>
                  <Text color={themeColors.textDim}>{cursor}</Text>
                  <Text color={themeColors.textDim} dimColor>
                    {isThinking ? " thinking..." : ""}
                  </Text>
                </Text>
              ) : (
                <Text>{line || " "}</Text>
              )}
            </Box>
          ))}

          {/* Bottom scroll indicator */}
          {showBottomIndicator && (
            <Box>
              <Text color={themeColors.textMuted} dimColor>
                {figures.arrowDown}{" "}
                {totalLines - visibleLines.length - (showTopIndicator ? 1 : 0)}{" "}
                more lines below
              </Text>
            </Box>
          )}

          {/* Line count indicator for multiline */}
          {totalLines > 1 && (
            <Box justifyContent="flex-end">
              <Text color={themeColors.textMuted} dimColor>
                line {cursorLine + 1}/{totalLines} • Ctrl+Enter for newline
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Mode selector */}
      <ModeSelector mode={mode} themeColors={themeColors} />
    </Box>
  );
};

// Memoize InputBox to prevent unnecessary re-renders and expensive recalculations
export const InputBox = React.memo(
  InputBoxImpl,
  (prev, next) => {
    return (
      prev.value === next.value &&
      prev.cursorIndex === next.cursorIndex &&
      prev.mode === next.mode &&
      prev.isThinking === next.isThinking &&
      prev.showAutocomplete === next.showAutocomplete &&
      prev.autocompleteMatches === next.autocompleteMatches &&
      prev.autocompleteIndex === next.autocompleteIndex &&
      prev.autocompletePrefix === next.autocompletePrefix &&
      prev.attachedImages === next.attachedImages &&
      prev.maxLines === next.maxLines &&
      prev.themeColors === next.themeColors &&
      prev.hideComposer === next.hideComposer
    );
  }
);
