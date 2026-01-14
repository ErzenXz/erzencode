/**
 * Node.js File System Adapter Implementation
 * Implements FileSystemAdapter using Node.js fs module for CLI usage
 */

import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type {
  FileSystemAdapter,
  FileStats,
  ListOptions,
  SearchResult,
} from "@erzencode/core/platform";

const execAsync = promisify(exec);

export class NodeFileSystemAdapter implements FileSystemAdapter {
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, "utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string, options?: ListOptions): Promise<string[]> {
    const ignore = options?.ignore || [];

    const listDir = async (currentDir: string): Promise<string[]> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        // Skip ignored files/directories
        if (
          ignore.some((pattern: string) =>
            path.relative(dir, fullPath).startsWith(pattern)
          )
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          if (options?.recursive) {
            files.push(...(await listDir(fullPath)));
          }
        } else {
          files.push(fullPath);
        }
      }

      return files;
    };

    return listDir(dir);
  }

  async stat(filePath: string): Promise<FileStats> {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      mtime: stats.mtime,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  async searchFiles(query: string): Promise<SearchResult[]> {
    // Simple recursive search using find command or Node.js
    const results: SearchResult[] = [];

    const searchDir = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({ path: fullPath });
        }
      }
    };

    await searchDir(process.cwd());
    return results;
  }

  async grepContent(
    pattern: string,
    options?: { ignoreCase?: boolean; filePattern?: string }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Use ripgrep if available, otherwise fall back to grep
      const args = [];
      if (options?.ignoreCase) args.push("-i");
      if (options?.filePattern) args.push("-g", options.filePattern);
      args.push(pattern, ".");

      const { stdout } = await execAsync(`rg ${args.join(" ")}`);

      for (const line of stdout.split("\n")) {
        if (!line) continue;

        // Parse ripgrep output: filename:line:column:content
        const match = line.match(/^([^:]+):(\d+):(\d+)?:?(.*)$/);
        if (match) {
          results.push({
            path: match[1],
            line: parseInt(match[2], 10),
            column: match[3] ? parseInt(match[3], 10) : undefined,
            content: match[4] || undefined,
          });
        }
      }
    } catch (error) {
      // Ripgrep not found or no matches
      console.error("Grep failed:", error);
    }

    return results;
  }
}
