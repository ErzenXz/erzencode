/**
 * Provider selection modal with search and descriptions.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { ProviderType } from "@erzencode/core/ai-provider";
import type { ThemeColors } from "../../types.js";
import { ModalContainer } from "./ModalContainer.js";

interface ProviderInfo {
  id: string;
  name: string;
  description?: string;
  envVar?: string;
}

export interface ProviderModalProps {
  providers: ProviderInfo[];
  currentProvider: ProviderType;
  selectedIndex: number;
  themeColors?: ThemeColors;
  searchQuery?: string;
  configuredProviders?: string[];
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  providers,
  currentProvider,
  selectedIndex,
  themeColors,
  searchQuery = "",
  configuredProviders = [],
}) => {
  // Filter providers by search query
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const query = searchQuery.toLowerCase();
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [providers, searchQuery]);

  const maxVisible = 10;
  const adjustedIndex = Math.min(selectedIndex, filteredProviders.length - 1);
  const windowStart = Math.max(
    0,
    Math.min(
      adjustedIndex - Math.floor(maxVisible / 2),
      filteredProviders.length - maxVisible,
    ),
  );
  const visibleProviders = filteredProviders.slice(
    windowStart,
    windowStart + maxVisible,
  );

  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < filteredProviders.length;
  const primaryColor = themeColors?.primary ?? "#7dd3fc";
  const secondaryColor = themeColors?.secondary ?? "#a5b4fc";
  const textColor = themeColors?.text ?? "#f1f5f9";
  const textMuted = themeColors?.textMuted ?? "#94a3b8";
  const textDim = themeColors?.textDim ?? "#64748b";
  const success = themeColors?.success ?? "#4ade80";
  const warning = themeColors?.warning ?? "#fbbf24";
  const info = themeColors?.info ?? "#38bdf8";

  return (
    <ModalContainer
      title="Select Provider"
      width={58}
      footer="↑↓ Navigate • Enter Select • Type to search • ESC Cancel"
      borderColor={primaryColor}
      textColor={textColor}
      mutedColor={textMuted}
    >
      <Box flexDirection="column">
        {/* Search input box */}
        <Box marginBottom={1}>
          <Box borderStyle="round" borderColor={searchQuery ? primaryColor : textDim} paddingX={1} width={42}>
            <Text color={textMuted}>{figures.pointer} </Text>
            {searchQuery ? (
              <>
                <Text color={textColor}>{searchQuery}</Text>
                <Text color={primaryColor}>│</Text>
              </>
            ) : (
              <Text color={textDim}>Type to search providers...</Text>
            )}
          </Box>
          {searchQuery && (
            <Box marginLeft={1}>
              <Text color={textMuted}>{filteredProviders.length} match{filteredProviders.length !== 1 ? "es" : ""}</Text>
            </Box>
          )}
        </Box>

        {filteredProviders.length === 0 ? (
          <Box paddingY={1}>
            <Text color={warning}>{figures.warning} No providers match "{searchQuery}"</Text>
          </Box>
        ) : (
          <>
            {showScrollUp && (
              <Box>
                <Text color={textMuted}>
                  {figures.arrowUp} {windowStart} more above
                </Text>
              </Box>
            )}
            {visibleProviders.map((p, idx) => {
              const actualIdx = windowStart + idx;
              const isSelected = actualIdx === adjustedIndex;
              const isCurrent = p.id === currentProvider;
              const isConfigured = configuredProviders.includes(p.id) || p.id === "ollama";
              const rowColor = isSelected ? primaryColor : isCurrent ? success : textColor;

              return (
                <Box key={p.id} flexDirection="column" marginBottom={isSelected && p.description ? 1 : 0}>
                  <Box gap={1}>
                    <Text color={rowColor} bold={isSelected}>
                      {isSelected ? figures.pointer : " "}
                    </Text>
                    <Text color={rowColor} bold={isSelected}>
                      {p.name}
                    </Text>
                    {isCurrent && <Text color={success}> ✓</Text>}
                    {isConfigured && !isCurrent && (
                      <Text color={info}>{figures.tick}</Text>
                    )}
                    {!isConfigured && p.id !== "ollama" && (
                      <Text color={warning}>{figures.warning}</Text>
                    )}
                  </Box>
                  {isSelected && p.description && (
                    <Box paddingLeft={3}>
                      <Text color={textMuted}>{p.description}</Text>
                    </Box>
                  )}
                </Box>
              );
            })}
            {showScrollDown && (
              <Box>
                <Text color={textMuted}>
                  {figures.arrowDown} {filteredProviders.length - windowStart - maxVisible} more below
                </Text>
              </Box>
            )}
          </>
        )}

        {/* Legend */}
        <Box marginTop={1} gap={2}>
          <Text color={textDim}>{figures.tick} configured</Text>
          <Text color={textDim}>{figures.warning} needs API key</Text>
        </Box>
      </Box>
    </ModalContainer>
  );
};
