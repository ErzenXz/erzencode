export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + "...";
}

export function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

export function wrapText(input: string, width: number): string[] {
  const w = Math.max(10, width);
  const lines: string[] = [];

  for (const rawLine of (input ?? "").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      lines.push("");
      continue;
    }

    const words = line.split(/\s+/g);
    let current = "";

    for (const word of words) {
      if (!word) continue;

      if (!current) {
        if (word.length <= w) {
          current = word;
        } else {
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
        }
        continue;
      }

      if ((current.length + 1 + word.length) <= w) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = "";
        if (word.length <= w) {
          current = word;
        } else {
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
        }
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

type AnsiState = {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  fg: string | null;
  bg: string | null;
};

function ansiStateToPrefix(s: AnsiState): string {
  const parts: string[] = [];
  if (s.bold) parts.push("1");
  if (s.dim) parts.push("2");
  if (s.italic) parts.push("3");
  if (s.underline) parts.push("4");
  if (s.inverse) parts.push("7");
  if (s.fg) parts.push(s.fg);
  if (s.bg) parts.push(s.bg);
  if (parts.length === 0) return "";
  return `\u001b[${parts.join(";")}m`;
}

function applySgrParams(state: AnsiState, params: number[]): void {
  if (params.length === 0) params = [0];

  for (let i = 0; i < params.length; i++) {
    const p = params[i] ?? 0;
    if (p === 0) {
      state.bold = false;
      state.dim = false;
      state.italic = false;
      state.underline = false;
      state.inverse = false;
      state.fg = null;
      state.bg = null;
      continue;
    }
    if (p === 1) { state.bold = true; continue; }
    if (p === 2) { state.dim = true; continue; }
    if (p === 22) { state.bold = false; state.dim = false; continue; }
    if (p === 3) { state.italic = true; continue; }
    if (p === 23) { state.italic = false; continue; }
    if (p === 4) { state.underline = true; continue; }
    if (p === 24) { state.underline = false; continue; }
    if (p === 7) { state.inverse = true; continue; }
    if (p === 27) { state.inverse = false; continue; }
    if (p === 39) { state.fg = null; continue; }
    if (p === 49) { state.bg = null; continue; }

    // Basic foreground/background
    if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) { state.fg = String(p); continue; }
    if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) { state.bg = String(p); continue; }

    // 256-color/truecolor
    if (p === 38 || p === 48) {
      const isFg = p === 38;
      const mode = params[i + 1];
      if (mode === 5) {
        const n = params[i + 2];
        if (typeof n === "number") {
          const code = `${p};5;${n}`;
          if (isFg) state.fg = code;
          else state.bg = code;
        }
        i += 2;
        continue;
      }
      if (mode === 2) {
        const r = params[i + 2];
        const g = params[i + 3];
        const b = params[i + 4];
        if (
          typeof r === "number" &&
          typeof g === "number" &&
          typeof b === "number"
        ) {
          const code = `${p};2;${r};${g};${b}`;
          if (isFg) state.fg = code;
          else state.bg = code;
        }
        i += 4;
        continue;
      }
    }
  }
}

/**
 * Wrap a string that may contain ANSI SGR sequences.
 * Keeps SGR state across wrapped lines and appends a reset at line end.
 */
export function wrapAnsiText(input: string, width: number): string[] {
  const w = Math.max(10, width);
  const out: string[] = [];
  const state: AnsiState = {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
    fg: null,
    bg: null,
  };

  const chunks = (input ?? "").split("\n");
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci] ?? "";
    let line = ansiStateToPrefix(state);
    let visible = 0;

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i] ?? "";
      if (ch === "\u001b" && chunk[i + 1] === "[") {
        const m = /\u001b\[([0-9;]*)m/y;
        m.lastIndex = i;
        const mm = m.exec(chunk);
        if (mm) {
          line += mm[0];
          const rawParams = (mm[1] ?? "").trim();
          const params =
            rawParams.length === 0
              ? []
              : rawParams.split(";").map((p) => Number(p));
          applySgrParams(state, params);
          i = m.lastIndex - 1;
          continue;
        }
      }

      if (visible >= w) {
        out.push(line + "\u001b[0m");
        line = ansiStateToPrefix(state);
        visible = 0;
      }

      line += ch;
      visible += 1;
    }

    out.push(line + "\u001b[0m");
    if (ci < chunks.length - 1) {
      // Preserve state across explicit newlines.
      out.push(ansiStateToPrefix(state) + "\u001b[0m");
    }
  }

  return out;
}

export function getToolDisplayName(toolName: string, args?: Record<string, unknown>): { name: string; detail?: string } {
  if (!args) return { name: toolName };
  
  if (toolName === "read_file") {
    const path = (args.path || args.file_path || "") as string;
    const fileName = path.split("/").pop() || path;
    return { name: "Read", detail: fileName };
  }
  if (toolName === "write_file") {
    const path = (args.path || args.file_path || "") as string;
    const fileName = path.split("/").pop() || path;
    return { name: "Write", detail: fileName };
  }
  if (toolName === "edit_file") {
    const path = (args.path || args.file_path || "") as string;
    const fileName = path.split("/").pop() || path;
    return { name: "Edit", detail: fileName };
  }
  if (toolName === "read_files") {
    const paths = (args.paths || []) as string[];
    return { name: "Read", detail: `${paths.length} files` };
  }
  if (toolName === "file_tree") {
    return { name: "File tree", detail: (args.path || ".") as string };
  }
  if (toolName === "execute_command") {
    return { name: "Execute", detail: truncate((args.command || "") as string, 30) };
  }
  if (toolName === "grep" || toolName === "search_files") {
    return { name: "Search", detail: `"${truncate((args.pattern || args.query || "") as string, 20)}"` };
  }
  
  return { name: toolName };
}

export function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return path.slice(0, maxLen - 3) + "...";
  return `.../${parts.slice(-2).join("/")}`;
}
