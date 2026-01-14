/**
 * VSCode File System Adapter Implementation
 * Implements FileSystemAdapter using VSCode APIs
 */

import * as vscode from "vscode";
import * as path from "path";
import type {
  FileSystemAdapter,
  FileStats,
  ListOptions,
  SearchResult,
} from "@erzencode/core/platform/index.js";

export class VSCodeFileSystemAdapter implements FileSystemAdapter {
  async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString("utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

    // Show the file in editor
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string, options?: ListOptions): Promise<string[]> {
    const uri = vscode.Uri.file(dir);
    const entries = await vscode.workspace.fs.readDirectory(uri);

    const files: string[] = [];

    for (const [name, type] of entries) {
      // Skip ignored files
      if (
        options?.ignore &&
        options.ignore.some((pattern: string) => name.startsWith(pattern))
      ) {
        continue;
      }

      const fullPath = path.join(dir, name);

      if (type === vscode.FileType.File) {
        files.push(fullPath);
      } else if (type === vscode.FileType.Directory && options?.recursive) {
        files.push(...(await this.listFiles(fullPath, options)));
      }
    }

    return files;
  }

  async stat(filePath: string): Promise<FileStats> {
    const uri = vscode.Uri.file(filePath);
    const stats = await vscode.workspace.fs.stat(uri);

    return {
      size: stats.size,
      isFile: stats.type === vscode.FileType.File,
      isDirectory: stats.type === vscode.FileType.Directory,
      mtime: stats.mtime ? new Date(stats.mtime) : undefined,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.delete(uri);
  }

  async searchFiles(query: string): Promise<SearchResult[]> {
    // Use VSCode's findFiles
    const pattern = `**/*${query}*`;
    const uris = await vscode.workspace.findFiles(pattern, null, 100);

    return uris.map((uri) => ({ path: uri.fsPath }));
  }

  async grepContent(
    pattern: string,
    options?: { ignoreCase?: boolean; filePattern?: string }
  ): Promise<SearchResult[]> {
    // TODO: Implement grep search using VSCode's search API or external tools
    // For now, return empty results
    return [];
  }
}
