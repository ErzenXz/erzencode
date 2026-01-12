/**
 * Chat feed component for displaying messages.
 * Optimized with proper memoization to prevent unnecessary rerenders.
 */

import React, { useMemo, useRef, useEffect } from "react";
import { Box, Text } from "ink";
import type { ChatMessage, ThemeColors } from "../types.js";
import { MessageRenderer } from "./chat/MessageRenderer.js";

export interface ChatFeedProps {
  messages: ChatMessage[];
  streamingMessage?: ChatMessage;
  width: number;
  workingDirectory: string;
  themeColors: ThemeColors;
  scrollOffset?: number;
  onMaxScrollOffsetChange?: (max: number) => void;
}

// Maximum number of completed messages to show in scrollback
// This prevents flickering when history gets too long
const MAX_SCROLLBACK_MESSAGES = 50;

const ChatFeedImpl: React.FC<ChatFeedProps> = ({
  messages,
  streamingMessage: streamingMessageProp,
  width,
  workingDirectory,
  themeColors,
  scrollOffset = 0,
  onMaxScrollOffsetChange,
}) => {
  const feedWidth = Math.max(20, width - 4);
  
  // Track previous max scroll offset to prevent unnecessary callback calls
  const prevMaxScrollOffsetRef = useRef<number>(-1);
  const onMaxScrollOffsetChangeRef = useRef(onMaxScrollOffsetChange);
  onMaxScrollOffsetChangeRef.current = onMaxScrollOffsetChange;

  // Filter completed messages. We only render a fixed window of these,
  // using scrollOffset to page through history.
  const { completedMessages, maxScrollOffset, isAtBottom } = useMemo(() => {
    const completedAll = messages.filter((m) => !m.isStreaming);
    const maxOffset = Math.max(0, completedAll.length - MAX_SCROLLBACK_MESSAGES);
    const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

    // If offset == 0, we show the newest window.
    // If offset > 0, we shift the window upwards into history.
    const end = Math.max(0, completedAll.length - clampedOffset);
    const start = Math.max(0, end - MAX_SCROLLBACK_MESSAGES);
    const windowed = completedAll.slice(start, end);

    return {
      completedMessages: windowed,
      maxScrollOffset: maxOffset,
      isAtBottom: clampedOffset === 0,
    };
  }, [messages, scrollOffset]);

  // Notify parent of max scroll offset ONLY when it actually changes.
  // Use ref to avoid re-running effect when callback changes.
  useEffect(() => {
    if (prevMaxScrollOffsetRef.current !== maxScrollOffset) {
      prevMaxScrollOffsetRef.current = maxScrollOffset;
      onMaxScrollOffsetChangeRef.current?.(maxScrollOffset);
    }
  }, [maxScrollOffset]);

  const streamingMessage = useMemo(() => {
    if (streamingMessageProp) return streamingMessageProp;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.isStreaming) return m;
    }
    return undefined;
  }, [messages, streamingMessageProp]);

  if (completedMessages.length === 0 && !streamingMessage) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color={themeColors.textMuted}>
          Ready in: <Text color={themeColors.primary}>{workingDirectory}</Text>
        </Text>
        <Text color={themeColors.textMuted} dimColor>
          Type a message or /help for commands
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {!isAtBottom && (
        <Box>
          <Text color={themeColors.textMuted} dimColor>
            Showing earlier messages. Use PgUp/PgDn to scroll.
          </Text>
        </Box>
      )}
      {completedMessages.map((msg, idx) => (
        <Box key={msg.id}>
          <MessageRenderer
            message={msg}
            feedWidth={feedWidth}
            workingDirectory={workingDirectory}
            isFirst={idx === 0}
            themeColors={themeColors}
          />
        </Box>
      ))}
      {isAtBottom && streamingMessage && (
        <Box>
          <MessageRenderer
            message={streamingMessage}
            feedWidth={feedWidth}
            workingDirectory={workingDirectory}
            isFirst={completedMessages.length === 0}
            themeColors={themeColors}
          />
        </Box>
      )}
      {!isAtBottom && (
        <Box marginTop={1}>
          <Text color={themeColors.textMuted} dimColor>
            PgUp/PgDn scrollback
          </Text>
          <Text color={themeColors.textMuted} dimColor>
            Press PgDn to follow latest output
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Memoize ChatFeed to prevent unnecessary rerenders
export const ChatFeed = React.memo(
  ChatFeedImpl,
  (prev, next) => {
    // Only re-render if significant props change
    return (
      prev.messages === next.messages &&
      prev.streamingMessage === next.streamingMessage &&
      prev.width === next.width &&
      prev.workingDirectory === next.workingDirectory &&
      prev.scrollOffset === next.scrollOffset &&
      prev.themeColors === next.themeColors
    );
  }
);

ChatFeed.displayName = 'ChatFeed';
