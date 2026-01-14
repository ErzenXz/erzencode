/**
 * Search Modal component.
 * Allows semantic search through indexed codebase.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { ModalContainer } from "./ModalContainer.js";
import type { SearchResult } from "@erzencode/core/indexer/types";

export interface SearchModalProps {
  /** Current search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Currently selected result index */
  selectedIndex: number;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Whether an index exists */
  hasIndex: boolean;
  /** Error message if any */
  error: string | null;
  /** Theme border color */
  borderColor?: string;
}

/**
 * Truncates code to fit in display.
 */
function truncateCode(code: string, maxLines: number = 5, maxWidth: number = 55): string {
  const lines = code.split("\n").slice(0, maxLines);
  return lines
    .map((line) => (line.length > maxWidth ? line.slice(0, maxWidth - 3) + "..." : line))
    .join("\n");
}

/**
 * Gets chunk type icon.
 */
function getChunkIcon(chunkType: string): string {
  switch (chunkType) {
    case "function":
      return "fn";
    case "class":
      return "cls";
    case "method":
      return "mtd";
    case "struct":
      return "str";
    case "interface":
      return "ifc";
    case "type":
      return "typ";
    case "enum":
      return "enm";
    case "trait":
      return "trt";
    case "impl":
      return "imp";
    case "module":
      return "mod";
    default:
      return "blk";
  }
}

/**
 * Search result item component.
 */
const SearchResultItem: React.FC<{
  result: SearchResult;
  isSelected: boolean;
}> = ({ result, isSelected }) => {
  const { chunk, score } = result;
  const icon = getChunkIcon(chunk.chunk_type);
  const scorePercent = Math.round(score * 100);

  return (
    <Box
      flexDirection="column"
      borderStyle={isSelected ? "single" : undefined}
      borderColor={isSelected ? "cyan" : undefined}
      paddingX={isSelected ? 1 : 0}
      marginBottom={1}
    >
      <Box>
        <Text color="gray">[{icon}]</Text>
        <Text color="cyan"> {chunk.file_path}</Text>
        <Text color="gray">:{chunk.start_line}</Text>
        {chunk.symbol_name && (
          <Text color="yellow"> {chunk.symbol_name}</Text>
        )}
        <Text color="green"> ({scorePercent}%)</Text>
      </Box>
      {isSelected && (
        <Box marginTop={1} marginLeft={2}>
          <Text color="gray" dimColor>
            {truncateCode(chunk.code)}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const SearchModal: React.FC<SearchModalProps> = ({
  query,
  results,
  selectedIndex,
  isSearching,
  hasIndex,
  error,
  borderColor = "cyan",
}) => {
  return (
    <ModalContainer
      title="Semantic Search"
      width={70}
      borderColor={borderColor}
      footer="Enter: Open file | Tab: Next | Esc: Close"
    >
      {/* No index warning */}
      {!hasIndex && (
        <Box marginBottom={1}>
          <Text color="yellow">
            {figures.warning} No index exists. Run /index first to enable semantic search.
          </Text>
        </Box>
      )}

      {/* Search input display */}
      <Box marginBottom={1}>
        <Text color="cyan">{figures.pointer} Search: </Text>
        <Text>{query || "(type to search)"}</Text>
      </Box>

      {/* Error display */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red">{figures.cross} {error}</Text>
        </Box>
      )}

      {/* Loading indicator */}
      {isSearching && (
        <Box>
          <Text color="gray">{figures.pointerSmall} Searching...</Text>
        </Box>
      )}

      {/* Results */}
      {!isSearching && results.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>
            Found {results.length} result{results.length !== 1 ? "s" : ""}:
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {results.slice(0, 10).map((result, index) => (
              <SearchResultItem
                key={result.chunk.id}
                result={result}
                isSelected={index === selectedIndex}
              />
            ))}
            {results.length > 10 && (
              <Text color="gray" dimColor>
                ... and {results.length - 10} more
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* No results */}
      {!isSearching && query && results.length === 0 && hasIndex && !error && (
        <Box marginTop={1}>
          <Text color="gray">No results found for "{query}"</Text>
        </Box>
      )}

      {/* Empty state */}
      {!query && hasIndex && !isSearching && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Start typing to search through your indexed codebase semantically.
          </Text>
        </Box>
      )}
    </ModalContainer>
  );
};
