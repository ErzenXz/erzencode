/**
 * Message renderer component for rendering chat messages.
 * Optimized with React.memo to prevent unnecessary rerenders.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ChatMessage, MessagePart, ThemeColors, ToolPart } from "../../types.js";
import { renderMarkdownWithWidth } from "../../../markdown.js";
import { wrapText } from "../../utils.js";
import { ToolGroup } from "./ToolGroup.js";

export interface MessageRendererProps {
  message: ChatMessage;
  feedWidth: number;
  workingDirectory: string;
  isFirst: boolean;
  themeColors: ThemeColors;
  expandedTools?: boolean;
}

interface LineItem {
  key: string;
  node: React.ReactNode;
}

/**
 * Group consecutive tool parts together.
 */
function groupParts(
  parts: MessagePart[],
): Array<
  | { kind: "tool-group"; parts: ToolPart[] }
  | { kind: "part"; part: MessagePart }
> {
  const grouped: Array<
    | { kind: "tool-group"; parts: ToolPart[] }
    | { kind: "part"; part: MessagePart }
  > = [];
  let currentTools: ToolPart[] = [];

  for (const p of parts) {
    if (p.type === "tool") {
      currentTools.push(p);
      continue;
    }
    if (currentTools.length > 0) {
      grouped.push({ kind: "tool-group", parts: currentTools });
      currentTools = [];
    }
    grouped.push({ kind: "part", part: p });
  }
  if (currentTools.length > 0) {
    grouped.push({ kind: "tool-group", parts: currentTools });
  }

  return grouped;
}

/**
 * Render text content with high-quality markdown support.
 * Uses charm-tui markdown renderer for beautiful output.
 */
function renderContentLines(
  content: string,
  feedWidth: number,
  themeColors: ThemeColors,
  msgId: string,
  prefix: string,
): LineItem[] {
  const lines: LineItem[] = [];
  
  if (!content || !content.trim()) {
    return lines;
  }

  const width = Math.max(60, feedWidth - 4);
  const rendered = renderMarkdownWithWidth(content.trim(), width);
  lines.push({
    key: `${msgId}:${prefix}`,
    node: <Text>{rendered}</Text>,
  });
  
  return lines;
}

function renderContentPlainLines(
  content: string,
  feedWidth: number,
  themeColors: ThemeColors,
  msgId: string,
  prefix: string,
): LineItem[] {
  const lines: LineItem[] = [];
  if (!content || !content.trim()) return lines;

  const wrapped = wrapText(content, Math.max(10, feedWidth - 4)).join("\n");
  lines.push({
    key: `${msgId}:${prefix}`,
    node: <Text color={themeColors.text}>{wrapped}</Text>,
  });
  return lines;
}

const MessageRendererImpl: React.FC<MessageRendererProps> = ({
  message,
  feedWidth,
  workingDirectory,
  isFirst,
  themeColors,
  expandedTools = false,
}) => {
  const lines: LineItem[] = [];

  // User message
  if (message.role === "user") {
    // Top spacing between messages
    if (!isFirst) {
      lines.push({ key: `${message.id}:spacer-top`, node: <Text> </Text> });
    }

    const wrapped = wrapText(
      message.content ?? "",
      Math.max(10, feedWidth - 6),
    );

    // User label with icon - using bright colors for visibility
    lines.push({
      key: `${message.id}:user-label`,
      node: (
        <Text>
          <Text color={themeColors.user} bold>
            {figures.pointerSmall}
          </Text>
          <Text color={themeColors.user} bold>
            {" "}
            You
          </Text>
        </Text>
      ),
    });

    // Message content with left border effect
    wrapped.forEach((l: string, idx: number) => {
      lines.push({
        key: `${message.id}:user:${idx}`,
        node: (
          <Text>
            <Text color={themeColors.user} dimColor>│ </Text>
            <Text color={themeColors.text}>{l}</Text>
          </Text>
        ),
      });
    });

    return (
      <Box flexDirection="column">
        {lines.map((l) => (
          <Box key={l.key}>{l.node}</Box>
        ))}
      </Box>
    );
  }

  // Assistant message
  if (message.role === "assistant") {
    // Spacing before assistant response
    lines.push({ key: `${message.id}:spacer-top`, node: <Text> </Text> });

    const parts: MessagePart[] = message.parts ?? [];

    // If no structured parts, just render content
    if (parts.length === 0) {
      const content = message.content ?? "";
      if (content.trim()) {
        lines.push(
          ...(message.isStreaming
            ? renderContentPlainLines(content, feedWidth, themeColors, message.id, "text")
            : renderContentLines(content, feedWidth, themeColors, message.id, "text"))
        );
      }
      if (message.isStreaming) {
        lines.push({
          key: `${message.id}:streaming`,
          node: (
            <Text color={themeColors.textDim} dimColor>
              {figures.ellipsis}
            </Text>
          ),
        });
      }
      return (
        <Box flexDirection="column">
          {lines.map((l) => (
            <Box key={l.key}>{l.node}</Box>
          ))}
        </Box>
      );
    }

    // Group consecutive tools
    const grouped = groupParts(parts);
    let hasRenderedText = false;

    grouped.forEach((item, pidx) => {
      if (item.kind === "tool-group") {
        // Add spacing before tools if we've rendered text
        if (hasRenderedText) {
          lines.push({
            key: `${message.id}:tool-spacer:${pidx}`,
            node: <Text> </Text>,
          });
        }
        lines.push({
          key: `${message.id}:tool-group:${pidx}`,
          node: (
            <ToolGroup
              tools={item.parts}
              msgId={message.id}
              groupIdx={pidx}
              workspaceRoot={workingDirectory}
              themeColors={themeColors}
              expandedTools={expandedTools}
            />
          ),
        });
        return;
      }

      const part = item.part;

      // Thinking/Reasoning - collapsible with nice styling
      if (part.type === "thinking") {
        const content = part.content ?? "";
        if (content.trim()) {
          // Always show collapsed header, only show content if expandedTools is true
          lines.push({
            key: `${message.id}:think-header:${pidx}`,
            node: (
              <Box gap={0}>
                <Text color={themeColors.secondary}>●</Text>
                <Text> </Text>
                <Text color={themeColors.secondary} bold>Thinking</Text>
                {!expandedTools && (
                  <Text color={themeColors.textDim}> (ctrl+o to expand)</Text>
                )}
              </Box>
            ),
          });
          
          // Only show reasoning content when expanded
          if (expandedTools) {
            const wrappedLines = wrapText(content, Math.max(10, feedWidth - 6));
            const maxLines = 15;
            const displayLines = wrappedLines.slice(0, maxLines);
            const hasMore = wrappedLines.length > maxLines;
            
            displayLines.forEach((l: string, idx: number) => {
              lines.push({
                key: `${message.id}:think:${pidx}:${idx}`,
                node: (
                  <Box paddingLeft={1}>
                    <Text color={themeColors.textDim}>│ </Text>
                    <Text color={themeColors.secondary} italic>
                      {l}
                    </Text>
                  </Box>
                ),
              });
            });
            
            if (hasMore) {
              lines.push({
                key: `${message.id}:think:${pidx}:more`,
                node: (
                  <Box paddingLeft={1}>
                    <Text color={themeColors.textDim}>
                      └─ ... {wrappedLines.length - maxLines} more lines
                    </Text>
                  </Box>
                ),
              });
            }
          } else {
            // Collapsed: show brief preview
            const preview = content.slice(0, 80).replace(/\n/g, " ");
            lines.push({
              key: `${message.id}:think-preview:${pidx}`,
              node: (
                <Box paddingLeft={1}>
                  <Text color={themeColors.textDim}>
                    └─ {preview}{content.length > 80 ? "..." : ""}
                  </Text>
                </Box>
              ),
            });
          }
        }
        return;
      }

      // Action - skip (too noisy)
      if (part.type === "action") {
        return;
      }

      // Error
      if (part.type === "error") {
        const content = part.content ?? "";
        if (content.trim()) {
          lines.push({
            key: `${message.id}:error-spacer:${pidx}`,
            node: <Text> </Text>,
          });
          wrapText(content, Math.max(10, feedWidth - 4)).forEach((l: string, idx: number) => {
            lines.push({
              key: `${message.id}:error:${pidx}:${idx}`,
              node: (
                <Text>
                  {idx === 0 ? (
                    <Text color={themeColors.error} bold>
                      {figures.cross}{" "}
                    </Text>
                  ) : (
                    <Text>{"  "}</Text>
                  )}
                  <Text color={themeColors.error}>{l}</Text>
                </Text>
              ),
            });
          });
        }
        return;
      }

      // Text
      if (part.type === "text") {
        const content = part.content ?? "";
        if (content.trim()) {
          if (pidx > 0 && !hasRenderedText) {
            lines.push({
              key: `${message.id}:text-spacer:${pidx}`,
              node: <Text> </Text>,
            });
          }
          lines.push(
            ...(message.isStreaming
              ? renderContentPlainLines(content, feedWidth, themeColors, message.id, `text:${pidx}`)
              : renderContentLines(content, feedWidth, themeColors, message.id, `text:${pidx}`))
          );
          hasRenderedText = true;
        }
      }
    });

    if (message.isStreaming) {
      lines.push({
        key: `${message.id}:streaming`,
        node: (
          <Text color={themeColors.textDim} dimColor>
            {figures.ellipsis}
          </Text>
        ),
      });
    }
  }

  return (
    <Box flexDirection="column">
      {lines.map((l) => (
        <Box key={l.key}>{l.node}</Box>
      ))}
    </Box>
  );
};

// Memoize to prevent unnecessary rerenders
export const MessageRenderer = React.memo(
  MessageRendererImpl,
  (prev, next) => {
    // Only re-render if message content, streaming state, or dimensions change
    if (prev.message.isStreaming || next.message.isStreaming) return false;
    return (
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.isStreaming === next.message.isStreaming &&
      prev.message.parts?.length === next.message.parts?.length &&
      prev.feedWidth === next.feedWidth &&
      prev.isFirst === next.isFirst &&
      prev.expandedTools === next.expandedTools
    );
  }
);

MessageRenderer.displayName = 'MessageRenderer';
