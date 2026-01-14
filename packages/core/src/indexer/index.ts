/**
 * CodebaseIndexer module exports.
 * Provides semantic code indexing with LanceDB and Voyage AI embeddings.
 */

// Main indexer
export {
  CodebaseIndexer,
  indexCodebase,
  searchCodebase,
  getIndexStats,
  hasIndex,
  getIndexDir,
  indexExists,
  embedQuery,
} from "./codebase-indexer.js";

// File scanning
export {
  FileScanner,
  scanProject,
  type ScannedFile,
  type ScanOptions,
} from "./file-scanner.js";

// Hash checking
export {
  HashChecker,
  hashFileContent,
  hashString,
  generateProjectId,
  type HashCheckResult,
} from "./hash-checker.js";

// Code chunking
export {
  CodeChunker,
  parseFile,
  parseContent,
  isTreeSitterAvailable,
} from "./tree-sitter-chunker.js";

// Voyage embeddings
export {
  VoyageEmbedder,
  VoyageError,
  embedTexts,
  type VoyageEmbedderOptions,
} from "./voyage-embedder.js";

// LanceDB storage
export {
  LanceDBStorage,
  deleteIndex,
} from "./lancedb-storage.js";

// Project configuration
export {
  loadProjectConfig,
  saveProjectConfig,
  wasPromptShown,
  markPromptShown,
  enableIndexing,
  disableIndexing,
  isIndexingEnabled,
  getProjectVoyageModel,
  updateLastIndexed,
  getAllProjectConfigs,
  getProjectId,
} from "./project-config.js";

// Types
export type {
  // Core types
  VoyageCodeModel,
  SupportedLanguage,
  ChunkType,
  ParsedChunk,
  CodeChunk,
  FileMetadata,
  IndexMetadata,
  // Progress and results
  IndexingPhase,
  IndexingProgress,
  ProgressCallback,
  IndexResult,
  IndexStats,
  SearchResult,
  // Options
  IndexOptions,
  SearchOptions,
  ProjectIndexConfig,
} from "./types.js";

// Constants
export {
  VOYAGE_MODEL_DIMENSIONS,
  DEFAULT_VOYAGE_MODEL,
  EXTENSION_TO_LANGUAGE,
  AST_SUPPORTED_LANGUAGES,
  DEFAULT_EXCLUDE_PATTERNS,
  INDEXABLE_EXTENSIONS,
  CURRENT_SCHEMA_VERSION,
} from "./types.js";
