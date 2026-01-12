/**
 * File Scanner for CodebaseIndexer.
 * Discovers code files while respecting exclusion patterns.
 */

import fs from "fs/promises";
import path from "path";
import {
  type SupportedLanguage,
  EXTENSION_TO_LANGUAGE,
  DEFAULT_EXCLUDE_PATTERNS,
  INDEXABLE_EXTENSIONS,
  type ProgressCallback,
} from "./types.js";

/**
 * Information about a scanned file.
 */
export interface ScannedFile {
  /** Absolute file path */
  absolutePath: string;
  /** Path relative to project root */
  relativePath: string;
  /** Detected programming language */
  language: SupportedLanguage;
  /** File size in bytes */
  size: number;
}

/**
 * Options for file scanning.
 */
export interface ScanOptions {
  /** Additional patterns to exclude */
  excludePatterns?: string[];
  /** Maximum file size to index (bytes) */
  maxFileSize?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Default maximum file size (1MB).
 */
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

/**
 * Files that should always be excluded regardless of extension.
 */
const EXCLUDED_FILENAMES = new Set([
  ".gitignore",
  ".gitattributes",
  ".npmrc",
  ".yarnrc",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".eslintignore",
  ".prettierignore",
  "tsconfig.json",
  "jsconfig.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.toml",
  "go.mod",
  "go.sum",
  "Gemfile",
  "Makefile",
  "Dockerfile",
  "docker-compose.yml",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
]);

/**
 * Simple ignore pattern matcher.
 * Supports basic glob patterns like *, **, and negation with !
 */
class IgnoreMatcher {
  private patterns: Array<{ pattern: string; negated: boolean; regex: RegExp }> = [];

  add(patterns: string[]): void {
    for (const pattern of patterns) {
      if (!pattern || pattern.startsWith("#")) continue;
      
      const negated = pattern.startsWith("!");
      const cleanPattern = negated ? pattern.slice(1) : pattern;
      
      // Convert glob pattern to regex
      const regexStr = cleanPattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, "{{GLOBSTAR}}")
        .replace(/\*/g, "[^/]*")
        .replace(/{{GLOBSTAR}}/g, ".*")
        .replace(/\?/g, "[^/]");
      
      // Match pattern at any directory level
      const regex = new RegExp(`(^|/)${regexStr}($|/)`, "i");
      
      this.patterns.push({ pattern: cleanPattern, negated, regex });
    }
  }

  ignores(filePath: string): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");
    let ignored = false;

    for (const { negated, regex } of this.patterns) {
      if (regex.test(normalizedPath)) {
        ignored = !negated;
      }
    }

    return ignored;
  }
}

/**
 * Scans a directory for indexable code files.
 */
export class FileScanner {
  private projectPath: string;
  private ignorer: IgnoreMatcher;
  private maxFileSize: number;
  private onProgress?: ProgressCallback;

  constructor(projectPath: string, options: ScanOptions = {}) {
    this.projectPath = path.resolve(projectPath);
    this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    this.onProgress = options.onProgress;

    // Initialize ignore patterns
    this.ignorer = new IgnoreMatcher();
    
    // Add default exclusions
    this.ignorer.add(DEFAULT_EXCLUDE_PATTERNS);
    
    // Add custom exclusions
    if (options.excludePatterns) {
      this.ignorer.add(options.excludePatterns);
    }
  }

  /**
   * Loads and applies .gitignore and .erzenignore patterns.
   */
  async loadIgnoreFiles(): Promise<void> {
    const ignoreFiles = [".gitignore", ".erzenignore"];
    
    for (const filename of ignoreFiles) {
      const filepath = path.join(this.projectPath, filename);
      try {
        const content = await fs.readFile(filepath, "utf-8");
        // Parse and add each non-empty, non-comment line
        const patterns = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));
        this.ignorer.add(patterns);
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  /**
   * Checks if a file extension is indexable.
   */
  private isIndexableExtension(ext: string): boolean {
    return INDEXABLE_EXTENSIONS.includes(ext.toLowerCase());
  }

  /**
   * Gets the language for a file extension.
   */
  private getLanguage(ext: string): SupportedLanguage {
    return EXTENSION_TO_LANGUAGE[ext.toLowerCase()] ?? "unknown";
  }

  /**
   * Checks if a file should be excluded based on its name.
   */
  private isExcludedFilename(filename: string): boolean {
    return EXCLUDED_FILENAMES.has(filename);
  }

  /**
   * Recursively scans a directory for files.
   */
  private async scanDirectory(
    dirPath: string,
    files: ScannedFile[]
  ): Promise<void> {
    let entryNames: string[];
    
    try {
      entryNames = await fs.readdir(dirPath);
    } catch {
      // Can't read directory, skip
      return;
    }

    for (const entryName of entryNames) {
      const fullPath = path.join(dirPath, entryName);
      const relativePath = path.relative(this.projectPath, fullPath);

      // Check if ignored
      if (this.ignorer.ignores(relativePath)) {
        continue;
      }

      // Check if directory or file using stat
      try {
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          // Recursively scan subdirectory
          await this.scanDirectory(fullPath, files);
        } else if (stats.isFile()) {
          // Check if file should be indexed
          const ext = path.extname(entryName);
          
          if (!this.isIndexableExtension(ext)) {
            continue;
          }

          if (this.isExcludedFilename(entryName)) {
            continue;
          }

          // Check file size
          if (stats.size > this.maxFileSize) {
            continue;
          }

          files.push({
            absolutePath: fullPath,
            relativePath,
            language: this.getLanguage(ext),
            size: stats.size,
          });
        }
      } catch {
        // Can't stat entry, skip
      }
    }
  }

  /**
   * Scans the project directory for indexable files.
   * @returns Array of scanned file information
   */
  async scan(): Promise<ScannedFile[]> {
    // Load ignore files first
    await this.loadIgnoreFiles();

    this.onProgress?.({
      phase: "scanning",
      current: 0,
      total: 0,
      message: "Discovering files...",
    });

    const files: ScannedFile[] = [];
    await this.scanDirectory(this.projectPath, files);

    this.onProgress?.({
      phase: "scanning",
      current: files.length,
      total: files.length,
      message: `Found ${files.length} files`,
    });

    // Sort by path for consistent ordering
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return files;
  }

  /**
   * Quick check if a single file should be indexed.
   */
  shouldIndexFile(filePath: string): boolean {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(this.projectPath, filePath)
      : filePath;

    // Check ignore patterns
    if (this.ignorer.ignores(relativePath)) {
      return false;
    }

    // Check extension
    const ext = path.extname(filePath);
    if (!this.isIndexableExtension(ext)) {
      return false;
    }

    // Check filename
    if (this.isExcludedFilename(path.basename(filePath))) {
      return false;
    }

    return true;
  }
}

/**
 * Convenience function to scan a project directory.
 */
export async function scanProject(
  projectPath: string,
  options: ScanOptions = {}
): Promise<ScannedFile[]> {
  const scanner = new FileScanner(projectPath, options);
  return scanner.scan();
}
