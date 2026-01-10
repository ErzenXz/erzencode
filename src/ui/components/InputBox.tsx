import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { AgentMode as CodingAgentMode } from "../../ai-agent.js";
import { MODE_COLORS, MODES, type SlashCommand } from "../types.js";
import { clamp } from "../utils.js";

interface InputBoxProps {
  value: string;
  cursorIndex: number;
  mode: CodingAgentMode;
  isThinking: boolean;
  elapsedTime: number;
  showAutocomplete: boolean;
  autocompleteMatches: SlashCommand[];
  autocompleteIndex: number;
  attachedImages?: string[];
  maxLines?: number; // Max visible lines before scrolling within input
}

export const InputBox: React.FC<InputBoxProps> = ({
  value,
  cursorIndex,
  mode,
  isThinking,
  showAutocomplete,
  autocompleteMatches,
  autocompleteIndex,
  attachedImages = [],
  maxLines = 8, // Default max 8 visible lines
}) => {
  const maxItems = 5;
  const windowStart = clamp(
    autocompleteIndex - Math.floor(maxItems / 2),
    0,
    Math.max(0, autocompleteMatches.length - maxItems),
  );
  const items = autocompleteMatches.slice(windowStart, windowStart + maxItems);

  const cursor = isThinking ? "" : "│";
  const safeCursorIndex = Math.max(0, Math.min(cursorIndex, value.length));

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
    // +1 for the newline character (except last line)
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
    // All lines fit
    visibleLines = allLines;
  } else {
    // Need to scroll - keep cursor line visible
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

  // Calculate dynamic height (min 1, max maxLines)
  const inputHeight = Math.min(totalLines, maxLines);

  return (
    <Box flexDirection="column">
      {/* Autocomplete dropdown */}
      {showAutocomplete && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          marginX={1}
        >
          {items.map((cmd, idx) => {
            const actualIdx = windowStart + idx;
            const selected = actualIdx === autocompleteIndex;
            return (
              <Text
                key={cmd.name}
                color={selected ? "cyan" : "white"}
                bold={selected}
              >
                {selected ? figures.pointer : " "} /{cmd.name}{" "}
                <Text color="gray" dimColor>
                  - {cmd.description}
                </Text>
              </Text>
            );
          })}
          <Text color="gray" dimColor>
            Tab/Enter to select • Esc to close
          </Text>
        </Box>
      )}

      {/* Attached images indicator */}
      {attachedImages.length > 0 && (
        <Box paddingX={2} marginBottom={0}>
          <Text color="magenta">
            {figures.circleFilled} {attachedImages.length} image
            {attachedImages.length > 1 ? "s" : ""} attached
          </Text>
          <Text color="gray" dimColor>
            {" "}
            ({attachedImages.map((p) => p.split("/").pop()).join(", ")})
          </Text>
        </Box>
      )}

      {/* Input box - expands with content */}
      <Box
        borderStyle="round"
        borderColor={isThinking ? "yellow" : MODE_COLORS[mode]}
        paddingX={1}
        marginX={1}
        flexDirection="column"
      >
        {/* Top scroll indicator */}
        {showTopIndicator && (
          <Box>
            <Text color="gray" dimColor>
              {figures.arrowUp} {totalLines - visibleLines.length} more lines
              above
            </Text>
          </Box>
        )}

        {/* Visible lines */}
        {visibleLines.map((line, idx) => (
          <Box key={idx} flexDirection="row">
            {idx === 0 && !showTopIndicator ? (
              <Text color={MODE_COLORS[mode]}>{figures.pointer} </Text>
            ) : (
              <Text color={MODE_COLORS[mode]}>{"  "}</Text>
            )}
            {line.length === 0 && value.length === 0 ? (
              <Text>
                <Text color="gray">{cursor}</Text>
                <Text color="gray" dimColor>
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
            <Text color="gray" dimColor>
              {figures.arrowDown}{" "}
              {totalLines - visibleLines.length - (showTopIndicator ? 1 : 0)}{" "}
              more lines below
            </Text>
          </Box>
        )}

        {/* Line count indicator for multiline */}
        {totalLines > 1 && (
          <Box justifyContent="flex-end">
            <Text color="gray" dimColor>
              line {cursorLine + 1}/{totalLines} • Ctrl+Enter for newline
            </Text>
          </Box>
        )}
      </Box>

      {/* Mode selector - minimal */}
      <Box paddingX={2} gap={2}>
        {MODES.map((m) => (
          <Text
            key={m}
            color={m === mode ? MODE_COLORS[m] : "gray"}
            dimColor={m !== mode}
            bold={m === mode}
          >
            {m === mode ? figures.circleFilled : figures.circle} {m}
          </Text>
        ))}
        <Text color="gray" dimColor>
          [Tab]
        </Text>
      </Box>
    </Box>
  );
};
