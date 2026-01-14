/**
 * LanceDB Vector Storage for code chunks.
 * Handles storage, retrieval, and search of embedded code.
 */

import path from "path";
import fs from "fs/promises";
import { createHash } from "crypto";
import type {
  CodeChunk,
  SearchResult,
  SearchOptions,
  ProgressCallback,
  VoyageCodeModel,
  VOYAGE_MODEL_DIMENSIONS,
} from "./types.js";
import { getDataDir } from "../config.js";

/**
 * Table name for code chunks.
 */
const CODE_CHUNKS_TABLE = "code_chunks";

/**
 * LanceDB connection and table interfaces.
 */
interface LanceConnection {
  openTable(name: string): Promise<LanceTable>;
  createTable(name: string, data: any[]): Promise<LanceTable>;
  tableNames(): Promise<string[]>;
  dropTable(name: string): Promise<void>;
}

interface LanceTable {
  add(data: any[]): Promise<void>;
  delete(filter: string): Promise<void>;
  search(vector: number[]): LanceQuery;
  countRows(): Promise<number>;
  overwrite(data: any[]): Promise<void>;
}

interface LanceQuery {
  limit(n: number): LanceQuery;
  where(filter: string): LanceQuery;
  execute(): Promise<any[]>;
}

/**
 * LanceDB storage class.
 */
export class LanceDBStorage {
  private indexDir: string;
  private dbPath: string;
  private connection: LanceConnection | null = null;
  private table: LanceTable | null = null;
  private onProgress?: ProgressCallback;

  constructor(indexDir: string, onProgress?: ProgressCallback) {
    this.indexDir = indexDir;
    this.dbPath = path.join(indexDir, "lancedb");
    this.onProgress = onProgress;
  }

  /**
   * Connects to the LanceDB database.
   */
  async connect(): Promise<void> {
    if (this.connection) return;

    // Ensure directory exists
    await fs.mkdir(this.dbPath, { recursive: true });

    try {
      // Dynamic import of lancedb
      const lancedb = await import("@lancedb/lancedb");
      this.connection = await lancedb.connect(this.dbPath) as unknown as LanceConnection;

      // Try to open existing table
      const tables = await this.connection.tableNames();
      if (tables.includes(CODE_CHUNKS_TABLE)) {
        this.table = await this.connection.openTable(CODE_CHUNKS_TABLE);
      }
    } catch (error) {
      console.error("Failed to connect to LanceDB:", error);
      throw error;
    }
  }

  /**
   * Ensures the table exists.
   */
  private async ensureTable(sampleVector: number[]): Promise<void> {
    if (this.table) return;
    if (!this.connection) {
      await this.connect();
    }

    // Create table with a sample record
    const sampleChunk: CodeChunk = {
      id: "__sample__",
      file_path: "",
      code: "",
      start_line: 0,
      end_line: 0,
      file_hash: "",
      chunk_type: "block",
      language: "unknown",
      symbol_name: "",
      vector: sampleVector,
    };

    this.table = await this.connection!.createTable(CODE_CHUNKS_TABLE, [sampleChunk]);
    
    // Delete the sample record
    await this.table.delete('id = "__sample__"');
  }

  /**
   * Adds or updates chunks in the database.
   */
  async upsertChunks(chunks: CodeChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    
    await this.connect();
    await this.ensureTable(chunks[0].vector);

    this.onProgress?.({
      phase: "storing",
      current: 0,
      total: chunks.length,
      message: "Storing chunks in database...",
    });

    // LanceDB handles upsert by adding new records
    // We'll delete existing records for the same file first
    const filePaths = [...new Set(chunks.map((c) => c.file_path))];
    
    for (const filePath of filePaths) {
      try {
        // Escape quotes in file path
        const escaped = filePath.replace(/'/g, "''");
        await this.table!.delete(`file_path = '${escaped}'`);
      } catch {
        // Table might not exist or no records to delete
      }
    }

    // Add new chunks in batches
    const batchSize = 1000;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await this.table!.add(batch);

      this.onProgress?.({
        phase: "storing",
        current: Math.min(i + batchSize, chunks.length),
        total: chunks.length,
      });
    }
  }

  /**
   * Deletes all chunks for a file.
   */
  async deleteFileChunks(filePath: string): Promise<void> {
    if (!this.table) return;

    try {
      const escaped = filePath.replace(/'/g, "''");
      await this.table.delete(`file_path = '${escaped}'`);
    } catch {
      // No records to delete
    }
  }

  /**
   * Deletes chunks for multiple files.
   */
  async deleteFilesChunks(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.deleteFileChunks(filePath);
    }
  }

  /**
   * Searches for similar code chunks.
   */
  async search(
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    await this.connect();
    
    if (!this.table) {
      return [];
    }

    const limit = options.limit ?? 10;
    
    try {
      let query = this.table.search(queryVector).limit(limit);

      // Apply filters if specified
      const filters: string[] = [];
      
      if (options.language) {
        filters.push(`language = '${options.language}'`);
      }
      
      if (options.chunkType) {
        filters.push(`chunk_type = '${options.chunkType}'`);
      }
      
      if (options.filePattern) {
        // Simple contains check
        filters.push(`file_path LIKE '%${options.filePattern}%'`);
      }

      if (filters.length > 0) {
        query = query.where(filters.join(" AND "));
      }

      const results = await query.execute();

      return results
        .map((row: any) => ({
          chunk: {
            id: row.id,
            file_path: row.file_path,
            code: row.code,
            start_line: row.start_line,
            end_line: row.end_line,
            file_hash: row.file_hash,
            chunk_type: row.chunk_type,
            language: row.language,
            symbol_name: row.symbol_name,
            vector: row.vector,
          } as CodeChunk,
          score: 1 - (row._distance ?? 0), // Convert distance to similarity
          distance: row._distance ?? 0,
        }))
        .filter((r) => !options.minScore || r.score >= options.minScore);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  /**
   * Gets the total number of chunks.
   */
  async getChunkCount(): Promise<number> {
    if (!this.table) {
      await this.connect();
    }
    if (!this.table) return 0;

    try {
      return await this.table.countRows();
    } catch {
      return 0;
    }
  }

  /**
   * Gets the size of the database on disk.
   */
  async getDatabaseSize(): Promise<number> {
    try {
      let totalSize = 0;
      const entries = await fs.readdir(this.dbPath, { recursive: true });
      
      for (const entry of entries) {
        try {
          const stats = await fs.stat(path.join(this.dbPath, entry as string));
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch {
          // Skip
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Drops the entire table.
   */
  async dropTable(): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    try {
      await this.connection!.dropTable(CODE_CHUNKS_TABLE);
      this.table = null;
    } catch {
      // Table might not exist
    }
  }

  /**
   * Closes the connection.
   */
  async close(): Promise<void> {
    this.connection = null;
    this.table = null;
  }
}

/**
 * Gets the index directory for a project.
 */
export function getIndexDir(projectPath: string): string {
  const absolutePath = path.resolve(projectPath);
  const projectId = createHash("sha256")
    .update(absolutePath)
    .digest("hex")
    .slice(0, 16);
  
  return path.join(getDataDir(), "indexes", projectId);
}

/**
 * Checks if an index exists for a project.
 */
export async function indexExists(projectPath: string): Promise<boolean> {
  const indexDir = getIndexDir(projectPath);
  const metadataPath = path.join(indexDir, "metadata.json");
  
  try {
    await fs.access(metadataPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes the index for a project.
 */
export async function deleteIndex(projectPath: string): Promise<void> {
  const indexDir = getIndexDir(projectPath);
  
  try {
    await fs.rm(indexDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }
}
