/**
 * Chat feed component for displaying messages.
 * Features a beautiful welcome header and Claude Code style tool display.
 */

import React, { useMemo, useRef, useEffect } from "react";
import { Box, Text } from "ink";
import figures from "figures";
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
  expandedTools?: boolean;
  provider?: string;
  model?: string;
}

const ChatFeedImpl: React.FC<ChatFeedProps> = ({
  messages,
  streamingMessage: streamingMessageProp,
  width,
  workingDirectory,
  themeColors,
  scrollOffset = 0,
  onMaxScrollOffsetChange,
  expandedTools = false,
  provider,
  model,
}) => {
  const feedWidth = Math.max(20, width - 4);
  
  const prevMaxScrollOffsetRef = useRef<number>(-1);
  const onMaxScrollOffsetChangeRef = useRef(onMaxScrollOffsetChange);
  onMaxScrollOffsetChangeRef.current = onMaxScrollOffsetChange;

  const { completedMessages, maxScrollOffset, isAtBottom } = useMemo(() => {
    const completedAll = messages.filter((m) => !m.isStreaming);
    return {
      completedMessages: completedAll,
      maxScrollOffset: 0,
      isAtBottom: scrollOffset === 0,
    };
  }, [messages, scrollOffset]);

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

  // Welcome header when no messages
  if (completedMessages.length === 0 && !streamingMessage) {
    const dirName = workingDirectory.split("/").pop() || workingDirectory;
    
    return (
      <Box flexDirection="column" paddingY={1}>
        {/* Welcome banner - Claude Code style */}
        <Box 
          borderStyle="round" 
          borderColor={themeColors.primary}
          paddingX={2}
          paddingY={0}
          marginBottom={1}
          flexDirection="column"
        >
          <Box justifyContent="space-between">
            <Box>
              <Text color={themeColors.primary} bold>ErzenCode</Text>
              <Text color={themeColors.textMuted}> v0.3.0</Text>
            </Box>
            <Box>
              <Text color={themeColors.success}>Tips for getting started</Text>
            </Box>
          </Box>
          
          <Box marginTop={0}>
            <Box flexDirection="column" width="50%">
              <Text color={themeColors.text} bold>Welcome!</Text>
              <Text> </Text>
              <Box>
                <Text color={themeColors.textMuted}>{figures.pointer} </Text>
                <Text color={themeColors.info}>{dirName}</Text>
              </Box>
              {provider && model && (
                <Box>
                  <Text color={themeColors.textMuted}>{figures.tick} </Text>
                  <Text color={themeColors.warning}>{provider}</Text>
                  <Text color={themeColors.textMuted}> • </Text>
                  <Text color={themeColors.success}>{model}</Text>
                </Box>
              )}
            </Box>
            
            <Box flexDirection="column" width="50%">
              <Text color={themeColors.success} bold>Quick Commands</Text>
              <Text color={themeColors.textMuted}>/help - Show all commands</Text>
              <Text color={themeColors.textMuted}>/models - Switch model</Text>
              <Text color={themeColors.textMuted}>/provider - Change provider</Text>
            </Box>
          </Box>
        </Box>
        
        <Text color={themeColors.textMuted}>
          {figures.arrowRight} Type your task and press Enter
        </Text>
        <Text color={themeColors.textDim}>
          ? for shortcuts
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {completedMessages.map((msg, idx) => (
        <Box key={msg.id}>
          <MessageRenderer
            message={msg}
            feedWidth={feedWidth}
            workingDirectory={workingDirectory}
            isFirst={idx === 0}
            themeColors={themeColors}
            expandedTools={expandedTools}
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
            expandedTools={expandedTools}
          />
        </Box>
      )}
      
    </Box>
  );
};

export const ChatFeed = React.memo(
  ChatFeedImpl,
  (prev, next) => {
    return (
      prev.messages === next.messages &&
      prev.streamingMessage === next.streamingMessage &&
      prev.width === next.width &&
      prev.workingDirectory === next.workingDirectory &&
      prev.scrollOffset === next.scrollOffset &&
      prev.themeColors === next.themeColors &&
      prev.expandedTools === next.expandedTools &&
      prev.provider === next.provider &&
      prev.model === next.model
    );
  }
);

ChatFeed.displayName = 'ChatFeed';
