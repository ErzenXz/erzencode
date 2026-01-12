import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import Fuse from "fuse.js";

const execAsync = promisify(exec);

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
]);

function normalizeRelPath(p: string): string {
  return p.split(path.sep).join("/");
}

async function scanWorkspaceFiles(
  workspaceRoot: string,
  options?: {
    maxFiles?: number;
    maxDepth?: number;
    ignoredDirs?: Set<string>;
  }
): Promise<string[]> {
  const maxFiles = options?.maxFiles ?? 20000;
  const maxDepth = options?.maxDepth ?? 25;
  const ignoredDirs = options?.ignoredDirs ?? DEFAULT_IGNORED_DIRS;

  const results: string[] = [];

  const walk = async (dirAbs: string, depth: number): Promise<void> => {
    if (results.length >= maxFiles) return;
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;

      const name = entry.name;
      if (name === ".DS_Store") continue;

      const abs = path.join(dirAbs, name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(name)) continue;
        await walk(abs, depth + 1);
      } else if (entry.isFile()) {
        const rel = path.relative(workspaceRoot, abs);
        if (!rel || rel.startsWith("..")) continue;
        results.push(normalizeRelPath(rel));
      }
    }
  };

  await walk(workspaceRoot, 0);
  results.sort();
  return results;
}

export async function loadWorkspaceFiles(
  workspaceRoot: string,
  options?: { maxFiles?: number }
): Promise<string[]> {
  const maxFiles = options?.maxFiles ?? 20000;

  // Prefer git-tracked files for speed + signal.
  try {
    const { stdout } = await execAsync("git ls-files -z", {
      cwd: workspaceRoot,
      maxBuffer: 50 * 1024 * 1024,
    });
    const files = stdout
      .split("\0")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, maxFiles);

    if (files.length > 0) {
      return files;
    }
  } catch {
    // Fall back to filesystem scan
  }

  return scanWorkspaceFiles(workspaceRoot, { maxFiles });
}

export function createFileSearch(files: string[]): (query: string, limit?: number) => string[] {
  const fuse = new Fuse(files, {
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    useExtendedSearch: false,
  });

  return (query: string, limit: number = 12) => {
    const q = (query ?? "").trim();
    if (!q) {
      return files.slice(0, limit);
    }
    return fuse.search(q, { limit }).map((r) => r.item);
  };
}

function isWordBreak(ch: string | undefined): boolean {
  if (!ch) return true;
  return /\s/.test(ch);
}

function isAtMentionStart(prevChar: string | undefined): boolean {
  if (!prevChar) return true;
  if (/\s/.test(prevChar)) return true;
  return prevChar === "(" || prevChar === "[" || prevChar === "{" || prevChar === "\"" || prevChar === "'";
}

export interface AtMentionContext {
  start: number; // index of '@'
  end: number; // end of token (exclusive)
  query: string; // text after '@' up to cursor
}

export function getAtMentionAtCursor(input: string, cursorIndex: number): AtMentionContext | null {
  const text = input ?? "";
  const cursor = Math.max(0, Math.min(cursorIndex ?? 0, text.length));

  // Walk left until word break; if we encounter '@' in this segment, use it.
  let i = cursor - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      const prev = i > 0 ? text[i - 1] : undefined;
      if (!isAtMentionStart(prev)) return null;

      // Find token end
      let end = i + 1;
      while (end < text.length && !isWordBreak(text[end])) end++;

      const query = text.slice(i + 1, cursor);
      return { start: i, end, query };
    }

    if (isWordBreak(ch)) {
      return null;
    }
    i--;
  }

  return null;
}

function sanitizeMention(raw: string): string {
  return raw.replace(/[),.;:!?\]}>]+$/g, "");
}

export function extractAtFileMentions(input: string): string[] {
  const text = input ?? "";
  const matches = Array.from(text.matchAll(/(^|\s)@([^\s]+)/g));
  const out: string[] = [];
  for (const m of matches) {
    const raw = sanitizeMention(m[2] ?? "");
    if (!raw) continue;
    out.push(raw);
  }
  return out;
}

function looksBinary(buf: Buffer): boolean {
  // Simple heuristic: NUL byte indicates binary.
  return buf.includes(0);
}

export async function expandAtFileMentions(
  input: string,
  workspaceRoot: string,
  options?: {
    maxFiles?: number;
    maxBytesPerFile?: number;
    maxTotalBytes?: number;
  }
): Promise<{
  expandedInput: string;
  displayInput: string;
  attachedFiles: string[];
}> {
  const maxFiles = options?.maxFiles ?? 5;
  const maxBytesPerFile = options?.maxBytesPerFile ?? 200_000;
  const maxTotalBytes = options?.maxTotalBytes ?? 500_000;

  const mentions = extractAtFileMentions(input);
  const unique = Array.from(new Set(mentions)).slice(0, maxFiles);

  if (unique.length === 0) {
    return { expandedInput: input, displayInput: input, attachedFiles: [] };
  }

  const resolved: Array<{ rel: string; abs: string }> = [];
  for (const relRaw of unique) {
    const relClean = relRaw.startsWith("./") ? relRaw.slice(2) : relRaw;
    const abs = path.isAbsolute(relClean)
      ? path.resolve(relClean)
      : path.resolve(workspaceRoot, relClean);

    const withinRoot = abs.startsWith(path.resolve(workspaceRoot) + path.sep) || abs === path.resolve(workspaceRoot);
    if (!withinRoot) continue;

    const rel = normalizeRelPath(path.relative(workspaceRoot, abs));
    if (!rel || rel.startsWith("..")) continue;

    resolved.push({ rel, abs });
  }

  let totalBytes = 0;
  const blocks: string[] = [];
  const attachedFiles: string[] = [];

  for (const f of resolved) {
    try {
      const st = await fs.promises.stat(f.abs);
      if (!st.isFile()) continue;
      if (st.size > maxBytesPerFile) continue;
      if (totalBytes + st.size > maxTotalBytes) continue;

      const buf = await fs.promises.readFile(f.abs);
      if (looksBinary(buf)) continue;

      const content = buf.toString("utf-8");
      totalBytes += buf.byteLength;
      attachedFiles.push(f.rel);
      blocks.push(`\n\n[Attached file: ${f.rel}]\n\n\`\`\`\n${content}\n\`\`\``);
    } catch {
      continue;
    }
  }

  if (attachedFiles.length === 0) {
    return { expandedInput: input, displayInput: input, attachedFiles: [] };
  }

  const expandedInput = `${input}${blocks.join("")}`;
  const displayInput = `${input}\n[${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached]`;

  return { expandedInput, displayInput, attachedFiles };
}
