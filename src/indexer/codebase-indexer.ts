/**
 * CodebaseIndexer - Main orchestrator for codebase indexing.
 * Coordinates file scanning, parsing, embedding, and storage.
 */

import path from "path";
import fs from "fs/promises";
import { createHash } from "crypto";
import { FileScanner, type ScannedFile } from "./file-scanner.js";
import { HashChecker, hashFileContent, generateProjectId } from "./hash-checker.js";
import { CodeChunker, parseFile } from "./tree-sitter-chunker.js";
import { VoyageEmbedder } from "./voyage-embedder.js";
import { LanceDBStorage, getIndexDir, indexExists } from "./lancedb-storage.js";
import {
  loadProjectConfig,
  saveProjectConfig,
  markPromptShown,
  enableIndexing,
  updateLastIndexed,
} from "./project-config.js";
import type {
  IndexOptions,
  IndexResult,
  IndexStats,
  SearchOptions,
  SearchResult,
  CodeChunk,
  ParsedChunk,
  ProgressCallback,
  VoyageCodeModel,
  IndexMetadata,
  VOYAGE_MODEL_DIMENSIONS,
  DEFAULT_VOYAGE_MODEL,
} from "./types.js";
import { embedQuery } from "./voyage-embedder.js";

/**
 * CodebaseIndexer class - main entry point for indexing operations.
 */
export class CodebaseIndexer {
  private projectPath: string;
  private indexDir: string;
  private voyageApiKey: string;
  private voyageModel: VoyageCodeModel;
  private excludePatterns: string[];
  private onProgress?: ProgressCallback;
  private forceReindex: boolean;

  constructor(options: IndexOptions) {
    this.projectPath = path.resolve(options.projectPath);
    this.indexDir = getIndexDir(this.projectPath);
    this.voyageApiKey = options.voyageApiKey;
    this.voyageModel = options.voyageModel ?? "voyage-code-3";
    this.excludePatterns = options.excludePatterns ?? [];
    this.onProgress = options.onProgress;
    this.forceReindex = options.forceReindex ?? false;
  }

  /**
   * Gets the embedding dimension for the current model.
   */
  private getEmbeddingDimension(): number {
    return this.voyageModel === "voyage-code-3" ? 1024 : 1536;
  }

  /**
   * Runs the full indexing pipeline.
   */
  async index(): Promise<IndexResult> {
    const startTime = Date.now();
    let filesScanned = 0;
    let filesIndexed = 0;
    let filesSkipped = 0;
    let filesRemoved = 0;
    let totalChunks = 0;

    try {
      // Phase 1: Scan files
      this.onProgress?.({
        phase: "initializing",
        current: 0,
        total: 0,
        message: "Initializing indexer...",
      });

      const scanner = new FileScanner(this.projectPath, {
        excludePatterns: this.excludePatterns,
        onProgress: this.onProgress,
      });

      const files = await scanner.scan();
      filesScanned = files.length;

      if (files.length === 0) {
        return {
          success: true,
          filesScanned: 0,
          filesIndexed: 0,
          filesSkipped: 0,
          filesRemoved: 0,
          totalChunks: 0,
          duration: Date.now() - startTime,
        };
      }

      // Phase 2: Check hashes for incremental indexing
      const hashChecker = new HashChecker(this.indexDir, this.onProgress);
      let metadata = await hashChecker.loadMetadata();

      // If force reindex or model changed, clear existing index
      if (
        this.forceReindex ||
        (metadata && metadata.voyageModel !== this.voyageModel)
      ) {
        metadata = null;
        const storage = new LanceDBStorage(this.indexDir);
        await storage.connect();
        await storage.dropTable();
        await storage.close();
      }

      if (!metadata) {
        metadata = hashChecker.createMetadata(
          this.projectPath,
          this.voyageModel,
          this.getEmbeddingDimension()
        );
      }

      const { toIndex, toSkip, toDelete } = await hashChecker.checkFiles(files);
      filesSkipped = toSkip.length;
      filesRemoved = toDelete.length;

      // Phase 3: Delete removed files from index
      if (toDelete.length > 0) {
        this.onProgress?.({
          phase: "cleaning",
          current: 0,
          total: toDelete.length,
          message: `Removing ${toDelete.length} deleted files...`,
        });

        const storage = new LanceDBStorage(this.indexDir);
        await storage.connect();
        await storage.deleteFilesChunks(toDelete);
        await storage.close();

        for (const filePath of toDelete) {
          hashChecker.removeFileMetadata(filePath);
        }
      }

      // If nothing to index, save metadata and return
      if (toIndex.length === 0) {
        // Update counts
        const storage = new LanceDBStorage(this.indexDir);
        await storage.connect();
        totalChunks = await storage.getChunkCount();
        await storage.close();

        hashChecker.updateCounts(Object.keys(metadata.files).length, totalChunks);
        await hashChecker.saveMetadata(metadata);
        await updateLastIndexed(this.projectPath);

        return {
          success: true,
          filesScanned,
          filesIndexed: 0,
          filesSkipped,
          filesRemoved,
          totalChunks,
          duration: Date.now() - startTime,
        };
      }

      // Phase 4: Parse files into chunks
      this.onProgress?.({
        phase: "parsing",
        current: 0,
        total: toIndex.length,
        message: `Parsing ${toIndex.length} files...`,
      });

      const allChunks: Array<{
        chunk: ParsedChunk;
        file: ScannedFile;
        fileHash: string;
      }> = [];

      for (let i = 0; i < toIndex.length; i++) {
        const file = toIndex[i];

        this.onProgress?.({
          phase: "parsing",
          current: i,
          total: toIndex.length,
          currentFile: file.relativePath,
        });

        try {
          const fileHash = await hashFileContent(file.absolutePath);
          const chunks = await parseFile(file.absolutePath, file.language);

          for (const chunk of chunks) {
            allChunks.push({ chunk, file, fileHash });
          }
        } catch (error) {
          console.error(`Failed to parse ${file.relativePath}:`, error);
        }
      }

      this.onProgress?.({
        phase: "parsing",
        current: toIndex.length,
        total: toIndex.length,
        message: `Extracted ${allChunks.length} chunks from ${toIndex.length} files`,
      });

      if (allChunks.length === 0) {
        return {
          success: true,
          filesScanned,
          filesIndexed: toIndex.length,
          filesSkipped,
          filesRemoved,
          totalChunks: 0,
          duration: Date.now() - startTime,
        };
      }

      // Phase 5: Generate embeddings
      const embedder = new VoyageEmbedder({
        apiKey: this.voyageApiKey,
        model: this.voyageModel,
        onProgress: this.onProgress,
      });

      const textsToEmbed = allChunks.map((c) => c.chunk.code);
      const embeddings = await embedder.embedAll(textsToEmbed, "document");

      // Phase 6: Create CodeChunk objects
      const codeChunks: CodeChunk[] = allChunks.map((item, index) => {
        const { chunk, file, fileHash } = item;
        const chunkId = createHash("sha256")
          .update(`${file.relativePath}:${chunk.startLine}:${chunk.endLine}:${fileHash}`)
          .digest("hex")
          .slice(0, 16);

        return {
          id: chunkId,
          file_path: file.relativePath,
          code: chunk.code,
          start_line: chunk.startLine,
          end_line: chunk.endLine,
          file_hash: fileHash,
          chunk_type: chunk.chunkType,
          language: file.language,
          symbol_name: chunk.symbolName ?? "",
          vector: embeddings[index],
        };
      });

      // Phase 7: Store in LanceDB
      const storage = new LanceDBStorage(this.indexDir, this.onProgress);
      await storage.connect();
      await storage.upsertChunks(codeChunks);
      totalChunks = await storage.getChunkCount();
      await storage.close();

      filesIndexed = toIndex.length;

      // Phase 8: Update metadata
      const fileChunkCounts = new Map<string, number>();
      for (const c of codeChunks) {
        const count = fileChunkCounts.get(c.file_path) ?? 0;
        fileChunkCounts.set(c.file_path, count + 1);
      }

      for (const file of toIndex) {
        const fileHash = await hashFileContent(file.absolutePath);
        hashChecker.updateFileMetadata(
          file.relativePath,
          fileHash,
          fileChunkCounts.get(file.relativePath) ?? 0,
          file.language
        );
      }

      hashChecker.updateCounts(Object.keys(metadata.files).length, totalChunks);
      await hashChecker.saveMetadata(metadata);
      await updateLastIndexed(this.projectPath);

      this.onProgress?.({
        phase: "done",
        current: filesIndexed,
        total: filesIndexed,
        message: `Indexed ${filesIndexed} files with ${totalChunks} chunks`,
      });

      return {
        success: true,
        filesScanned,
        filesIndexed,
        filesSkipped,
        filesRemoved,
        totalChunks,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      this.onProgress?.({
        phase: "error",
        current: 0,
        total: 0,
        error: message,
      });

      return {
        success: false,
        filesScanned,
        filesIndexed,
        filesSkipped,
        filesRemoved,
        totalChunks,
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  /**
   * Checks if an index exists for this project.
   */
  async hasIndex(): Promise<boolean> {
    return indexExists(this.projectPath);
  }

  /**
   * Gets statistics about the index.
   */
  async getStats(): Promise<IndexStats> {
    const exists = await this.hasIndex();
    if (!exists) {
      return {
        exists: false,
        totalFiles: 0,
        totalChunks: 0,
      };
    }

    try {
      const hashChecker = new HashChecker(this.indexDir);
      const metadata = await hashChecker.loadMetadata();

      const storage = new LanceDBStorage(this.indexDir);
      await storage.connect();
      const chunkCount = await storage.getChunkCount();
      const sizeBytes = await storage.getDatabaseSize();
      await storage.close();

      return {
        exists: true,
        totalFiles: metadata?.totalFiles ?? 0,
        totalChunks: chunkCount,
        voyageModel: metadata?.voyageModel,
        lastUpdated: metadata?.updatedAt,
        sizeBytes,
      };
    } catch {
      return {
        exists: false,
        totalFiles: 0,
        totalChunks: 0,
      };
    }
  }

  /**
   * Deletes the index.
   */
  async deleteIndex(): Promise<void> {
    try {
      await fs.rm(this.indexDir, { recursive: true, force: true });
    } catch {
      // Index might not exist
    }
  }

  /**
   * Searches the index for similar code.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const exists = await this.hasIndex();
    if (!exists) {
      return [];
    }

    try {
      // Embed the query
      const queryVector = await embedQuery(query, this.voyageApiKey, this.voyageModel);

      // Search
      const storage = new LanceDBStorage(this.indexDir);
      await storage.connect();
      const results = await storage.search(queryVector, options);
      await storage.close();

      return results;
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }
}

/**
 * Creates a CodebaseIndexer and runs indexing.
 */
export async function indexCodebase(options: IndexOptions): Promise<IndexResult> {
  const indexer = new CodebaseIndexer(options);
  return indexer.index();
}

/**
 * Searches an indexed codebase.
 */
export async function searchCodebase(
  projectPath: string,
  query: string,
  voyageApiKey: string,
  options: SearchOptions & { voyageModel?: VoyageCodeModel } = {}
): Promise<SearchResult[]> {
  const indexer = new CodebaseIndexer({
    projectPath,
    voyageApiKey,
    voyageModel: options.voyageModel,
  });
  return indexer.search(query, options);
}

/**
 * Gets index statistics for a project.
 */
export async function getIndexStats(projectPath: string): Promise<IndexStats> {
  // We need a dummy API key for the indexer, but stats doesn't use it
  const indexer = new CodebaseIndexer({
    projectPath,
    voyageApiKey: "dummy",
  });
  return indexer.getStats();
}

/**
 * Checks if a project has an index.
 */
export async function hasIndex(projectPath: string): Promise<boolean> {
  return indexExists(projectPath);
}

/**
 * Re-exports for convenience.
 */
export { getIndexDir, indexExists } from "./lancedb-storage.js";
export { embedQuery } from "./voyage-embedder.js";
