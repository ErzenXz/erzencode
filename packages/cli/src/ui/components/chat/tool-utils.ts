/**
 * Tool display utilities and configuration.
 * Claude Code style - tool name with (input) format.
 */

import type { ToolPart } from "../../types.js";

/**
 * Tool display configuration with semantic colors.
 * Colors chosen to work well in both light and dark terminals.
 */
export const TOOL_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  read: { label: "Read", icon: "●", color: "info" },
  read_file: { label: "Read", icon: "●", color: "info" },

  write: { label: "Write", icon: "●", color: "success" },
  write_file: { label: "Write", icon: "●", color: "success" },

  edit: { label: "Edit", icon: "●", color: "warning" },
  edit_file: { label: "Edit", icon: "●", color: "warning" },

  glob: { label: "Search", icon: "●", color: "secondary" },
  grep: { label: "Search", icon: "●", color: "secondary" },

  list: { label: "List", icon: "●", color: "info" },
  list_directory: { label: "List", icon: "●", color: "info" },
  file_tree: { label: "Tree", icon: "●", color: "info" },

  bash: { label: "Run", icon: "●", color: "warning" },
  execute_command: { label: "Run", icon: "●", color: "warning" },

  task: { label: "Subagent", icon: "●", color: "info" },

  todowrite: { label: "Todo", icon: "●", color: "success" },
  todoread: { label: "Todo", icon: "●", color: "info" },
  todo: { label: "Todo", icon: "●", color: "success" },

  webfetch: { label: "Fetch", icon: "●", color: "info" },
  exa_web_search: { label: "Search", icon: "●", color: "secondary" },
  exa_code_search: { label: "Code", icon: "●", color: "secondary" },
  
  semantic_search: { label: "Search", icon: "●", color: "secondary" },
  index_status: { label: "Index", icon: "●", color: "info" },
};

export const MAX_OUTPUT_LINES = 6;
export const MAX_DIFF_LINES = 8;

/**
 * Make path relative to workspace.
 */
export function relativePath(filePath: string, workspaceRoot?: string): string {
  if (!filePath) return "";
  if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
    const rel = filePath.slice(workspaceRoot.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

/**
 * Truncate string.
 */
export function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/**
 * Format tool input as function-call style: ToolName(key: "value", key: "value")
 * This matches Claude Code's display style.
 */
export function formatToolInputAsCall(
  name: string,
  args: Record<string, unknown> | undefined,
  workspaceRoot?: string,
): string {
  if (!args) return "";

  switch (name) {
    case "read":
    case "read_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      if (!path) return "";
      const startLine = args.start_line || args.offset;
      const endLine = args.end_line;
      if (startLine && endLine) {
        return `${path}:${startLine}-${endLine}`;
      } else if (startLine) {
        return `${path}:${startLine}+`;
      }
      return path;
    }

    case "write":
    case "write_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      return path;
    }

    case "edit":
    case "edit_file": {
      const path = relativePath(String(args.filePath || args.path || ""), workspaceRoot);
      return path;
    }

    case "bash":
    case "execute_command": {
      const cmd = String(args.command || "");
      // Truncate long commands
      return truncate(cmd, 60);
    }

    case "grep": {
      const pattern = String(args.pattern || args.query || "");
      const pathArg = args.path ? relativePath(String(args.path), workspaceRoot) : "";
      const parts: string[] = [];
      if (pattern) parts.push(`pattern: "${truncate(pattern, 30)}"`);
      if (pathArg && pathArg !== ".") parts.push(`path: "${pathArg}"`);
      return parts.join(", ");
    }

    case "glob": {
      const pattern = String(args.pattern || args.filePattern || "");
      const pathArg = args.path ? relativePath(String(args.path), workspaceRoot) : "";
      if (pathArg && pathArg !== ".") {
        return `pattern: "${pattern}", path: "${pathArg}"`;
      }
      return `pattern: "${pattern}"`;
    }

    case "list":
    case "list_directory":
    case "file_tree": {
      const path = relativePath(String(args.path || "."), workspaceRoot);
      const depth = args.depth ? `, depth: ${args.depth}` : "";
      return `path: "${path}"${depth}`;
    }

    case "task": {
      const desc = String(args.description || "");
      const type = args.subagent_type ? String(args.subagent_type) : "";
      if (type && desc) return `type: "${type}", task: "${truncate(desc, 35)}"`;
      if (desc) return `task: "${truncate(desc, 45)}"`;
      return "";
    }

    case "todowrite":
    case "todo": {
      const todos = args.todos as Array<{ content: string }> | undefined;
      if (!todos) return "";
      return `${todos.length} items`;
    }

    case "webfetch": {
      const url = String(args.url || "");
      try {
        const hostname = new URL(url).hostname;
        return `url: "${hostname}"`;
      } catch {
        return `url: "${truncate(url, 40)}"`;
      }
    }

    case "exa_web_search":
    case "exa_code_search":
    case "semantic_search": {
      const query = String(args.query || "");
      return `query: "${truncate(query, 40)}"`;
    }

    default:
      // Generic: show first few args
      const entries = Object.entries(args).slice(0, 2);
      if (entries.length === 0) return "";
      return entries.map(([k, v]) => {
        const val = typeof v === "string" ? v : JSON.stringify(v);
        return `${k}: "${truncate(val, 25)}"`;
      }).join(", ");
  }
}

/**
 * Format tool input summary (single line) - for backward compatibility.
 * Now calls formatToolInputAsCall.
 */
export function formatToolInputSummary(
  name: string,
  args: Record<string, unknown> | undefined,
  workspaceRoot?: string,
): string {
  return formatToolInputAsCall(name, args, workspaceRoot);
}

/**
 * Format tool output result summary (for the detail line).
 * Returns a single-line summary like "Read 152 lines" or "Found 100 files".
 */
export function formatToolResultSummary(
  name: string,
  output: string | undefined,
  _workspaceRoot?: string,
): { summary: string; isError: boolean; isExpandable: boolean } {
  if (!output) return { summary: "", isError: false, isExpandable: false };

  const isError = output.startsWith("Error:") || output.includes('"success":false');

  // Try to parse JSON
  let parsed: Record<string, unknown> | null = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch { /* not JSON */ }
  }

  if (parsed) {
    if (parsed.success === false) {
      const errorMsg = String(parsed.error || parsed.message || "Failed");
      return { summary: truncate(errorMsg, 50), isError: true, isExpandable: false };
    }

    switch (name) {
      case "read":
      case "read_file": {
        const totalLines = parsed.totalLines || parsed.lines;
        if (totalLines) {
          return { summary: `Read ${totalLines} lines`, isError: false, isExpandable: true };
        }
        const content = parsed.content || parsed.text;
        if (content && typeof content === "string") {
          const lineCount = content.split("\n").length;
          return { summary: `Read ${lineCount} lines`, isError: false, isExpandable: true };
        }
        return { summary: "Read file", isError: false, isExpandable: true };
      }

      case "write":
      case "write_file": {
        const linesWritten = parsed.lines || parsed.linesWritten;
        if (linesWritten) {
          return { summary: `Wrote ${linesWritten} lines`, isError: false, isExpandable: false };
        }
        return { summary: "File written", isError: false, isExpandable: false };
      }

      case "edit":
      case "edit_file": {
        const stats: string[] = [];
        if (typeof parsed.linesAdded === "number" && parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (typeof parsed.linesRemoved === "number" && parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        const summary = stats.length > 0 ? `Applied ${stats.join(" ")}` : "Edit applied";
        return { summary, isError: false, isExpandable: parsed.patch || parsed.diff ? true : false };
      }

      case "bash":
      case "execute_command": {
        const exitCode = (parsed.exit_code ?? parsed.exitCode) as number | undefined;
        if (parsed.status === "background") {
          const pid = parsed.process_id || parsed.pid;
          return { summary: pid ? `Background pid:${pid}` : "Running in background", isError: false, isExpandable: false };
        }
        const stdout = String(parsed.stdout || "").trim();
        const stderr = String(parsed.stderr || "").trim();
        const hasError = exitCode !== 0 && exitCode !== undefined;
        
        if (hasError) {
          return { summary: `Exit ${exitCode}`, isError: true, isExpandable: true };
        }
        
        const outputText = stdout || stderr;
        const lineCount = outputText ? outputText.split("\n").length : 0;
        if (lineCount > 0) {
          return { summary: `Done (${lineCount} lines)`, isError: false, isExpandable: true };
        }
        return { summary: "Done", isError: false, isExpandable: false };
      }

      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const count = parsed.matches.length;
          const files = [...new Set(parsed.matches.map((m: any) => m.file || m.path))];
          return { summary: `Found ${count} matches across ${files.length} files`, isError: false, isExpandable: true };
        }
        return { summary: "No matches", isError: false, isExpandable: false };
      }

      case "glob": {
        if (Array.isArray(parsed.files)) {
          return { summary: `Found ${parsed.files.length} files`, isError: false, isExpandable: true };
        }
        return { summary: "Search complete", isError: false, isExpandable: false };
      }

      case "list":
      case "list_directory":
      case "file_tree": {
        const entries = parsed.entries || parsed.files || parsed.items;
        if (Array.isArray(entries)) {
          return { summary: `${entries.length} items`, isError: false, isExpandable: true };
        }
        return { summary: "Listed", isError: false, isExpandable: false };
      }

      case "task": {
        const tools = parsed.tools as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(tools) && tools.length > 0) {
          return { summary: `Done (${tools.length} tool calls)`, isError: false, isExpandable: true };
        }
        return { summary: "Done", isError: false, isExpandable: false };
      }

      case "todowrite":
      case "todoread":
      case "todo": {
        const todos = parsed.todos as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(todos)) {
          return { summary: `${todos.length} todos`, isError: false, isExpandable: true };
        }
        return { summary: "Updated", isError: false, isExpandable: false };
      }

      case "webfetch": {
        const content = parsed.content || parsed.text || parsed.body;
        if (content && typeof content === "string") {
          const lines = content.split("\n").length;
          return { summary: `Fetched ${lines} lines`, isError: false, isExpandable: true };
        }
        return { summary: "Fetched", isError: false, isExpandable: false };
      }

      case "exa_web_search":
      case "exa_code_search":
      case "semantic_search": {
        const results = parsed.results || parsed.items || parsed.matches;
        if (Array.isArray(results)) {
          return { summary: `${results.length} results`, isError: false, isExpandable: true };
        }
        return { summary: "Search complete", isError: false, isExpandable: false };
      }

      default:
        if (parsed.message) {
          return { summary: truncate(String(parsed.message), 50), isError: false, isExpandable: false };
        }
    }
  }

  // Plain text output
  const lineCount = output.split("\n").filter(Boolean).length;
  if (name === "read" || name === "read_file") {
    return { summary: `Read ${lineCount} lines`, isError, isExpandable: true };
  }
  return { summary: lineCount > 0 ? `${lineCount} lines` : "Done", isError, isExpandable: lineCount > 3 };
}

/**
 * Format tool output (returns lines) - full output for expanded view.
 * Optimized to show concise summaries instead of raw content.
 */
export function formatToolOutput(
  name: string,
  output: string | undefined,
  _workspaceRoot?: string,
): { outputLines: string[]; isOutputError: boolean; markdown?: string; stats?: string; children?: ToolPart[] } {
  if (!output) return { outputLines: [], isOutputError: false };

  const isOutputError =
    output.startsWith("Error:") || output.includes('"success":false');

  // Try to parse JSON
  let parsed: Record<string, unknown> | null = null;
  if (output.startsWith("{") || output.startsWith("[")) {
    try {
      parsed = JSON.parse(output);
    } catch {
      /* not JSON */
    }
  }

  if (parsed) {
    if (parsed.success === false) {
      const errorMsg = String(parsed.error || parsed.message || "Failed");
      return { outputLines: [truncate(errorMsg, 60)], isOutputError: true };
    }

    switch (name) {
      case "todowrite":
      case "todoread":
      case "todo": {
        const todos = (parsed.todos as Array<Record<string, unknown>> | undefined) ?? undefined;
        if (!Array.isArray(todos)) {
          const msg = (parsed.message ?? parsed.text) as unknown;
          if (typeof msg === "string" && msg.trim()) {
            return { outputLines: [truncate(msg, 65)], isOutputError: false };
          }
          return { outputLines: [], isOutputError: false };
        }

        const counts = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };

        const lines = todos.map((t) => {
          const id = String(t.id ?? "");
          const content = String(t.content ?? "");
          const status = String(t.status ?? "pending");
          const priority = String(t.priority ?? "medium");
          if (status in counts) (counts as any)[status] += 1;

          const icon =
            status === "completed" ? "[x]"
            : status === "in_progress" ? "[>]"
            : status === "cancelled" ? "[-]"
            : "[ ]";

          const label = id ? `${id}: ${content}` : content;
          return `${icon} ${label} (${priority})`;
        });

        const limited = lines.slice(0, MAX_OUTPUT_LINES).map((l) => truncate(l, 72));
        if (lines.length > MAX_OUTPUT_LINES) {
          limited.push(`... ${lines.length - MAX_OUTPUT_LINES} more items`);
        }

        const stats = `${counts.pending} pending, ${counts.in_progress} in progress, ${counts.completed} completed`;
        return { outputLines: limited, isOutputError: false, stats };
      }

      case "read":
      case "read_file": {
        const totalLines = parsed.totalLines || parsed.lines;
        if (totalLines) {
          const showing = parsed.showing as { from: number; to: number } | undefined;
          let stats = `${totalLines} lines`;
          if (showing) stats += ` (${showing.from}-${showing.to})`;
          return { outputLines: [], isOutputError: false, stats };
        }
        const content = parsed.content || parsed.text;
        if (content && typeof content === "string") {
          const lineCount = content.split("\n").length;
          return { outputLines: [], isOutputError: false, stats: `${lineCount} lines` };
        }
        return { outputLines: [], isOutputError: false, stats: "read" };
      }

      case "edit":
      case "edit_file": {
        const stats: string[] = [];
        if (typeof parsed.linesAdded === "number" && parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (typeof parsed.linesRemoved === "number" && parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        return {
          outputLines: [],
          isOutputError: false,
          stats: stats.join(" ") || "applied",
        };
      }

      case "write":
      case "write_file": {
        const linesWritten = parsed.lines || parsed.linesWritten;
        const stats: string[] = [];
        if (typeof parsed.linesAdded === "number" && parsed.linesAdded > 0) stats.push(`+${parsed.linesAdded}`);
        if (typeof parsed.linesRemoved === "number" && parsed.linesRemoved > 0) stats.push(`-${parsed.linesRemoved}`);
        return {
          outputLines: [],
          isOutputError: false,
          stats: linesWritten ? `${linesWritten} lines${stats.length ? ` (${stats.join(" ")})` : ""}` : stats.join(" ") || "written",
        };
      }

      case "bash":
      case "execute_command": {
        const exitCode = (parsed.exit_code ?? parsed.exitCode) as number | undefined;
        
        if (parsed.status === "background") {
          const pid = parsed.process_id || parsed.pid;
          return { outputLines: [], isOutputError: false, stats: pid ? `bg pid:${pid}` : "background" };
        }
        
        const stdout = String(parsed.stdout || "").trim();
        const stderr = String(parsed.stderr || "").trim();
        const hasError = exitCode !== 0 && exitCode !== undefined;
        
        const outputText = hasError && stderr ? stderr : stdout;
        const outputLines = outputText.split("\n").filter(Boolean);
        const limited = outputLines.slice(0, MAX_OUTPUT_LINES).map((l) => truncate(l, 65));
        
        if (outputLines.length > MAX_OUTPUT_LINES) {
          limited.push(`... ${outputLines.length - MAX_OUTPUT_LINES} more lines`);
        }
        
        const stats = hasError ? `exit ${exitCode}` : outputLines.length > 0 ? undefined : "done";
        
        return {
          outputLines: limited,
          isOutputError: hasError,
          stats,
        };
      }

      case "grep": {
        if (Array.isArray(parsed.matches)) {
          const count = parsed.matches.length;
          const files = [...new Set(parsed.matches.map((m: Record<string, unknown>) => m.file || m.path))];
          return { outputLines: [], isOutputError: false, stats: `${count} in ${files.length} files` };
        }
        return { outputLines: [], isOutputError: false, stats: "no matches" };
      }

      case "glob": {
        if (Array.isArray(parsed.files)) {
          return { outputLines: [], isOutputError: false, stats: `${parsed.files.length} files` };
        }
        return { outputLines: [], isOutputError: false };
      }

      case "list":
      case "list_directory":
      case "file_tree": {
        const entries = parsed.entries || parsed.files || parsed.items;
        if (Array.isArray(entries)) {
          const dirs = entries.filter((e: any) => e.type === "directory" || e.isDirectory);
          const files = entries.filter((e: any) => e.type !== "directory" && !e.isDirectory);
          
          const outputLines: string[] = [];
          const maxItems = 6;
          let shown = 0;
          
          for (const d of dirs) {
            if (shown >= maxItems) break;
            const name = d.name || d.path || String(d);
            outputLines.push(`📁 ${name}/`);
            shown++;
          }
          
          for (const f of files) {
            if (shown >= maxItems) break;
            const name = f.name || f.path || String(f);
            outputLines.push(`   ${name}`);
            shown++;
          }
          
          const remaining = entries.length - shown;
          if (remaining > 0) {
            outputLines.push(`   ... ${remaining} more`);
          }
          
          const stats = `${files.length} files, ${dirs.length} dirs`;
          return { outputLines, isOutputError: false, stats };
        }
        return { outputLines: [], isOutputError: false };
      }

      case "task": {
        const result = parsed.result || parsed.output;
        const tools = parsed.tools as Array<{
          id?: string;
          name: string;
          args?: Record<string, unknown>;
          output?: string;
          status: "done" | "error";
        }> | undefined;
        
        const children: ToolPart[] = Array.isArray(tools)
          ? tools.map((t) => ({
              type: "tool" as const,
              id: t.id,
              name: t.name,
              args: t.args,
              output: t.output,
              status: t.status === "error" ? "error" as const : "done" as const,
            }))
          : [];
        
        const stats = children.length > 0 
          ? `${children.length} tool${children.length === 1 ? "" : "s"}`
          : "done";
        
        return { 
          outputLines: result && typeof result === "string" ? [truncate(result, 60)] : [], 
          isOutputError: false, 
          stats,
          children: children.length > 0 ? children : undefined,
        };
      }

      case "webfetch": {
        const content = parsed.content || parsed.text || parsed.body;
        if (content && typeof content === "string") {
          const lines = content.split("\n").length;
          const chars = content.length;
          return { outputLines: [], isOutputError: false, stats: `${lines} lines, ${chars} chars` };
        }
        return { outputLines: [], isOutputError: false, stats: "fetched" };
      }

      case "exa_web_search":
      case "exa_code_search":
      case "semantic_search": {
        const results = parsed.results || parsed.items || parsed.matches;
        if (Array.isArray(results)) {
          return { outputLines: [], isOutputError: false, stats: `${results.length} results` };
        }
        return { outputLines: [], isOutputError: false };
      }

      default: {
        if (parsed.message) {
          return { outputLines: [truncate(String(parsed.message), 60)], isOutputError: false };
        }
      }
    }
  }

  // Plain text output
  const textLines = output.split("\n").filter(Boolean);
  if (textLines.length === 0) return { outputLines: [], isOutputError };
  
  if (name === "read" || name === "read_file") {
    const contentLines = textLines.filter(l => !l.match(/^\s*\d+\s*\t/)).length || textLines.length;
    return { outputLines: [], isOutputError: false, stats: `${contentLines} lines` };
  }
  
  const limited = textLines.slice(0, MAX_OUTPUT_LINES).map((l) => truncate(l, 65));
  if (textLines.length > MAX_OUTPUT_LINES) {
    limited.push(`... ${textLines.length - MAX_OUTPUT_LINES} more lines`);
  }
  return { outputLines: limited, isOutputError };
}
