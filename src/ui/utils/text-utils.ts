/**
 * Text manipulation utilities for the Terminal UI.
 * All functions are pure and have no side effects.
 */

/**
 * Truncates a string to the specified length, adding ellipsis if needed.
 * @param str - The string to truncate
 * @param len - Maximum length including ellipsis
 * @returns The truncated string
 * @example
 * truncate("Hello World", 8) // "Hello..."
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + "...";
}

/**
 * Truncates a file path intelligently, preserving the end of the path.
 * @param path - The path to truncate
 * @param maxLen - Maximum length
 * @returns The truncated path
 * @example
 * truncatePath("/very/long/path/to/file.ts", 20) // ".../path/to/file.ts"
 */
export function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return path.slice(0, maxLen - 3) + "...";
  return `.../${parts.slice(-2).join("/")}`;
}

/**
 * Strips ANSI escape codes from a string.
 * @param input - String potentially containing ANSI codes
 * @returns Clean string without ANSI codes
 * @example
 * stripAnsi("\x1b[31mRed\x1b[0m") // "Red"
 */
export function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Wraps plain text to fit within a specified width.
 * Handles word boundaries and long words.
 * @param input - The text to wrap
 * @param width - Maximum line width (minimum 10)
 * @returns Array of wrapped lines
 * @example
 * wrapText("Hello World", 6) // ["Hello", "World"]
 */
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
          // Word is longer than width, break it up
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
        }
        continue;
      }

      if (current.length + 1 + word.length <= w) {
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

/**
 * Internal state for ANSI SGR (Select Graphic Rendition) tracking.
 */
interface AnsiState {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  fg: string | null;
  bg: string | null;
}

/**
 * Converts ANSI state to an escape sequence prefix.
 */
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

/**
 * Applies SGR parameters to the ANSI state.
 */
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

    // Basic foreground/background colors
    if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) { state.fg = String(p); continue; }
    if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) { state.bg = String(p); continue; }

    // 256-color and truecolor support
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
 * Wraps text containing ANSI escape sequences to fit within a specified width.
 * Preserves ANSI styling across line breaks.
 * @param input - Text with ANSI codes to wrap
 * @param width - Maximum line width (minimum 10)
 * @returns Array of wrapped lines with preserved ANSI styling
 * @example
 * wrapAnsiText("\x1b[31mHello World\x1b[0m", 6) // ["\x1b[31mHello\x1b[0m", "\x1b[31mWorld\x1b[0m"]
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
      // Preserve state across explicit newlines
      out.push(ansiStateToPrefix(state) + "\u001b[0m");
    }
  }

  return out;
}
