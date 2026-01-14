/**
 * Standalone Tools for Coding CLI
 * Modeled after OpenCode's tool system
 */

import * as fs from "fs/promises";
import * as path from "path";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import * as diff from "diff";
import * as os from "os";
import { createHash } from "crypto";
import { z } from "zod";
import { tool, type Tool } from "ai";
import {
  searchCodebase,
  hasIndex,
  getIndexStats,
  CodebaseIndexer,
  loadProjectConfig,
  type SearchResult,
  type SearchOptions,
  type IndexStats,
} from "../indexer/index.js";
import { getApiKeyAsync } from "../config.js";

const execAsync = promisify(exec);

// ============================================================================
// Background Process Management
// ============================================================================

interface BackgroundProcess {
  id: string;
  command: string;
  process: ChildProcess;
  startedAt: number;
  output: string[];
  status: "running" | "completed" | "failed" | "killed";
  exitCode?: number;
}

const backgroundProcesses = new Map<string, BackgroundProcess>();
let processCounter = 0;
let rgAvailable: boolean | null = null;
let workspaceRoot =
  process.env.AI_INFRA_WORKSPACE_ROOT ?? process.env.INIT_CWD ?? process.cwd();

// ============================================================================
// Tool Definition Types
// ============================================================================

export type ToolDefinition = Tool<any, any>;

// ============================================================================
// Workspace Management
// ============================================================================

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

function getWorkspaceRoot(): string {
  return workspaceRoot;
}

function resolveWorkspacePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(getWorkspaceRoot(), filePath);
}

async function hasRipgrep(): Promise<boolean> {
  if (rgAvailable !== null) return rgAvailable;
  try {
    await execAsync("rg --version");
    rgAvailable = true;
  } catch {
    rgAvailable = false;
  }
  return rgAvailable;
}

// ============================================================================
// Question/User Input State Management
// ============================================================================

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionRequest {
  id: string;
  question: string;
  header: string;
  options: QuestionOption[];
  multiple: boolean;
  createdAt: number;
}

export interface QuestionResponse {
  id: string;
  answers: string[];
  customText?: string;
  answeredAt: number;
}

const pendingQuestions = new Map<string, QuestionRequest>();
const questionResponses = new Map<string, QuestionResponse>();
let questionCounter = 0;

export function getPendingQuestions(): QuestionRequest[] {
  return Array.from(pendingQuestions.values()).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export function answerQuestion(
  questionId: string,
  answers: string[],
  customText?: string,
): { ok: boolean; reason?: string } {
  const pending = pendingQuestions.get(questionId);
  if (!pending) {
    return { ok: false, reason: "Unknown question id" };
  }

  questionResponses.set(questionId, {
    id: questionId,
    answers,
    customText,
    answeredAt: Date.now(),
  });

  pendingQuestions.delete(questionId);
  return { ok: true };
}

export function cancelQuestion(
  questionId: string,
  reason?: string,
): { ok: boolean; reason?: string } {
  if (!pendingQuestions.has(questionId)) {
    return { ok: false, reason: "Unknown question id" };
  }

  pendingQuestions.delete(questionId);
  questionResponses.set(questionId, {
    id: questionId,
    answers: [],
    customText: reason || "Cancelled by user",
    answeredAt: Date.now(),
  });

  return { ok: true };
}

// ============================================================================
// Todo State Management
// ============================================================================

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: "high" | "medium" | "low";
}

type BashApprovalConfig = {
  yolo: boolean;
  allowPrefixes: string[];
  allowOnce: Record<string, number>;
};

type PendingBashApproval = {
  id: string;
  key: string;
  command: string;
  workdir: string;
  createdAt: number;
  reason: string;
};

type BashApprovalDecision = {
  status: "cancelled";
  reason?: string;
  at: number;
};

let bashApprovalLoaded = false;
let bashApprovalConfig: BashApprovalConfig = {
  yolo:
    process.env.ERZENCODE_YOLO === "1" ||
    process.env.ERZENCODE_YOLO === "true" ||
    process.env.ERZENCODE_BASH_YOLO === "1" ||
    process.env.ERZENCODE_BASH_YOLO === "true",
  allowPrefixes: [],
  allowOnce: {},
};

const pendingBashApprovals = new Map<string, PendingBashApproval>();
const bashApprovalDecisions = new Map<string, BashApprovalDecision>();

function getBashApprovalFilePath(): string {
  return path.join(os.homedir(), ".ai-code", "bash-approval.json");
}

async function ensureBashApprovalLoaded(): Promise<void> {
  if (bashApprovalLoaded) return;
  bashApprovalLoaded = true;

  const allowEnv = process.env.ERZENCODE_BASH_ALLOW_PREFIXES;
  if (allowEnv) {
    const fromEnv = allowEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    bashApprovalConfig.allowPrefixes.push(...fromEnv);
  }

  try {
    const file = getBashApprovalFilePath();
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<BashApprovalConfig>;
    if (typeof parsed.yolo === "boolean") bashApprovalConfig.yolo = parsed.yolo;
    if (Array.isArray(parsed.allowPrefixes)) {
      bashApprovalConfig.allowPrefixes.push(
        ...parsed.allowPrefixes.map((s) => String(s)),
      );
    }
    if (parsed.allowOnce && typeof parsed.allowOnce === "object") {
      bashApprovalConfig.allowOnce = parsed.allowOnce as Record<string, number>;
    }
  } catch {
    // ignore
  }

  bashApprovalConfig.allowPrefixes = Array.from(
    new Set(bashApprovalConfig.allowPrefixes.map((s) => s.trim()).filter(Boolean)),
  );
}

async function saveBashApprovalConfig(): Promise<void> {
  try {
    const file = getBashApprovalFilePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(bashApprovalConfig), "utf-8");
  } catch {
    // ignore
  }
}

function normalizeBashCommand(command: string): string {
  return command.replace(/\s+/g, " ").trim();
}

function bashCommandKey(command: string, workdir: string): string {
  const normalizedCmd = normalizeBashCommand(command);
  return createHash("sha256")
    .update(`${workdir}::${normalizedCmd}`)
    .digest("hex")
    .slice(0, 24);
}

function prefixMatches(command: string, prefix: string): boolean {
  const cmd = normalizeBashCommand(command).toLowerCase();
  const p = normalizeBashCommand(prefix).toLowerCase();
  if (!p) return false;
  return cmd === p || cmd.startsWith(p + " ");
}

export async function setBashYoloMode(enabled: boolean): Promise<void> {
  await ensureBashApprovalLoaded();
  bashApprovalConfig.yolo = enabled;
  await saveBashApprovalConfig();
}

export async function addBashAllowPrefix(prefix: string): Promise<void> {
  await ensureBashApprovalLoaded();
  const p = normalizeBashCommand(prefix);
  if (!p) return;
  bashApprovalConfig.allowPrefixes = Array.from(
    new Set([...bashApprovalConfig.allowPrefixes, p]),
  );
  await saveBashApprovalConfig();
}

export async function removeBashAllowPrefix(prefix: string): Promise<void> {
  await ensureBashApprovalLoaded();
  const p = normalizeBashCommand(prefix);
  if (!p) return;
  bashApprovalConfig.allowPrefixes = bashApprovalConfig.allowPrefixes.filter(
    (x) => normalizeBashCommand(x).toLowerCase() !== p.toLowerCase(),
  );
  await saveBashApprovalConfig();
}

export async function approveBashCommandOnce(approvalId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  await ensureBashApprovalLoaded();
  const pending = pendingBashApprovals.get(approvalId);
  if (!pending) return { ok: false, reason: "Unknown approval id" };

  bashApprovalConfig.allowOnce[pending.key] = Date.now() + 10 * 60 * 1000;
  pendingBashApprovals.delete(approvalId);
  await saveBashApprovalConfig();
  return { ok: true };
}

export async function cancelBashApproval(
  approvalId: string,
  reason?: string,
): Promise<{ ok: boolean; reason?: string }> {
  await ensureBashApprovalLoaded();
  if (!pendingBashApprovals.has(approvalId)) {
    return { ok: false, reason: "Unknown approval id" };
  }
  pendingBashApprovals.delete(approvalId);
  bashApprovalDecisions.set(approvalId, {
    status: "cancelled",
    reason,
    at: Date.now(),
  });
  return { ok: true };
}

export async function getBashApprovalStatus(): Promise<{
  yolo: boolean;
  allowPrefixes: string[];
}> {
  await ensureBashApprovalLoaded();
  return {
    yolo: bashApprovalConfig.yolo,
    allowPrefixes: [...bashApprovalConfig.allowPrefixes],
  };
}

export function getPendingBashApprovals(): PendingBashApproval[] {
  return Array.from(pendingBashApprovals.values()).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

let currentTodos: TodoItem[] = [];
let todoUpdateCallback: ((todos: TodoItem[]) => void) | null = null;

export function setTodoUpdateCallback(
  cb: ((todos: TodoItem[]) => void) | null,
): void {
  todoUpdateCallback = cb;
}

export function getTodos(): TodoItem[] {
  return currentTodos;
}

// ============================================================================
// Exa API Helper
// ============================================================================

const EXA_API_BASE_URL = "https://api.exa.ai";

async function exaRequest(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<
  | { success: true; data: unknown }
  | { success: false; error: string; status?: number; data?: unknown }
> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "EXA_API_KEY is not set. Provide an Exa API key to use this tool.",
    };
  }

  const response = await fetch(`${EXA_API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      success: false,
      error:
        (data as any)?.error ?? (data as any)?.message ?? response.statusText,
      status: response.status,
      data,
    };
  }

  return { success: true, data };
}

// ============================================================================
// READ TOOL - Read file contents
// ============================================================================

export const readTool = tool({
  description: `Reads a file from the local filesystem. You can access any file directly by using this tool.

**CAPABILITIES:**
- Read any file by absolute path
- Reads up to 2000 lines by default (configurable with limit)
- Returns content with line numbers (cat -n format)
- Lines longer than 2000 chars are truncated
- Can read image files

**USAGE NOTES:**
- The filePath parameter MUST be an absolute path, not a relative path
- Use offset/limit for long files to read specific sections
- Call multiple reads in parallel when reading multiple files
- Always read a file BEFORE editing it (required)

**WHEN TO USE:**
- Reading specific file contents
- Examining code before making edits
- Reading configuration files
- Viewing log files or data files

**WHEN NOT TO USE:**
- Finding files by name (use Glob instead)
- Searching file contents (use Grep instead)
- Exploring directory structure (use List instead)`,
  inputSchema: z.object({
    filePath: z.string().describe("The absolute path to the file to read"),
    offset: z
      .number()
      .optional()
      .describe("The line number to start reading from (0-based)"),
    limit: z
      .number()
      .optional()
      .describe("The number of lines to read (defaults to 2000)"),
  }),
  execute: async function* ({
    filePath,
    offset = 0,
    limit = 2000,
  }: {
    filePath: string;
    offset?: number;
    limit?: number;
  }) {
    try {
      const resolvedPath = resolveWorkspacePath(filePath);
      const stats = await fs.stat(resolvedPath);

      yield {
        status: "loading" as const,
        message: `Reading file (${stats.size} bytes): ${resolvedPath}`,
      };

      const fullContent = await fs.readFile(resolvedPath, "utf-8");

      yield {
        status: "loading" as const,
        message: `Processing content: ${resolvedPath}`,
      };

      if (fullContent.length === 0) {
        yield `<system-reminder>File exists but is empty: ${resolvedPath}</system-reminder>`;
        return;
      }

      const allLines = fullContent.split("\n");
      const totalLines = allLines.length;

      // Apply offset and limit
      const selectedLines = allLines.slice(offset, offset + limit);
      const content = selectedLines
        .map((line, idx) => {
          const lineNum = offset + idx + 1;
          const truncatedLine =
            line.length > 2000 ? line.slice(0, 2000) + "..." : line;
          return `${String(lineNum).padStart(6)}\t${truncatedLine}`;
        })
        .join("\n");

      let result = content;

      if (offset + limit < totalLines) {
        result += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${offset + limit})`;
      }

      yield result;
    } catch (error) {
      yield `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ============================================================================
// WRITE TOOL - Write file contents
// ============================================================================

export const writeTool = tool({
  description: `Writes content to a file on the local filesystem.

**CAPABILITIES:**
- Creates new files or overwrites existing ones
- Automatically creates parent directories if they don't exist
- Returns diff statistics for existing files (+X -Y lines)

**CRITICAL RULES:**
- If the file EXISTS, you MUST use Read tool first. This tool will fail otherwise.
- ALWAYS prefer editing existing files (use Edit tool) over writing new ones
- NEVER proactively create documentation files (*.md, README) unless explicitly requested
- NEVER commit secrets or credentials to files

**WHEN TO USE:**
- Creating entirely new files
- Regenerating a file from scratch
- Writing files where Edit tool doesn't make sense

**WHEN NOT TO USE:**
- Making small changes to existing files (use Edit instead)
- Adding/modifying specific sections (use Edit instead)
- File hasn't been read yet (Read first!)`,
  inputSchema: z.object({
    filePath: z
      .string()
      .describe("The absolute path to the file to write (must be absolute)"),
    content: z.string().describe("The content to write to the file"),
  }),
  execute: async ({
    filePath,
    content,
  }: {
    filePath: string;
    content: string;
  }) => {
    try {
      const resolvedPath = resolveWorkspacePath(filePath);
      let previousContent: string | null = null;
      try {
        previousContent = await fs.readFile(resolvedPath, "utf-8");
      } catch {
        previousContent = null;
      }

      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, content, "utf-8");
      scheduleAutoIndex();

      const bytes = Buffer.byteLength(content, "utf-8");
      const lines = content.split("\n").length;
      const fileName = path.basename(resolvedPath);

      let linesAdded = 0;
      let linesRemoved = 0;
      const diffLines: string[] = [];
      const MAX_DIFF_LINES = 15;
      let truncated = false;

      let patch: string | undefined;
      let patchTruncated = false;
      const MAX_PATCH_LINES = 120;

      if (previousContent !== null && previousContent !== content) {
        const rawPatch = diff.createTwoFilesPatch(
          `a/${fileName}`,
          `b/${fileName}`,
          previousContent,
          content,
          "",
          "",
          { context: 3 },
        );
        const patchLines = String(rawPatch ?? "").replace(/\r\n/g, "\n").split("\n");

        // Compute stats from patch (count only real +/- lines, excluding headers)
        for (const line of patchLines) {
          if (line.startsWith("+++") || line.startsWith("---")) continue;
          if (line.startsWith("+")) linesAdded += 1;
          else if (line.startsWith("-")) linesRemoved += 1;
        }

        // Preview from patch in standard unified diff format
        const previewLines: string[] = [];
        for (const line of patchLines) {
          // Skip the first two header lines but keep hunks
          if (line.startsWith("---") || line.startsWith("+++")) continue;
          if (!line) continue;
          previewLines.push(line);
          if (previewLines.length >= MAX_DIFF_LINES) break;
        }
        diffLines.push(...previewLines);
        truncated = linesAdded + linesRemoved > MAX_DIFF_LINES;

        if (patchLines.length > MAX_PATCH_LINES) {
          patchTruncated = true;
          patch = patchLines.slice(0, MAX_PATCH_LINES).join("\n");
        } else {
          patch = patchLines.join("\n");
        }
      }

      return JSON.stringify({
        success: true,
        file: fileName,
        path: resolvedPath,
        lines,
        bytes,
        overwritten: previousContent !== null,
        linesAdded,
        linesRemoved,
        diff: diffLines,
        truncated,
        patch,
        patchTruncated,
      });
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ============================================================================
// EDIT TOOL - Surgical text replacement
// ============================================================================

export const editTool = tool({
  description: `Performs exact string replacements in files. The surgical tool for precise code modifications.

**CAPABILITIES:**
- Replace exact text matches in files
- Supports replaceAll for multiple occurrences
- Returns unified diff showing changes
- Preserves file encoding and line endings

**CRITICAL RULES:**
1. You MUST Read the file FIRST. This tool fails without a prior read.
2. oldString must match EXACTLY (including whitespace/indentation)
3. oldString must be UNIQUE in the file (or use replaceAll: true)
4. Line numbers from Read output have format: \`spaces + line_num + tab + content\`
   - Only include the content AFTER the tab, not the line number prefix
5. Preserve exact indentation from the file

**HANDLING FAILURES:**
- "oldString not found": The text doesn't exist exactly as specified. Re-read the file.
- "found multiple times": Include more surrounding context to make it unique.

**WHEN TO USE:**
- Making targeted changes to specific code sections
- Renaming variables/functions (with replaceAll: true)
- Fixing bugs in specific locations
- Adding/modifying imports, functions, or code blocks

**WHEN NOT TO USE:**
- Rewriting entire files (use Write instead)
- File hasn't been read yet (Read first!)
- Large-scale restructuring (consider multiple edits)`,
  inputSchema: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z
      .string()
      .describe(
        "The text to replace it with (must be different from oldString)",
      ),
    replaceAll: z
      .boolean()
      .optional()
      .describe("Replace all occurrences of oldString (default false)"),
  }),
  execute: async ({
    filePath,
    oldString,
    newString,
    replaceAll = false,
  }: {
    filePath: string;
    oldString: string;
    newString: string;
    replaceAll?: boolean;
  }) => {
    try {
      const resolvedPath = resolveWorkspacePath(filePath);
      const content = await fs.readFile(resolvedPath, "utf-8");

      if (!content.includes(oldString)) {
        return `Error: oldString not found in file content. Make sure you read the file first and the text matches exactly.`;
      }

      const occurrences = content.split(oldString).length - 1;

      if (occurrences > 1 && !replaceAll) {
        return `Error: oldString found ${occurrences} times. Provide more context to make it unique, or use replaceAll: true.`;
      }

      let newContent: string;
      if (replaceAll) {
        newContent = content.split(oldString).join(newString);
      } else {
        newContent = content.replace(oldString, newString);
      }

      await fs.writeFile(resolvedPath, newContent, "utf-8");
      scheduleAutoIndex();

      // Calculate actual diff with line-by-line changes
      let linesAdded = 0;
      let linesRemoved = 0;
      const diffLines: string[] = [];
      const MAX_DIFF_LINES = 15;

      const MAX_PATCH_LINES = 120;
      let patch: string | undefined;
      let patchTruncated = false;

      const replacedCount = replaceAll ? occurrences : 1;
      const fileName = path.basename(resolvedPath);

      const rawPatch = diff.createTwoFilesPatch(
        `a/${fileName}`,
        `b/${fileName}`,
        content,
        newContent,
        "",
        "",
        { context: 3 },
      );
      const patchLines = String(rawPatch ?? "").replace(/\r\n/g, "\n").split("\n");

      // Compute stats from patch (count only real +/- lines, excluding headers)
      for (const line of patchLines) {
        if (line.startsWith("+++") || line.startsWith("---")) continue;
        if (line.startsWith("+")) linesAdded += 1;
        else if (line.startsWith("-")) linesRemoved += 1;
      }

      // Preview from patch in standard unified diff format
      for (const line of patchLines) {
        if (line.startsWith("---") || line.startsWith("+++")) continue;
        if (!line) continue;
        diffLines.push(line);
        if (diffLines.length >= MAX_DIFF_LINES) break;
      }

      const truncated = linesAdded + linesRemoved > MAX_DIFF_LINES;
      if (patchLines.length > MAX_PATCH_LINES) {
        patchTruncated = true;
        patch = patchLines.slice(0, MAX_PATCH_LINES).join("\n");
      } else {
        patch = patchLines.join("\n");
      }

      return JSON.stringify({
        success: true,
        file: fileName,
        path: resolvedPath,
        linesAdded,
        linesRemoved,
        replacements: replacedCount,
        diff: diffLines,
        truncated,
        patch,
        patchTruncated,
      });
    } catch (error) {
      return `Error editing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ============================================================================
// GLOB TOOL - Fast file pattern matching
// ============================================================================

export const globTool = tool({
  description: `Fast file pattern matching tool that works with any codebase size.

- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When doing open-ended search that may require multiple rounds, use the Task tool instead`,
  inputSchema: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe(
        "The directory to search in. If not specified, uses current working directory.",
      ),
  }),
  execute: async ({
    pattern,
    path: basePath,
  }: {
    pattern: string;
    path?: string;
  }) => {
    const resolvedPath = resolveWorkspacePath(basePath || ".");
    const exclude = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
    ];

    try {
      const excludeArgs = exclude.map((e) => `-not -path '*/${e}/*'`).join(" ");
      const namePattern = pattern.includes("/")
        ? pattern.split("/").pop()!
        : pattern;

      // Use find with mtime sorting
      const cmd = `find ${JSON.stringify(resolvedPath)} -type f -name ${JSON.stringify(namePattern.replace(/\*\*/g, "*"))} ${excludeArgs} -printf '%T@ %p\\n' 2>/dev/null | sort -rn | cut -d' ' -f2- | head -n 500`;

      const { stdout } = await execAsync(cmd, {
        cwd: getWorkspaceRoot(),
        maxBuffer: 5 * 1024 * 1024,
      });

      const files = stdout.trim().split("\n").filter(Boolean);

      if (files.length === 0) {
        return "No files found matching pattern.";
      }

      return files.join("\n");
    } catch (error) {
      // Fallback without printf (macOS compatibility)
      try {
        const excludeArgs = exclude
          .map((e) => `-not -path '*/${e}/*'`)
          .join(" ");
        const namePattern = pattern.includes("/")
          ? pattern.split("/").pop()!
          : pattern;

        const cmd = `find ${JSON.stringify(resolvedPath)} -type f -name ${JSON.stringify(namePattern.replace(/\*\*/g, "*"))} ${excludeArgs} | head -n 500`;

        const { stdout } = await execAsync(cmd, { cwd: getWorkspaceRoot() });
        const files = stdout.trim().split("\n").filter(Boolean);

        if (files.length === 0) {
          return "No files found matching pattern.";
        }

        return files.join("\n");
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  },
});

// ============================================================================
// GREP TOOL - Fast content search
// ============================================================================

export const grepTool = tool({
  description: `Fast content search tool that works with any codebase size.

- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths and line numbers with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns
- If you need to count matches, use the Bash tool with rg directly`,
  inputSchema: z.object({
    pattern: z
      .string()
      .describe("The regex pattern to search for in file contents"),
    path: z
      .string()
      .optional()
      .describe(
        "The directory to search in. Defaults to current working directory.",
      ),
    include: z
      .string()
      .optional()
      .describe(
        'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
      ),
  }),
  execute: async ({
    pattern,
    path: searchPath,
    include,
  }: {
    pattern: string;
    path?: string;
    include?: string;
  }) => {
    const resolvedPath = resolveWorkspacePath(searchPath || ".");

    try {
      const useRg = await hasRipgrep();

      if (useRg) {
        const includeFlag = include ? `-g ${JSON.stringify(include)}` : "";
        const cmd = `rg -n -i --no-heading -M 200 ${includeFlag} ${JSON.stringify(pattern)} ${JSON.stringify(resolvedPath)} 2>/dev/null | head -n 100`;

        const { stdout } = await execAsync(cmd, {
          cwd: getWorkspaceRoot(),
          maxBuffer: 5 * 1024 * 1024,
        });

        if (!stdout.trim()) {
          return "No matches found.";
        }

        return stdout.trim();
      } else {
        const cmd = `grep -rn -i ${JSON.stringify(pattern)} ${JSON.stringify(resolvedPath)} 2>/dev/null | head -n 100`;
        const { stdout } = await execAsync(cmd, {
          cwd: getWorkspaceRoot(),
          maxBuffer: 5 * 1024 * 1024,
        });

        if (!stdout.trim()) {
          return "No matches found.";
        }

        return stdout.trim();
      }
    } catch (error: any) {
      if (error.code === 1) {
        return "No matches found.";
      }
      return `Error: ${error.message || String(error)}`;
    }
  },
});

// ============================================================================
// BASH TOOL - Execute shell commands
// ============================================================================

// Blocked commands - these are NEVER allowed
const BLOCKED_COMMANDS = [
  // Destructive system commands
  /\brm\s+(-[rf]+\s+)?[\/~]/i, // rm with absolute/home paths
  /\brm\s+-rf?\s+\.\s*$/i, // rm -rf .
  /\brm\s+-rf?\s+\*\s*$/i, // rm -rf *
  /\bmkfs\b/i,
  /\bdd\s+.*of=\/dev/i,
  /\b:?\(\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;?\s*:/i, // fork bomb
  /\bchmod\s+(-R\s+)?777\s+\//i, // chmod 777 on root
  /\bchown\s+(-R\s+)?.*\s+\//i, // chown on root

  // Dangerous git operations
  /\bgit\s+push\s+.*--force\s+(origin\s+)?(main|master)/i,
  /\bgit\s+push\s+-f\s+(origin\s+)?(main|master)/i,
  /\bgit\s+reset\s+--hard\s+HEAD~?\d*\s*$/i, // hard reset without explicit commit
  /\bgit\s+clean\s+-fd?x/i, // git clean with force
  /\bgit\s+config\s+--global/i, // modifying global git config

  // System/network dangerous
  /\bcurl\s+.*\|\s*(ba)?sh/i, // curl pipe to shell
  /\bwget\s+.*\|\s*(ba)?sh/i,
  /\bsudo\s+rm\b/i,
  /\bsudo\s+chmod\b/i,
  /\bsudo\s+chown\b/i,
  /\b>\s*\/etc\//i, // writing to /etc
  /\b>\s*\/usr\//i, // writing to /usr
  /\b>\s*\/var\//i, // writing to /var
  /\b>\s*\/bin\//i,
  /\b>\s*\/sbin\//i,

  // Credential/sensitive data exposure
  /\bcat\s+.*\.(env|pem|key|crt|p12|pfx)/i,
  /\bcat\s+.*\/\.ssh\//i,
  /\bcat\s+.*\/\.aws\//i,
  /\bcat\s+.*credentials/i,

  // Interactive commands (won't work anyway)
  /\bgit\s+(rebase|add|reset)\s+-i\b/i,
  /\bvim?\b/i,
  /\bnano\b/i,
  /\bemacs\b/i,
  /\bless\b/i,
  /\bmore\b/i,
  /\btop\b/i,
  /\bhtop\b/i,
];

// Warn but allow these commands
const WARN_COMMANDS = [
  {
    pattern: /\bgit\s+push\s+--force/i,
    message: "Force push detected - use with caution",
  },
  {
    pattern: /\bgit\s+reset\s+--hard/i,
    message: "Hard reset detected - this will lose uncommitted changes",
  },
  {
    pattern: /\brm\s+-rf?\b/i,
    message: "Recursive delete detected - verify the path",
  },
  { pattern: /\bnpm\s+publish/i, message: "Publishing to npm registry" },
  {
    pattern: /\bdocker\s+system\s+prune/i,
    message: "Docker prune will remove unused data",
  },
];

// Check if command is blocked
function checkCommand(command: string): {
  blocked: boolean;
  reason?: string;
  warning?: string;
} {
  const normalizedCmd = command.replace(/\s+/g, " ").trim();

  // Check blocked commands
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(normalizedCmd)) {
      return {
        blocked: true,
        reason: `Blocked: This command matches a dangerous pattern (${pattern.source.slice(0, 30)}...)`,
      };
    }
  }

  // Check warnings
  for (const { pattern, message } of WARN_COMMANDS) {
    if (pattern.test(normalizedCmd)) {
      return { blocked: false, warning: message };
    }
  }

  return { blocked: false };
}

// Check if workdir is within workspace
function isWithinWorkspace(workdir: string, workspace: string): boolean {
  const resolvedWorkdir = path.resolve(workdir);
  const resolvedWorkspace = path.resolve(workspace);
  return (
    resolvedWorkdir.startsWith(resolvedWorkspace) ||
    resolvedWorkdir === resolvedWorkspace
  );
}

export const bashTool = tool({
  description: `Executes a given bash command in a persistent shell session with optional timeout.

Usage notes:
- The command argument is required.
- You can specify an optional timeout in milliseconds (up to 600000ms / 10 minutes). Default is 120000ms (2 minutes).
- It is very helpful if you write a clear, concise description of what this command does.
- If the output exceeds 30000 characters, output will be truncated.
- You can use the run_in_background parameter to run long-running commands.
- Avoid using Bash for find, grep, cat, head, tail, sed, awk, echo. Use dedicated tools instead.
- When issuing multiple commands, use && to chain them or make parallel calls.
- Use the workdir parameter instead of cd commands.
- Commands must run within the workspace directory. Running outside is blocked.
- Certain dangerous commands (rm -rf /, force push to main, etc.) are blocked.

IMPORTANT: Only create commits when requested by the user. NEVER update git config. NEVER use --force on main/master.`,
  inputSchema: z.object({
    command: z.string().describe("The command to execute"),
    description: z
      .string()
      .optional()
      .describe(
        "Clear, concise description of what this command does in 5-10 words",
      ),
    timeout: z
      .number()
      .optional()
      .describe("Optional timeout in milliseconds (max 600000)"),
    workdir: z
      .string()
      .optional()
      .describe(
        "The working directory to run the command in (must be within workspace)",
      ),
    run_in_background: z
      .boolean()
      .optional()
      .describe("Run the command in the background"),
  }),
  execute: async function* ({
    command,
    description,
    timeout,
    workdir,
    run_in_background = false,
  }: {
    command: string;
    description?: string;
    timeout?: number;
    workdir?: string;
    run_in_background?: boolean;
  }) {
    const workspace = getWorkspaceRoot();
    const workingDir = workdir ? resolveWorkspacePath(workdir) : workspace;
    const timeoutMs = Math.min(timeout || 120000, 600000);

    await ensureBashApprovalLoaded();

    // Security check: Ensure workdir is within workspace
    if (!isWithinWorkspace(workingDir, workspace)) {
      yield `Error: Cannot run commands outside workspace.\nWorkspace: ${workspace}\nRequested: ${workingDir}\n\nUse the workdir parameter to specify a directory within the workspace.`;
      return;
    }

    // Security check: Block dangerous commands
    const { blocked, reason, warning } = checkCommand(command);
    if (blocked) {
      yield `Error: ${reason}\n\nThis command has been blocked for safety. If you believe this is a mistake, please run it manually in your terminal.`;
      return;
    }

    const key = bashCommandKey(command, workingDir);
    const cleanupAllowOnce = () => {
      const now = Date.now();
      for (const [k, expiresAt] of Object.entries(bashApprovalConfig.allowOnce)) {
        if (!expiresAt || expiresAt <= now) {
          delete bashApprovalConfig.allowOnce[k];
        }
      }
    };

    const isApprovedNow = () => {
      cleanupAllowOnce();
      const now = Date.now();
      const isAllowListed = bashApprovalConfig.allowPrefixes.some((p) =>
        prefixMatches(command, p),
      );
      const allowOnceExpiresAt = bashApprovalConfig.allowOnce[key];
      const isAllowOnce =
        typeof allowOnceExpiresAt === "number" && allowOnceExpiresAt > now;
      return {
        isAllowListed,
        isAllowOnce,
        isYolo: Boolean(bashApprovalConfig.yolo),
      };
    };

    let { isAllowListed, isAllowOnce, isYolo } = isApprovedNow();

    if (!isYolo && !isAllowListed && !isAllowOnce) {
      const normalizedCmd = normalizeBashCommand(command);
      const approvalId = `bash_${Date.now()}_${key}`;
      const reasonText =
        "This command is not on your allowlist. Bash commands can install dependencies, modify files, or run scripts.";

      pendingBashApprovals.set(approvalId, {
        id: approvalId,
        key,
        command: normalizedCmd,
        workdir: workingDir,
        createdAt: Date.now(),
        reason: reasonText,
      });

      yield [
        "Error: Bash command requires approval.",
        `Reason: ${reasonText}`,
        `Command: ${normalizedCmd}`,
        `Workdir: ${workingDir}`,
        `Approval ID: ${approvalId}`,
        "",
        "Waiting for your approval in the UI...",
        "",
        `To allow ONCE: /bash allow-once ${approvalId}`,
        `To allow by prefix (persistent): /bash allow \"<prefix>\"  (e.g. /bash allow \"npx\")`,
        "To enable YOLO mode: /bash yolo on",
      ].join("\n");

      const waitStart = Date.now();
      const MAX_WAIT_MS = 10 * 60 * 1000;
      while (true) {
        await new Promise((r) => setTimeout(r, 100));

        ({ isAllowListed, isAllowOnce, isYolo } = isApprovedNow());
        if (isYolo || isAllowListed || isAllowOnce) {
          pendingBashApprovals.delete(approvalId);
          bashApprovalDecisions.delete(approvalId);
          break;
        }

        const decision = bashApprovalDecisions.get(approvalId);
        if (decision?.status === "cancelled") {
          bashApprovalDecisions.delete(approvalId);
          yield `Cancelled: Bash command not approved${decision.reason ? ` (${decision.reason})` : ""}.`;
          return;
        }

        if (Date.now() - waitStart > MAX_WAIT_MS) {
          pendingBashApprovals.delete(approvalId);
          bashApprovalDecisions.delete(approvalId);
          yield "Error: Bash approval timed out.";
          return;
        }

        if (!pendingBashApprovals.has(approvalId)) {
          // Approval cleared without an allowlist update.
          yield "Cancelled: Bash approval is no longer pending.";
          return;
        }
      }
    }

    // Consume allow-once entry once used.
    if (isAllowOnce) {
      delete bashApprovalConfig.allowOnce[key];
      await saveBashApprovalConfig();
    }

    // Show warning if applicable
    if (warning) {
      yield `⚠️ Warning: ${warning}\n`;
    }

    // Background execution
    if (run_in_background) {
      const id = `bg_${++processCounter}`;

      const child = spawn(command, [], {
        shell: true,
        cwd: workingDir,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });

      const bgProcess: BackgroundProcess = {
        id,
        command,
        process: child,
        startedAt: Date.now(),
        output: [],
        status: "running",
      };

      child.stdout?.on("data", (data) => {
        bgProcess.output.push(...data.toString().split("\n").filter(Boolean));
        if (bgProcess.output.length > 1000) {
          bgProcess.output = bgProcess.output.slice(-500);
        }
      });

      child.stderr?.on("data", (data) => {
        bgProcess.output.push(...data.toString().split("\n").filter(Boolean));
        if (bgProcess.output.length > 1000) {
          bgProcess.output = bgProcess.output.slice(-500);
        }
      });

      child.on("close", (code) => {
        bgProcess.status = code === 0 ? "completed" : "failed";
        bgProcess.exitCode = code ?? undefined;
      });

      backgroundProcesses.set(id, bgProcess);

      yield `Started background process: ${id}\nCommand: ${command.slice(0, 100)}${command.length > 100 ? "..." : ""}\nUse bash tool with 'bg_status' or 'bg_output ${id}' to check progress.`;
      return;
    }

    // Streaming execution
    yield `$ ${command.slice(0, 80)}${command.length > 80 ? "..." : ""}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;

      // Truncate if too long
      if (output.length > 30000) {
        output = output.slice(0, 30000) + "\n... (output truncated)";
      }

      yield output || "(no output)";
    } catch (error: any) {
      let output = "";
      if (error.stdout) output += error.stdout;
      if (error.stderr) output += (output ? "\n" : "") + error.stderr;

      if (output.length > 30000) {
        output = output.slice(0, 30000) + "\n... (output truncated)";
      }

      yield `Exit code: ${error.code ?? 1}\n${output || error.message || String(error)}`;
    }
  },
});

// ============================================================================
// LIST TOOL - List directory contents
// ============================================================================

export const listTool = tool({
  description: `Lists files and directories in a specified path. Returns a tree-like structure showing the hierarchy.

Use this to explore unfamiliar codebases or check folder contents.`,
  inputSchema: z.object({
    path: z.string().describe("The path to the directory to list"),
    depth: z
      .number()
      .optional()
      .describe("Maximum depth to traverse (default: 2)"),
  }),
  execute: async ({
    path: dirPath,
    depth = 2,
  }: {
    path: string;
    depth?: number;
  }) => {
    const resolvedPath = resolveWorkspacePath(dirPath);
    const output: string[] = [];
    const maxDepth = Math.min(depth, 5);

    async function walk(dir: string, prefix: string, currentDepth: number) {
      if (currentDepth > maxDepth) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const sorted = entries
          .filter((e) => !e.name.startsWith("."))
          .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });

        for (let i = 0; i < sorted.length; i++) {
          const entry = sorted[i]!;
          const isLast = i === sorted.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const childPrefix = isLast ? "    " : "│   ";

          if (entry.isDirectory()) {
            output.push(`${prefix}${connector}${entry.name}/`);
            await walk(
              path.join(dir, entry.name),
              prefix + childPrefix,
              currentDepth + 1,
            );
          } else {
            output.push(`${prefix}${connector}${entry.name}`);
          }
        }
      } catch (error) {
        output.push(`${prefix}(error reading directory)`);
      }
    }

    output.push(resolvedPath);
    await walk(resolvedPath, "", 1);

    return output.join("\n");
  },
});

// ============================================================================
// TASK TOOL - Delegate to subagent
// ============================================================================

let subagentExecutor:
  | ((prompt: string, type: string) => Promise<string>)
  | null = null;

export function setSubagentExecutor(
  executor: ((prompt: string, type: string) => Promise<string>) | null,
): void {
  subagentExecutor = executor;
}

export const taskTool = tool({
  description: `Delegate a complex task to a specialized subagent.

**AVAILABLE AGENTS:**

| Agent | Use For |
|-------|---------|
| **explore** | Understand the codebase quickly (use semantic_search when indexed). |
| **research** | External docs/APIs (use Exa / web sources). |
| **general** | Multi-step execution that needs several tools. |

**WHEN TO USE:**
- Open-ended exploration (“where/how is X implemented?”)
- Multi-iteration searching / triangulation
- Research that benefits from web sources
- Large tasks you can split off to another agent

**WHEN NOT TO USE:**
- Reading a specific known file path (use Read directly)
- Searching for exact class/function name (use Grep/Glob directly)
- Simple single-step operations
- Tasks requiring user interaction

**BEST PRACTICES:**
- Be specific about the deliverable (files, symbols, expected output).
- Ask for evidence (paths + snippets).
- Run multiple agents in parallel for independent questions.`,
  inputSchema: z.object({
    description: z
      .string()
      .describe("A short (3-5 words) description of the task"),
    prompt: z.string().describe("The detailed task for the agent to perform"),
    subagent_type: z
      .enum(["general", "explore", "research"])
      .describe("The type of specialized agent to use"),
  }),
  execute: async ({
    description,
    prompt,
    subagent_type,
  }: {
    description: string;
    prompt: string;
    subagent_type: "general" | "explore" | "research";
  }) => {
    if (!subagentExecutor) {
      return "Error: Subagent executor not configured.";
    }

    try {
      const result = await subagentExecutor(prompt, subagent_type);
      return result;
    } catch (error) {
      return `Error executing subagent: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ============================================================================
// TODOWRITE TOOL - Manage task list
// ============================================================================

export const todoWriteTool = tool({
  description: `Manage a structured todo list for the current coding session.

Use this when:
- The task is multi-step (3+ steps) or spans multiple files
- You need to track progress explicitly
- You just got new requirements that should be captured

Rules:
- Keep **at most one** todo \`in_progress\` at a time.
- Mark todos \`completed\` immediately after finishing.
- Keep todo content specific and actionable.`,
  inputSchema: z.object({
    todos: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for the todo item"),
          content: z.string().describe("Brief description of the task"),
          status: z
            .enum(["pending", "in_progress", "completed", "cancelled"])
            .describe("Current status of the task"),
          priority: z
            .enum(["high", "medium", "low"])
            .describe("Priority level of the task"),
        }),
      )
      .describe("The updated todo list"),
  }),
  execute: async ({ todos }: { todos: TodoItem[] }) => {
    currentTodos = todos;
    if (todoUpdateCallback) todoUpdateCallback(currentTodos);

    const summary = {
      total: todos.length,
      pending: todos.filter((t) => t.status === "pending").length,
      inProgress: todos.filter((t) => t.status === "in_progress").length,
      completed: todos.filter((t) => t.status === "completed").length,
    };

    const text = todos
      .map((t) => {
        const icon =
          t.status === "completed"
            ? "[x]"
            : t.status === "in_progress"
              ? "[>]"
              : t.status === "cancelled"
                ? "[-]"
                : "[ ]";
        return `${icon} ${t.id}: ${t.content} (${t.priority || "medium"})`;
      })
      .join("\n");

    return {
      success: true,
      summary,
      todos,
      text,
      message: `Todo list updated: ${summary.pending} pending, ${summary.inProgress} in progress, ${summary.completed} completed`,
    };
  },
});

// ============================================================================
// TODOREAD TOOL - Read current todos
// ============================================================================

export const todoReadTool = tool({
  description: "Use this tool to read your current todo list",
  inputSchema: z.object({}),
  execute: async () => {
    const todos = currentTodos;
    const text =
      todos.length === 0
        ? "No todos in list."
        : todos
            .map((t) => {
              const icon =
                t.status === "completed"
                  ? "[x]"
                  : t.status === "in_progress"
                    ? "[>]"
                    : t.status === "cancelled"
                      ? "[-]"
                      : "[ ]";
              return `${icon} ${t.id}: ${t.content} (${t.priority || "medium"})`;
            })
            .join("\n");

    return {
      success: true,
      todos,
      text,
      message: todos.length === 0 ? "No todos in list." : `Loaded ${todos.length} todos`,
    };
  },
});

// ============================================================================
// QUESTION TOOL - Ask user for input/decisions
// ============================================================================

export const questionTool = tool({
  description: `Ask the user questions during execution to gather preferences, clarify instructions, or get decisions.

**WHEN TO USE:**
- Gathering user preferences or requirements
- Clarifying ambiguous instructions
- Getting decisions on implementation choices
- Offering the user choices about what direction to take
- When multiple valid approaches exist and user input would help

**WHEN NOT TO USE:**
- When you can make a reasonable assumption
- For trivial decisions that don't impact the outcome
- When the user has already provided clear direction

**BEHAVIOR:**
- Users can always select "Other" to provide custom text input
- Answers are returned as arrays of selected option labels
- Set multiple: true to allow selecting more than one option
- If you recommend a specific option, make it first and add "(Recommended)" to the label

**EXAMPLE USAGE:**
\`\`\`json
{
  "questions": [{
    "question": "Which testing framework would you like to use for this project?",
    "header": "Test Framework",
    "options": [
      {"label": "Jest (Recommended)", "description": "Fast, widely used, great for React"},
      {"label": "Vitest", "description": "Vite-native, very fast, ESM-first"},
      {"label": "Mocha + Chai", "description": "Flexible, mature, many plugins"}
    ],
    "multiple": false
  }]
}
\`\`\``,
  inputSchema: z.object({
    questions: z.array(
      z.object({
        question: z.string().describe("Complete question to ask the user"),
        header: z
          .string()
          .describe("Very short label for the question (max 12 chars)"),
        options: z
          .array(
            z.object({
              label: z
                .string()
                .describe("Display text for the option (1-5 words, concise)"),
              description: z
                .string()
                .optional()
                .describe("Brief explanation of the choice"),
            }),
          )
          .describe("Available choices for the user"),
        multiple: z
          .boolean()
          .optional()
          .describe("Allow selecting multiple choices (default: false)"),
      }),
    ).describe("Questions to ask the user"),
  }),
  execute: async function* ({
    questions,
  }: {
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description?: string }>;
      multiple?: boolean;
    }>;
  }) {
    if (!questions || questions.length === 0) {
      yield "No questions provided.";
      return;
    }

    const results: Array<{
      question: string;
      answers: string[];
      customText?: string;
    }> = [];

    for (const q of questions) {
      const questionId = `question_${++questionCounter}_${Date.now()}`;

      // Register the pending question
      const questionRequest: QuestionRequest = {
        id: questionId,
        question: q.question,
        header: q.header.slice(0, 12),
        options: q.options.map((opt) => ({
          label: opt.label,
          description: opt.description,
        })),
        multiple: q.multiple ?? false,
        createdAt: Date.now(),
      };

      pendingQuestions.set(questionId, questionRequest);

      // Yield the question for the UI to display
      yield {
        status: "waiting_for_input" as const,
        questionId,
        question: q.question,
        header: q.header.slice(0, 12),
        options: q.options,
        multiple: q.multiple ?? false,
        message: `Waiting for user response: ${q.question}`,
      };

      // Wait for response (with timeout)
      const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes
      const waitStart = Date.now();

      while (true) {
        await new Promise((r) => setTimeout(r, 100));

        const response = questionResponses.get(questionId);
        if (response) {
          results.push({
            question: q.question,
            answers: response.answers,
            customText: response.customText,
          });
          questionResponses.delete(questionId);
          break;
        }

        // Check if question was cancelled
        if (!pendingQuestions.has(questionId) && !questionResponses.has(questionId)) {
          results.push({
            question: q.question,
            answers: [],
            customText: "Question cancelled",
          });
          break;
        }

        if (Date.now() - waitStart > MAX_WAIT_MS) {
          pendingQuestions.delete(questionId);
          results.push({
            question: q.question,
            answers: [],
            customText: "Question timed out",
          });
          break;
        }
      }
    }

    // Format the results
    if (results.length === 1) {
      const r = results[0]!;
      if (r.customText && r.answers.length === 0) {
        yield `User response: ${r.customText}`;
      } else if (r.answers.length === 0) {
        yield "No response received.";
      } else {
        yield `User selected: ${r.answers.join(", ")}${r.customText ? ` (${r.customText})` : ""}`;
      }
    } else {
      const formatted = results.map((r, i) => {
        const answer =
          r.answers.length > 0
            ? r.answers.join(", ")
            : r.customText || "No response";
        return `${i + 1}. ${r.question}\n   Answer: ${answer}`;
      });
      yield `User responses:\n\n${formatted.join("\n\n")}`;
    }
  },
});

// ============================================================================
// WEBFETCH TOOL - Fetch web content
// ============================================================================

export const webFetchTool = tool({
  description: `Fetches content from a specified URL.

- Takes a URL and optional format as input
- Fetches the URL content, converts to requested format (markdown by default)
- Returns the content in the specified format
- Use this tool when you need to retrieve and analyze web content

Usage notes:
- The URL must be a fully-formed valid URL
- HTTP URLs will be automatically upgraded to HTTPS
- Format options: "markdown" (default), "text", or "html"`,
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .optional()
      .describe("The format to return the content in (default: markdown)"),
  }),
  execute: async ({
    url,
    format = "markdown",
  }: {
    url: string;
    format?: "text" | "markdown" | "html";
  }) => {
    try {
      // Upgrade HTTP to HTTPS
      const secureUrl = url.replace(/^http:\/\//i, "https://");

      const response = await fetch(secureUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CodingCLI/1.0)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      if (format === "html" || contentType.includes("text/html")) {
        // Simple HTML to text conversion
        const cleaned = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Truncate if too long
        if (cleaned.length > 50000) {
          return cleaned.slice(0, 50000) + "\n... (content truncated)";
        }

        return cleaned;
      }

      if (text.length > 50000) {
        return text.slice(0, 50000) + "\n... (content truncated)";
      }

      return text;
    } catch (error) {
      return `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ============================================================================
// EXA SEARCH TOOLS
// ============================================================================

export const exaWebSearchTool = tool({
  description: `Search the web using Exa AI - performs real-time web searches.

Supports configurable result counts and returns content from the most relevant websites.
REQUIRES: EXA_API_KEY environment variable.`,
  inputSchema: z.object({
    query: z.string().describe("Websearch query"),
    numResults: z
      .number()
      .optional()
      .describe("Number of search results to return (default: 8)"),
  }),
  execute: async ({
    query,
    numResults = 8,
  }: {
    query: string;
    numResults?: number;
  }) => {
    const result = await exaRequest("/search", {
      query,
      numResults,
      type: "auto",
      useAutoprompt: true,
      contents: { text: { maxCharacters: 2000 } },
    });

    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data as any;
    if (!data.results || data.results.length === 0) {
      return "No results found.";
    }

    return data.results
      .map(
        (r: any, i: number) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${(r.text || "").slice(0, 200)}...`,
      )
      .join("\n\n");
  },
});

export const exaCodeSearchTool = tool({
  description: `Search for code context using Exa AI.

Use for finding API usage examples, library documentation, implementation patterns.
RULE: when the query is related to code, use this tool.
REQUIRES: EXA_API_KEY environment variable.`,
  inputSchema: z.object({
    query: z.string().describe("Search query for APIs, Libraries, and SDKs"),
  }),
  execute: async ({ query }: { query: string }) => {
    const result = await exaRequest("/search", {
      query: `${query} code example tutorial documentation`,
      numResults: 5,
      type: "auto",
      useAutoprompt: true,
      contents: { text: { maxCharacters: 3000 } },
    });

    if (!result.success) {
      return `Error: ${result.error}`;
    }

    const data = result.data as any;
    if (!data.results || data.results.length === 0) {
      return "No code context found.";
    }

    return data.results
      .map((r: any) => `## ${r.title}\n${r.url}\n\n${r.text || ""}`)
      .join("\n\n---\n\n");
  },
});

// ============================================================================
// SEMANTIC SEARCH TOOL - AI-powered code search using LanceDB index
// ============================================================================

// Cache for index availability check
let indexAvailabilityCache: {
  available: boolean;
  stats: IndexStats | null;
  checkedAt: number;
} | null = null;

const INDEX_CHECK_INTERVAL = 60000; // 1 minute

async function checkIndexAvailable(): Promise<{
  available: boolean;
  stats: IndexStats | null;
}> {
  const now = Date.now();
  if (
    indexAvailabilityCache &&
    now - indexAvailabilityCache.checkedAt < INDEX_CHECK_INTERVAL
  ) {
    return {
      available: indexAvailabilityCache.available,
      stats: indexAvailabilityCache.stats,
    };
  }

  try {
    const projectPath = getWorkspaceRoot();
    const exists = await hasIndex(projectPath);

    if (!exists) {
      indexAvailabilityCache = { available: false, stats: null, checkedAt: now };
      return { available: false, stats: null };
    }

    const stats = await getIndexStats(projectPath);
    const available = stats.exists && stats.totalChunks > 0;

    indexAvailabilityCache = { available, stats, checkedAt: now };
    return { available, stats };
  } catch {
    indexAvailabilityCache = { available: false, stats: null, checkedAt: now };
    return { available: false, stats: null };
  }
}

export function invalidateIndexCache(): void {
  indexAvailabilityCache = null;
}

// ============================================================================
// AUTO-INDEX - Keep index up to date after file edits
// ============================================================================

const AUTO_INDEX_DEBOUNCE_MS = 1500;
let autoIndexTimer: NodeJS.Timeout | null = null;
let autoIndexInFlight: Promise<void> | null = null;
let autoIndexRequested = false;
let autoIndexWaiters: Array<() => void> = [];

function notifyAutoIndexWaiters(): void {
  const waiters = autoIndexWaiters;
  autoIndexWaiters = [];
  for (const w of waiters) w();
}

export async function awaitAutoIndexIdle(): Promise<void> {
  if (!autoIndexTimer && !autoIndexInFlight) return;
  await new Promise<void>((resolve) => autoIndexWaiters.push(resolve));
}

async function runAutoIndexOnce(): Promise<void> {
  const projectPath = getWorkspaceRoot();

  // Only auto-index if an index already exists (keeps this from surprising users)
  const exists = await hasIndex(projectPath);
  if (!exists) return;

  const voyageApiKey = await getApiKeyAsync("voyage");
  if (!voyageApiKey) return;

  // Respect per-project preferences if present
  const cfg = await loadProjectConfig(projectPath);
  const voyageModel = cfg.voyageModel;
  const excludePatterns = cfg.excludePatterns ?? [];

  const indexer = new CodebaseIndexer({
    projectPath,
    voyageApiKey,
    ...(voyageModel ? { voyageModel } : {}),
    ...(excludePatterns.length ? { excludePatterns } : {}),
  });

  await indexer.index();
  invalidateIndexCache();
}

function scheduleAutoIndex(): void {
  autoIndexRequested = true;
  invalidateIndexCache();

  if (autoIndexTimer) clearTimeout(autoIndexTimer);

  autoIndexTimer = setTimeout(() => {
    autoIndexTimer = null;
    if (autoIndexInFlight) return;

    autoIndexInFlight = (async () => {
      try {
        while (autoIndexRequested) {
          autoIndexRequested = false;
          await runAutoIndexOnce();
        }
      } catch {
        // Best-effort: never break the agent workflow
      } finally {
        autoIndexInFlight = null;
        notifyAutoIndexWaiters();
      }
    })();
  }, AUTO_INDEX_DEBOUNCE_MS);
}

export async function isSemanticSearchAvailable(): Promise<boolean> {
  const { available } = await checkIndexAvailable();
  return available;
}

export const semanticSearchTool = tool({
  description: `Semantic code search over the indexed codebase (meaning-based, not exact text).

**WHEN TO USE:**
- “Where/how is X implemented?”
- Pattern discovery / architecture questions
- Finding related code without knowing exact symbols

**WHEN NOT TO USE:**
- Exact text search (use Grep instead)
- Finding files by name (use Glob instead)
- Reading specific files (use Read instead)

**REQUIRES:** Codebase must be indexed.

Returns ranked code chunks with file paths and line ranges.`,
  inputSchema: z.object({
    query: z.string().describe("Natural language description of what you're looking for"),
    limit: z
      .number()
      .optional()
      .describe("Maximum results to return (default: 10, max: 25)"),
    language: z
      .string()
      .optional()
      .describe("Filter by programming language (e.g., 'typescript', 'python')"),
    chunkType: z
      .enum(["function", "class", "method", "interface", "type", "module", "file"])
      .optional()
      .describe("Filter by code structure type"),
    minScore: z
      .number()
      .optional()
      .describe("Minimum similarity score 0-1 (default: 0.3)"),
  }),
  execute: async function* ({
    query,
    limit = 10,
    language,
    chunkType,
    minScore = 0.3,
  }: {
    query: string;
    limit?: number;
    language?: string;
    chunkType?: "function" | "class" | "method" | "interface" | "type" | "module" | "file";
    minScore?: number;
  }) {
    const projectPath = getWorkspaceRoot();
    const voyageApiKey = await getApiKeyAsync("voyage");

    // If an auto-index is scheduled or running, wait so results are fresh.
    await awaitAutoIndexIdle();

    // Check if semantic search is available
    const { available, stats } = await checkIndexAvailable();

    if (!available) {
      yield `Semantic search not available. Codebase is not indexed.

To enable semantic search:
1. Save a Voyage API key in Erzencode (provider: voyage)
2. Run: erzencode index

This will create AI embeddings for your code, enabling powerful semantic search.`;
      return;
    }

    if (!voyageApiKey) {
      yield `Semantic search requires a Voyage API key.

The codebase is indexed (${stats?.totalChunks ?? 0} chunks), but search requires an API key.
Save a Voyage API key (provider: voyage) to enable semantic search.`;
      return;
    }

    yield {
      status: "loading" as const,
      message: `Searching ${stats?.totalChunks ?? 0} code chunks for: "${query.slice(0, 50)}${query.length > 50 ? "..." : ""}"`,
    };

    try {
      const searchOptions: SearchOptions = {
        limit: Math.min(limit, 25),
        minScore,
      };

      if (language) {
        searchOptions.language = language as any;
      }

      if (chunkType) {
        searchOptions.chunkType = chunkType;
      }

      const results = await searchCodebase(projectPath, query, voyageApiKey, searchOptions);

      if (results.length === 0) {
        yield `No results found for: "${query}"

Try:
- Rephrasing your query
- Lowering minScore (currently ${minScore})
- Removing language/type filters
- Using more general terms`;
        return;
      }

      // Format results
      const formattedResults = results.map((r, i) => {
        const { chunk, score } = r;
        const header = `## Result ${i + 1}: ${chunk.symbol_name || chunk.chunk_type} (${(score * 100).toFixed(1)}% match)`;
        const location = `📍 \`${chunk.file_path}:${chunk.start_line}-${chunk.end_line}\``;
        const meta = `📦 ${chunk.language} ${chunk.chunk_type}`;
        const code = "```" + chunk.language + "\n" + chunk.code.slice(0, 1500) + (chunk.code.length > 1500 ? "\n// ... (truncated)" : "") + "\n```";

        return `${header}\n${location} | ${meta}\n\n${code}`;
      });

      const summary = `Found ${results.length} result${results.length !== 1 ? "s" : ""} for "${query}" (searched ${stats?.totalChunks ?? 0} chunks)`;

      yield `# Semantic Search Results

${summary}

---

${formattedResults.join("\n\n---\n\n")}`;
    } catch (error) {
      yield `Error during semantic search: ${error instanceof Error ? error.message : String(error)}

This might be due to:
- Invalid API key
- Network issues
- Corrupted index (try: erzencode index --force)`;
    }
  },
});

// ============================================================================
// INDEX STATUS TOOL - Check codebase index status
// ============================================================================

export const indexStatusTool = tool({
  description: `Check the status of the codebase semantic index.

Returns information about:
- Whether the codebase is indexed
- Number of files and code chunks
- Last update time
- Index size

Use this to determine if semantic search is available.`,
  inputSchema: z.object({}),
  execute: async () => {
    const projectPath = getWorkspaceRoot();
    const voyageKeySet = !!(await getApiKeyAsync("voyage"));

    await awaitAutoIndexIdle();

    try {
      const exists = await hasIndex(projectPath);

      if (!exists) {
        return {
          indexed: false,
          message: "Codebase is not indexed. Run 'erzencode index' to enable semantic search.",
          voyageKeySet,
        };
      }

      const stats = await getIndexStats(projectPath);

      const lastUpdated = stats.lastUpdated
        ? new Date(stats.lastUpdated).toLocaleString()
        : "Unknown";

      const sizeFormatted = stats.sizeBytes
        ? stats.sizeBytes > 1024 * 1024
          ? `${(stats.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(stats.sizeBytes / 1024).toFixed(2)} KB`
        : "Unknown";

      return {
        indexed: true,
        totalFiles: stats.totalFiles,
        totalChunks: stats.totalChunks,
        voyageModel: stats.voyageModel || "voyage-code-3",
        lastUpdated,
        size: sizeFormatted,
        voyageKeySet,
        message: `Codebase indexed: ${stats.totalFiles} files, ${stats.totalChunks} searchable chunks`,
      };
    } catch (error) {
      return {
        indexed: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Error checking index status",
      };
    }
  },
});

// ============================================================================
// Get All Tools
// ============================================================================

export function getAllTools(): Record<string, Tool<any, any>> {
  return {
    read: readTool,
    write: writeTool,
    edit: editTool,
    glob: globTool,
    grep: grepTool,
    bash: bashTool,
    list: listTool,
    task: taskTool,
    todowrite: todoWriteTool,
    todoread: todoReadTool,
    question: questionTool,
    webfetch: webFetchTool,
    exa_web_search: exaWebSearchTool,
    exa_code_search: exaCodeSearchTool,
    semantic_search: semanticSearchTool,
    index_status: indexStatusTool,
  };
}

// Legacy exports for backwards compatibility
export const readFileTool = readTool;
export const writeFileTool = writeTool;
export const editFileTool = editTool;
export const executeCommandTool = bashTool;
export const searchFilesTool = grepTool;
export const fileTreeTool = listTool;
export const todoTool = todoWriteTool;

// Subagent tool registration (for backwards compatibility)
let subagentToolDefinition: Tool<any, any> | null = null;

export function setSubagentTool(subagentTool: Tool<any, any>): void {
  subagentToolDefinition = subagentTool;
}

export function getSubagentTool(): Tool<any, any> | null {
  return subagentToolDefinition;
}
