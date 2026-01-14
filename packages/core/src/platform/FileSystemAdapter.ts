/**
 * File System Adapter Interface
 * Abstract file system operations for cross-platform compatibility
 */

import type {
  FileStats,
  ListOptions,
  SearchResult,
} from "./types.js";

export interface FileSystemAdapter {
  /**
   * Read file contents as a string
   */
  readFile(path: string): Promise<string>;

  /**
   * Write content to a file
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Check if a file exists
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * List files in a directory
   */
  listFiles(dir: string, options?: ListOptions): Promise<string[]>;

  /**
   * Get file stats
   */
  stat(path: string): Promise<FileStats>;

  /**
   * Delete a file
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Search for files by name
   */
  searchFiles(query: string): Promise<SearchResult[]>;

  /**
   * Search for content in files (grep)
   */
  grepContent(
    pattern: string,
    options?: {
      ignoreCase?: boolean;
      filePattern?: string;
    }
  ): Promise<SearchResult[]>;
}
