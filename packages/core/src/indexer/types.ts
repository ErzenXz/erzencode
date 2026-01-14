/**
 * Type definitions for the CodebaseIndexer system.
 * Handles semantic code indexing with LanceDB and Voyage AI embeddings.
 */

/**
 * Voyage AI embedding models for code.
 */
export type VoyageCodeModel = 
  | "voyage-code-3"      // Latest: 1024 dims, 32K context
  | "voyage-code-2";     // Legacy: 1536 dims, 16K context

/**
 * Embedding dimensions for each model.
 */
export const VOYAGE_MODEL_DIMENSIONS: Record<VoyageCodeModel, number> = {
  "voyage-code-3": 1024,
  "voyage-code-2": 1536,
};

/**
 * Default Voyage model to use.
 */
export const DEFAULT_VOYAGE_MODEL: VoyageCodeModel = "voyage-code-3";

/**
 * Supported programming languages for AST parsing.
 */
export type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "c"
  | "cpp"
  | "java"
  | "ruby"
  | "bash"
  | "markdown"
  | "json"
  | "yaml"
  | "toml"
  | "html"
  | "css"
  | "unknown";

/**
 * File extension to language mapping.
 */
export const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  // JavaScript/TypeScript
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  // Python
  ".py": "python",
  ".pyi": "python",
  ".pyw": "python",
  // Go
  ".go": "go",
  // Rust
  ".rs": "rust",
  // C/C++
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  ".hh": "cpp",
  // Java
  ".java": "java",
  // Ruby
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",
  // Shell
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  // Other
  ".md": "markdown",
  ".mdx": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "css",
  ".less": "css",
};

/**
 * Languages that support AST-based parsing via tree-sitter.
 */
export const AST_SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "c",
  "cpp",
  "java",
  "ruby",
  "bash",
];

/**
 * Type of code chunk extracted.
 */
export type ChunkType =
  | "function"
  | "class"
  | "method"
  | "struct"
  | "interface"
  | "type"
  | "enum"
  | "trait"
  | "impl"
  | "module"
  | "block"
  | "file";

/**
 * A parsed code chunk before embedding.
 */
export interface ParsedChunk {
  /** The actual code content */
  code: string;
  /** 1-based start line number */
  startLine: number;
  /** 1-based end line number */
  endLine: number;
  /** Type of the chunk */
  chunkType: ChunkType;
  /** Symbol name (function/class name) if applicable */
  symbolName?: string;
}

/**
 * A code chunk with embedding, ready for storage.
 * This matches the LanceDB schema.
 */
export interface CodeChunk {
  /** Unique ID: {file_path}:{start_line}:{end_line}:{hash} */
  id: string;
  /** File path relative to project root */
  file_path: string;
  /** The actual code content */
  code: string;
  /** 1-based start line number */
  start_line: number;
  /** 1-based end line number */
  end_line: number;
  /** SHA-256 hash of the file content */
  file_hash: string;
  /** Type of the chunk */
  chunk_type: ChunkType;
  /** Programming language */
  language: SupportedLanguage;
  /** Symbol name (function/class name) if applicable */
  symbol_name: string;
  /** Embedding vector */
  vector: number[];
}

/**
 * File metadata for incremental indexing.
 */
export interface FileMetadata {
  /** Relative file path */
  path: string;
  /** SHA-256 hash of file content */
  hash: string;
  /** Unix timestamp of last indexing */
  lastIndexed: number;
  /** Number of chunks extracted from this file */
  chunkCount: number;
  /** Detected language */
  language: SupportedLanguage;
}

/**
 * Project index metadata stored alongside LanceDB.
 */
export interface IndexMetadata {
  /** SHA-256 hash of absolute project path (first 16 chars) */
  projectId: string;
  /** Absolute project path */
  projectPath: string;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;
  /** Total number of indexed files */
  totalFiles: number;
  /** Total number of chunks in the index */
  totalChunks: number;
  /** Per-file metadata */
  files: Record<string, FileMetadata>;
  /** Voyage model used for embeddings */
  voyageModel: VoyageCodeModel;
  /** Embedding dimension (for validation) */
  embeddingDimension: number;
  /** Schema version for future migrations */
  schemaVersion: number;
}

/**
 * Current schema version.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Indexing progress phases.
 */
export type IndexingPhase =
  | "initializing"
  | "scanning"
  | "hashing"
  | "parsing"
  | "embedding"
  | "storing"
  | "cleaning"
  | "done"
  | "error";

/**
 * Progress update during indexing.
 */
export interface IndexingProgress {
  /** Current phase */
  phase: IndexingPhase;
  /** Current item number */
  current: number;
  /** Total items in this phase */
  total: number;
  /** Current file being processed */
  currentFile?: string;
  /** Error message if phase is 'error' */
  error?: string;
  /** Phase-specific message */
  message?: string;
}

/**
 * Callback for progress updates.
 */
export type ProgressCallback = (progress: IndexingProgress) => void;

/**
 * Result of an indexing operation.
 */
export interface IndexResult {
  /** Whether indexing completed successfully */
  success: boolean;
  /** Total files scanned */
  filesScanned: number;
  /** Files that were actually indexed (new or changed) */
  filesIndexed: number;
  /** Files that were skipped (unchanged) */
  filesSkipped: number;
  /** Files that were removed from index (deleted) */
  filesRemoved: number;
  /** Total chunks in the index */
  totalChunks: number;
  /** Time taken in milliseconds */
  duration: number;
  /** Error message if success is false */
  error?: string;
}

/**
 * Statistics about the index.
 */
export interface IndexStats {
  /** Whether an index exists */
  exists: boolean;
  /** Total number of files */
  totalFiles: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Voyage model used */
  voyageModel?: VoyageCodeModel;
  /** Last update timestamp */
  lastUpdated?: number;
  /** Size of index on disk (bytes) */
  sizeBytes?: number;
}

/**
 * A search result from the vector index.
 */
export interface SearchResult {
  /** The code chunk */
  chunk: CodeChunk;
  /** Similarity score (higher is better) */
  score: number;
  /** Distance from query vector */
  distance: number;
}

/**
 * Options for indexing.
 */
export interface IndexOptions {
  /** Project root directory */
  projectPath: string;
  /** Voyage AI API key */
  voyageApiKey: string;
  /** Voyage model to use */
  voyageModel?: VoyageCodeModel;
  /** Additional patterns to exclude (on top of defaults) */
  excludePatterns?: string[];
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Whether to force full re-index */
  forceReindex?: boolean;
}

/**
 * Options for search.
 */
export interface SearchOptions {
  /** Maximum number of results */
  limit?: number;
  /** Filter by language */
  language?: SupportedLanguage;
  /** Filter by file path pattern */
  filePattern?: string;
  /** Filter by chunk type */
  chunkType?: ChunkType;
  /** Minimum similarity score (0-1) */
  minScore?: number;
}

/**
 * Project-level configuration for indexing.
 */
export interface ProjectIndexConfig {
  /** Whether indexing is enabled for this project */
  enabled: boolean;
  /** Whether to auto-index on file changes */
  autoIndex: boolean;
  /** Whether the first-run prompt was shown */
  promptShown: boolean;
  /** Custom exclude patterns for this project */
  excludePatterns?: string[];
  /** Voyage model preference for this project */
  voyageModel?: VoyageCodeModel;
  /** Last time indexing was run */
  lastIndexed?: number;
}

/**
 * Default patterns to always exclude.
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  // Dependencies
  "node_modules",
  "vendor",
  "bower_components",
  "jspm_packages",
  // Build outputs
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".output",
  ".vercel",
  ".netlify",
  // Cache directories
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".nox",
  // Version control
  ".git",
  ".svn",
  ".hg",
  // IDE/Editor
  ".idea",
  ".vscode",
  ".vs",
  "*.swp",
  "*.swo",
  // OS files
  ".DS_Store",
  "Thumbs.db",
  // Logs
  "logs",
  "*.log",
  // Coverage
  "coverage",
  ".nyc_output",
  "htmlcov",
  // Lock files (not code)
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Gemfile.lock",
  "poetry.lock",
  "Cargo.lock",
  "go.sum",
  // Generated
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.d.ts",
  // Binary/Media
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.ico",
  "*.svg",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "*.mp3",
  "*.mp4",
  "*.wav",
  "*.pdf",
  "*.zip",
  "*.tar",
  "*.gz",
  // Database files
  "*.sqlite",
  "*.db",
  // Environment
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
];

/**
 * Supported file extensions for indexing.
 */
export const INDEXABLE_EXTENSIONS = Object.keys(EXTENSION_TO_LANGUAGE);
