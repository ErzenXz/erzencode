/**
 * Model selection modal with search and pricing display.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ProviderType } from "../../../ai-provider.js";
import type { ThemeColors } from "../../types.js";
import { truncate } from "../../utils.js";
import { ModalContainer } from "./ModalContainer.js";
import { getModel } from "../../../models.js";

export interface ModelsModalProps {
  provider: ProviderType;
  models: string[];
  currentModel: string;
  selectedIndex: number;
  isLoading: boolean;
  themeColors: ThemeColors;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null) return "-";
  if (price === 0) return "free";
  if (price < 0.01) return `$${(price * 1000).toFixed(2)}/M`;
  return `$${price.toFixed(2)}/M`;
}

export const ModelsModal: React.FC<ModelsModalProps> = ({
  provider,
  models,
  currentModel,
  selectedIndex,
  isLoading,
  themeColors,
  searchQuery = "",
}) => {
  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(query));
  }, [models, searchQuery]);

  const maxVisible = 10;
  const adjustedIndex = Math.min(selectedIndex, filteredModels.length - 1);
  const windowStart = Math.max(
    0,
    Math.min(
      adjustedIndex - Math.floor(maxVisible / 2),
      filteredModels.length - maxVisible,
    ),
  );
  const visibleModels = filteredModels.slice(windowStart, windowStart + maxVisible);

  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < filteredModels.length;

  return (
    <ModalContainer
      title={`Select Model (${provider})`}
      width={72}
      footer="↑↓ Navigate • Enter Select • Type to search • ESC Cancel"
      borderColor={themeColors.primary}
      textColor={themeColors.text}
      mutedColor={themeColors.textMuted}
    >
      <Box flexDirection="column">
        {/* Search input box */}
        <Box marginBottom={1}>
          <Box borderStyle="round" borderColor={searchQuery ? themeColors.primary : themeColors.textDim} paddingX={1} width={50}>
            <Text color={themeColors.textMuted}>{figures.pointer} </Text>
            {searchQuery ? (
              <>
                <Text color={themeColors.text}>{searchQuery}</Text>
                <Text color={themeColors.primary}>│</Text>
              </>
            ) : (
              <Text color={themeColors.textDim}>Type to search models...</Text>
            )}
          </Box>
          {searchQuery && (
            <Box marginLeft={1}>
              <Text color={themeColors.textMuted}>{filteredModels.length} match{filteredModels.length !== 1 ? "es" : ""}</Text>
            </Box>
          )}
        </Box>

        {/* Column headers */}
        <Box marginBottom={1} gap={1}>
          <Box width={42}>
            <Text color={themeColors.secondary} bold>{figures.circleFilled} Model</Text>
          </Box>
          <Box width={10}>
            <Text color={themeColors.secondary} bold>Input</Text>
          </Box>
          <Box width={10}>
            <Text color={themeColors.secondary} bold>Output</Text>
          </Box>
        </Box>

        {isLoading ? (
          <Box gap={1} paddingY={1}>
            <Text color={themeColors.warning}><Spinner type="dots" /></Text>
            <Text color={themeColors.text}>Loading models...</Text>
          </Box>
        ) : filteredModels.length === 0 ? (
          <Box paddingY={1}>
            <Text color={themeColors.warning}>{figures.warning} No models match "{searchQuery}"</Text>
          </Box>
        ) : (
          <>
            {showScrollUp && (
              <Box>
                <Text color={themeColors.textMuted}>
                  {figures.arrowUp} {windowStart} more above
                </Text>
              </Box>
            )}
            {visibleModels.map((m, idx) => {
              const actualIdx = windowStart + idx;
              const isSelected = actualIdx === adjustedIndex;
              const isCurrent = m === currentModel;
              const modelInfo = getModel(provider, m);
              const inputPrice = modelInfo?.pricing?.input;
              const outputPrice = modelInfo?.pricing?.output;

              return (
                <Box key={m} gap={1}>
                  <Box width={42}>
                    <Text color={isSelected ? themeColors.primary : isCurrent ? themeColors.success : themeColors.text} bold={isSelected}>
                      {isSelected ? figures.pointer : " "} {truncate(m, 36)}
                      {isCurrent && <Text color={themeColors.success}> ✓</Text>}
                    </Text>
                  </Box>
                  <Box width={10}>
                    <Text color={isSelected ? themeColors.info : themeColors.textMuted}>
                      {formatPrice(inputPrice)}
                    </Text>
                  </Box>
                  <Box width={10}>
                    <Text color={isSelected ? themeColors.info : themeColors.textMuted}>
                      {formatPrice(outputPrice)}
                    </Text>
                  </Box>
                </Box>
              );
            })}
            {showScrollDown && (
              <Box>
                <Text color={themeColors.textMuted}>
                  {figures.arrowDown} {filteredModels.length - windowStart - maxVisible} more below
                </Text>
              </Box>
            )}
          </>
        )}

        {/* Pricing note */}
        <Box marginTop={1}>
          <Text color={themeColors.textDim}>{figures.info} Prices per million tokens</Text>
        </Box>
      </Box>
    </ModalContainer>
  );
};
