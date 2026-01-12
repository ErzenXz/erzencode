/**
 * Inline selector component for models, providers, themes, etc.
 * Styled to match the Autocomplete dropdown.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ThemeColors } from "../../types.js";
import { clamp } from "../../utils.js";

export interface SelectorItem {
  id: string;
  label: string;
  description?: string;
  status?: "current" | "configured" | "needs-key" | "none";
  extra?: string;
}

export interface InlineSelectorProps {
  title: string;
  items: SelectorItem[];
  selectedIndex: number;
  searchQuery?: string;
  maxItems?: number;
  themeColors: ThemeColors;
  showSearch?: boolean;
}

export const InlineSelector: React.FC<InlineSelectorProps> = ({
  title,
  items,
  selectedIndex,
  searchQuery = "",
  maxItems = 6,
  themeColors,
  showSearch = true,
}) => {
  // Filter items by search query
  const filteredItems = searchQuery.trim()
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const adjustedIndex = Math.min(selectedIndex, Math.max(0, filteredItems.length - 1));
  const windowStart = clamp(
    adjustedIndex - Math.floor(maxItems / 2),
    0,
    Math.max(0, filteredItems.length - maxItems)
  );
  const visibleItems = filteredItems.slice(windowStart, windowStart + maxItems);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={themeColors.border}
      paddingX={1}
      marginX={1}
    >
      {/* Search input line - like autocomplete matches the input */}
      {showSearch && (
        <Text color={themeColors.textMuted}>
          {figures.pointer}{" "}
          {searchQuery ? (
            <>
              <Text color={themeColors.text}>{searchQuery}</Text>
              <Text color={themeColors.primary}>│</Text>
            </>
          ) : (
            <Text color={themeColors.textDim}>{title} - type to filter</Text>
          )}
        </Text>
      )}
      {!showSearch && (
        <Text color={themeColors.textMuted}>
          {figures.pointer} {title}
        </Text>
      )}

      {/* Items */}
      {filteredItems.length === 0 ? (
        <Text color={themeColors.warning}>No matches</Text>
      ) : (
        visibleItems.map((item, idx) => {
          const actualIdx = windowStart + idx;
          const isSelected = actualIdx === adjustedIndex;
          const isCurrent = item.status === "current";

          let statusText = "";
          let statusColor = themeColors.textMuted;
          if (item.status === "current") {
            statusText = "(current)";
            statusColor = themeColors.success;
          } else if (item.status === "configured") {
            statusText = `${figures.tick}`;
            statusColor = themeColors.info;
          } else if (item.status === "needs-key") {
            statusText = "(needs key)";
            statusColor = themeColors.warning;
          }

          return (
            <Text
              key={`${item.id}-${actualIdx}`}
              color={isSelected ? themeColors.primary : isCurrent ? themeColors.success : themeColors.text}
              bold={isSelected}
            >
              {isSelected ? figures.pointer : " "} {item.label}
              {statusText && <Text color={statusColor}> {statusText}</Text>}
              {item.description && isSelected && (
                <Text color={themeColors.textMuted}> - {item.description}</Text>
              )}
            </Text>
          );
        })
      )}

      {/* Help */}
      <Text color={themeColors.textMuted} dimColor>
        Tab/Enter select • Esc cancel
      </Text>
    </Box>
  );
};
