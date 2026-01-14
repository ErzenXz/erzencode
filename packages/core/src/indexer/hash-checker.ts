/**
 * Hash Checker for incremental indexing.
 * Tracks file content hashes to detect changes.
 */

import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { ScannedFile } from "./file-scanner.js";
import type {
  IndexMetadata,
  FileMetadata,
  ProgressCallback,
  VoyageCodeModel,
  CURRENT_SCHEMA_VERSION,
} from "./types.js";

/**
 * Result of comparing files against stored hashes.
 */
export interface HashCheckResult {
  /** Files that need to be indexed (new or changed) */
  toIndex: ScannedFile[];
  /** Files that haven't changed and can be skipped */
  toSkip: ScannedFile[];
  /** File paths that were deleted and should be removed from index */
  toDelete: string[];
}

/**
 * Computes SHA-256 hash of file content.
 */
export async function hashFileContent(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Computes SHA-256 hash of a string.
 */
export function hashString(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Generates a project ID from the project path.
 */
export function generateProjectId(projectPath: string): string {
  const absolutePath = path.resolve(projectPath);
  return createHash("sha256").update(absolutePath).digest("hex").slice(0, 16);
}

/**
 * Hash checker for incremental indexing.
 */
export class HashChecker {
  private metadata: IndexMetadata | null = null;
  private metadataPath: string;
  private onProgress?: ProgressCallback;

  constructor(indexDir: string, onProgress?: ProgressCallback) {
    this.metadataPath = path.join(indexDir, "metadata.json");
    this.onProgress = onProgress;
  }

  /**
   * Loads existing metadata from disk.
   */
  async loadMetadata(): Promise<IndexMetadata | null> {
    try {
      const content = await fs.readFile(this.metadataPath, "utf-8");
      this.metadata = JSON.parse(content) as IndexMetadata;
      return this.metadata;
    } catch {
      this.metadata = null;
      return null;
    }
  }

  /**
   * Creates new metadata for a project.
   */
  createMetadata(
    projectPath: string,
    voyageModel: VoyageCodeModel,
    embeddingDimension: number
  ): IndexMetadata {
    const now = Date.now();
    this.metadata = {
      projectId: generateProjectId(projectPath),
      projectPath: path.resolve(projectPath),
      createdAt: now,
      updatedAt: now,
      totalFiles: 0,
      totalChunks: 0,
      files: {},
      voyageModel,
      embeddingDimension,
      schemaVersion: 1,
    };
    return this.metadata;
  }

  /**
   * Saves metadata to disk.
   */
  async saveMetadata(metadata: IndexMetadata): Promise<void> {
    this.metadata = metadata;
    await fs.mkdir(path.dirname(this.metadataPath), { recursive: true });
    await fs.writeFile(
      this.metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf-8"
    );
  }

  /**
   * Checks which files need to be indexed.
   */
  async checkFiles(files: ScannedFile[]): Promise<HashCheckResult> {
    const toIndex: ScannedFile[] = [];
    const toSkip: ScannedFile[] = [];
    const toDelete: string[] = [];

    // Track which stored files we've seen
    const seenPaths = new Set<string>();

    this.onProgress?.({
      phase: "hashing",
      current: 0,
      total: files.length,
      message: "Computing file hashes...",
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      seenPaths.add(file.relativePath);

      try {
        const currentHash = await hashFileContent(file.absolutePath);
        const storedMeta = this.metadata?.files[file.relativePath];

        if (storedMeta && storedMeta.hash === currentHash) {
          // File hasn't changed
          toSkip.push(file);
        } else {
          // File is new or changed
          toIndex.push(file);
        }
      } catch {
        // Can't read file, treat as changed
        toIndex.push(file);
      }

      if ((i + 1) % 100 === 0 || i === files.length - 1) {
        this.onProgress?.({
          phase: "hashing",
          current: i + 1,
          total: files.length,
          currentFile: file.relativePath,
        });
      }
    }

    // Find deleted files
    if (this.metadata) {
      for (const storedPath of Object.keys(this.metadata.files)) {
        if (!seenPaths.has(storedPath)) {
          toDelete.push(storedPath);
        }
      }
    }

    return { toIndex, toSkip, toDelete };
  }

  /**
   * Updates metadata for a file after indexing.
   */
  updateFileMetadata(
    filePath: string,
    hash: string,
    chunkCount: number,
    language: string
  ): void {
    if (!this.metadata) return;

    this.metadata.files[filePath] = {
      path: filePath,
      hash,
      lastIndexed: Date.now(),
      chunkCount,
      language: language as any,
    };
  }

  /**
   * Removes a file from metadata.
   */
  removeFileMetadata(filePath: string): void {
    if (!this.metadata) return;
    delete this.metadata.files[filePath];
  }

  /**
   * Updates aggregate counts in metadata.
   */
  updateCounts(totalFiles: number, totalChunks: number): void {
    if (!this.metadata) return;
    this.metadata.totalFiles = totalFiles;
    this.metadata.totalChunks = totalChunks;
    this.metadata.updatedAt = Date.now();
  }

  /**
   * Gets current metadata.
   */
  getMetadata(): IndexMetadata | null {
    return this.metadata;
  }
}
