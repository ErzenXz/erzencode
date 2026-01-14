/**
 * Index Modal component.
 * Shows indexing progress and allows triggering codebase indexing.
 */

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import type { IndexingProgress, IndexResult, IndexStats } from "@erzencode/core/indexer/types";
import type { ThemeColors } from "../../types.js";

export interface IndexModalProps {
  /** Current indexing progress (null if not indexing) */
  progress: IndexingProgress | null;
  /** Last indexing result (null if never indexed) */
  lastResult: IndexResult | null;
  /** Index statistics */
  stats: IndexStats | null;
  /** Whether we're waiting for API key */
  needsApiKey: boolean;
  /** Current API key input */
  apiKeyInput: string;
  /** Error message if any */
  error: string | null;
  /** Whether this is the first-run prompt for the project */
  isFirstRunPrompt?: boolean;
  /** Theme colors */
  themeColors: ThemeColors;
}

/**
 * Formats duration in ms to human readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Formats bytes to human readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Gets the phase display text and color.
 */
function getPhaseDisplay(phase: string): { text: string; kind: "muted" | "info" | "warning" | "success" | "error" } {
  switch (phase) {
    case "initializing":
      return { text: "Initializing...", kind: "muted" };
    case "scanning":
      return { text: "Scanning files...", kind: "info" };
    case "hashing":
      return { text: "Computing hashes...", kind: "info" };
    case "parsing":
      return { text: "Parsing code...", kind: "warning" };
    case "embedding":
      return { text: "Generating embeddings...", kind: "info" };
    case "storing":
      return { text: "Storing in database...", kind: "success" };
    case "cleaning":
      return { text: "Cleaning up...", kind: "muted" };
    case "done":
      return { text: "Done!", kind: "success" };
    case "error":
      return { text: "Error", kind: "error" };
    default:
      return { text: phase, kind: "muted" };
  }
}

/**
 * Progress bar component.
 */
const ProgressBar: React.FC<{ current: number; total: number; width?: number; themeColors: ThemeColors }> = ({
  current,
  total,
  width = 30,
  themeColors,
}) => {
  const percent = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.floor(percent * width);
  const empty = width - filled;
  
  return (
    <Box>
      <Text color={themeColors.success}>{"█".repeat(filled)}</Text>
      <Text color={themeColors.textDim}>{"░".repeat(empty)}</Text>
      <Text color={themeColors.text}> {Math.round(percent * 100)}%</Text>
    </Box>
  );
};

export const IndexModal: React.FC<IndexModalProps> = ({
  progress,
  lastResult,
  stats,
  needsApiKey,
  apiKeyInput,
  error,
  isFirstRunPrompt = false,
  themeColors,
}) => {
  // Determine what to show
  const isIndexing = progress && progress.phase !== "done" && progress.phase !== "error";
  const cursor = "│";
  const masked = apiKeyInput ? "•".repeat(apiKeyInput.length) : "";
  const apiKeyDisplay = masked + cursor;

  const phase = progress?.phase ?? "initializing";
  const phaseDisplay = getPhaseDisplay(phase);
  const phaseColor =
    phaseDisplay.kind === "success"
      ? themeColors.success
      : phaseDisplay.kind === "warning"
        ? themeColors.warning
        : phaseDisplay.kind === "error"
          ? themeColors.error
          : phaseDisplay.kind === "info"
            ? themeColors.primary
            : themeColors.textMuted;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={themeColors.border}
      paddingX={1}
      marginX={1}
    >
      <Text color={themeColors.textMuted}>
        {figures.pointer} Codebase Indexer
      </Text>

      {isFirstRunPrompt && !isIndexing && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={themeColors.text}>
            Enable semantic search for this project?
          </Text>
          <Text color={themeColors.textMuted} dimColor>
            We’ll build a local vector index so `/search` can find relevant code fast.
          </Text>
        </Box>
      )}

      {/* API Key Required */}
      {needsApiKey && (
        <Box flexDirection="column">
          <Text color={themeColors.warning}>
            {figures.warning} Voyage AI API key required
          </Text>
          <Text color={themeColors.textMuted}>
            {figures.pointer}{" "}
            {apiKeyInput ? (
              <>
                <Text color={themeColors.text}>{masked}</Text>
                <Text color={themeColors.primary}>{cursor}</Text>
              </>
            ) : (
              <Text color={themeColors.textDim}>type to paste key…</Text>
            )}
          </Text>
          <Text color={themeColors.textMuted} dimColor>
            Get a key: https://dash.voyageai.com
          </Text>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Text color={themeColors.error}>
          {figures.cross} {error}
        </Text>
      )}

      {/* Indexing Progress */}
      {isIndexing && progress && (
        <Box flexDirection="column">
          <Text color={phaseColor}>
            {figures.pointer} {phaseDisplay.text}
          </Text>
          
          {progress.total > 0 && (
            <ProgressBar current={progress.current} total={progress.total} themeColors={themeColors} />
          )}
          
          {progress.currentFile && (
            <Box marginTop={1}>
              <Text color={themeColors.textMuted} dimColor>
                {progress.currentFile.length > 50
                  ? "..." + progress.currentFile.slice(-47)
                  : progress.currentFile}
              </Text>
            </Box>
          )}
          
          {progress.message && (
            <Box marginTop={1}>
              <Text color={themeColors.text}>{progress.message}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Indexing Complete */}
      {progress?.phase === "done" && lastResult && (
        <Box flexDirection="column">
          <Text color={themeColors.success}>{figures.tick} Indexing complete!</Text>
          <Text color={themeColors.textMuted}>
            Files scanned: <Text color={themeColors.text}>{lastResult.filesScanned}</Text>
          </Text>
          <Text color={themeColors.textMuted}>
            Files indexed: <Text color={themeColors.text}>{lastResult.filesIndexed}</Text>
          </Text>
          <Text color={themeColors.textMuted}>
            Total chunks: <Text color={themeColors.text}>{lastResult.totalChunks}</Text>
          </Text>
          <Text color={themeColors.textMuted}>
            Duration: <Text color={themeColors.text}>{formatDuration(lastResult.duration)}</Text>
          </Text>
        </Box>
      )}

      {/* Stats (when not indexing) */}
      {!isIndexing && !needsApiKey && stats && (
        <Box flexDirection="column">
          {stats.exists ? (
            <>
              <Text color={themeColors.success}>{figures.tick} Index exists</Text>
              <Text color={themeColors.textMuted}>
                Files: <Text color={themeColors.text}>{stats.totalFiles}</Text>
              </Text>
              <Text color={themeColors.textMuted}>
                Chunks: <Text color={themeColors.text}>{stats.totalChunks}</Text>
              </Text>
              {stats.voyageModel && (
                <Text color={themeColors.textMuted}>
                  Model: <Text color={themeColors.text}>{stats.voyageModel}</Text>
                </Text>
              )}
              {stats.sizeBytes && (
                <Text color={themeColors.textMuted}>
                  Size: <Text color={themeColors.text}>{formatBytes(stats.sizeBytes)}</Text>
                </Text>
              )}
              {stats.lastUpdated && (
                <Text color={themeColors.textMuted}>
                  Updated: <Text color={themeColors.text}>{new Date(stats.lastUpdated).toLocaleString()}</Text>
                </Text>
              )}
            </>
          ) : (
            <>
              <Text color={themeColors.warning}>{figures.warning} No index exists</Text>
            </>
          )}
        </Box>
      )}

      {/* No stats and not indexing */}
      {!isIndexing && !needsApiKey && !stats && !error && (
        <Box>
          <Text color={themeColors.textMuted} dimColor>
            Loading index information...
          </Text>
        </Box>
      )}

      <Text color={themeColors.textMuted} dimColor>
        {stats?.exists ? "Enter to re-index • Esc to close" : "Enter to index • Esc to close"}
      </Text>
    </Box>
  );
};
