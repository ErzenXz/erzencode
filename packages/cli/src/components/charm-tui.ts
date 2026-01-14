/**
 * Charm TUI - Beautiful terminal styling utilities
 * Cross-platform beautiful terminal output inspired by charm.land
 * Uses chalk, boxen, cli-table3, and gradient-string for compatibility
 */

import chalk from "chalk";
import boxen from "boxen";
import Table from "cli-table3";
import gradient from "gradient-string";

// Theme colors (Tokyo Night inspired)
export const theme = {
  // Primary colors
  primary: "#7aa2f7",
  secondary: "#9ece6a",
  accent: "#bb9af7",
  
  // Status colors
  success: "#73daca",
  warning: "#e0af68",
  error: "#f7768e",
  info: "#7dcfff",
  
  // Neutral colors
  text: "#c0caf5",
  textMuted: "#565f89",
  background: "#1a1b26",
  backgroundLight: "#24283b",
  border: "#414868",
  borderLight: "#565f89",
  
  // Accent palette
  cyan: "#7dcfff",
  magenta: "#bb9af7",
  yellow: "#e0af68",
  green: "#9ece6a",
  red: "#f7768e",
  blue: "#7aa2f7",
  orange: "#ff9e64",
  pink: "#ff007c",
} as const;

// Custom gradients - typed as functions that take string and return string
type GradientFn = (text: string) => string;

export const gradients: Record<string, GradientFn> = {
  primary: gradient(["#7aa2f7", "#bb9af7"]),
  success: gradient(["#73daca", "#9ece6a"]),
  warning: gradient(["#e0af68", "#ff9e64"]),
  error: gradient(["#f7768e", "#ff007c"]),
  rainbow: gradient.rainbow,
  cristal: gradient.cristal,
  teen: gradient.teen,
  mind: gradient.mind,
  morning: gradient.morning,
  vice: gradient.vice,
  passion: gradient.passion,
  fruit: gradient.fruit,
  instagram: gradient.instagram,
  atlas: gradient.atlas,
  retro: gradient.retro,
  summer: gradient.summer,
  pastel: gradient.pastel,
};

let initialized = false;

/**
 * Initialize Charm TUI (no-op for cross-platform, kept for API compatibility)
 */
export async function initCharm(): Promise<void> {
  initialized = true;
}

/**
 * Check if initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

// ============================================================================
// Styling Utilities
// ============================================================================

/**
 * Colorize text with hex color
 */
export function colored(text: string, color: string): string {
  return chalk.hex(color)(text);
}

/**
 * Make text bold
 */
export function bold(text: string, color?: string): string {
  if (color) {
    return chalk.hex(color).bold(text);
  }
  return chalk.bold(text);
}

/**
 * Make text italic
 */
export function italic(text: string, color?: string): string {
  if (color) {
    return chalk.hex(color).italic(text);
  }
  return chalk.italic(text);
}

/**
 * Dim text (subtle/muted)
 */
export function dim(text: string): string {
  return chalk.hex(theme.textMuted)(text);
}

/**
 * Underline text
 */
export function underline(text: string, color?: string): string {
  if (color) {
    return chalk.hex(color).underline(text);
  }
  return chalk.underline(text);
}

/**
 * Strikethrough text
 */
export function strikethrough(text: string): string {
  return chalk.strikethrough(text);
}

/**
 * Apply gradient to text
 */
export function gradientText(
  text: string,
  gradientName: keyof typeof gradients = "primary"
): string {
  return gradients[gradientName](text);
}

// ============================================================================
// Box Utilities
// ============================================================================

export interface BoxOptions {
  title?: string;
  borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic" | "arrow" | "none";
  borderColor?: string;
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  width?: number;
  textAlignment?: "left" | "center" | "right";
  titleAlignment?: "left" | "center" | "right";
  backgroundColor?: string;
  dimBorder?: boolean;
}

/**
 * Create a beautiful bordered box
 */
export function box(content: string, options: BoxOptions = {}): string {
  return boxen(content, {
    title: options.title,
    titleAlignment: options.titleAlignment ?? "left",
    borderStyle: options.borderStyle ?? "round",
    borderColor: options.borderColor ?? theme.border,
    padding: options.padding ?? 1,
    margin: options.margin,
    width: options.width,
    textAlignment: options.textAlignment ?? "left",
    backgroundColor: options.backgroundColor,
    dimBorder: options.dimBorder,
  });
}

/**
 * Create a header box
 */
export function header(title: string, subtitle?: string): string {
  const titleText = bold(title, theme.primary);
  const content = subtitle 
    ? `${titleText}\n${dim(subtitle)}`
    : titleText;
  
  return box(content, {
    borderStyle: "double",
    borderColor: theme.primary,
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
  });
}

/**
 * Create an alert box
 */
export function alert(
  message: string,
  type: "info" | "success" | "warning" | "error" = "info"
): string {
  const icons: Record<string, string> = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✗",
  };
  
  const colors: Record<string, string> = {
    info: theme.info,
    success: theme.success,
    warning: theme.warning,
    error: theme.error,
  };
  
  const icon = icons[type];
  const content = colored(`${icon} ${message}`, colors[type]);
  
  return box(content, {
    borderStyle: "round",
    borderColor: colors[type],
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
  });
}

/**
 * Create a code block
 */
export function codeBlock(code: string, language?: string): string {
  const header = language ? dim(`  ${language}\n`) : "";
  const codeStyled = colored(code, theme.cyan);
  
  return header + box(codeStyled, {
    borderStyle: "round",
    borderColor: theme.borderLight,
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
  });
}

// ============================================================================
// Table Utilities
// ============================================================================

export interface TableOptions {
  borderColor?: string;
  headerColor?: string;
  style?: "default" | "compact" | "void" | "borderless";
}

/**
 * Create a beautiful table
 */
export function table(
  headers: string[],
  rows: string[][],
  options: TableOptions = {}
): string {
  const borderColor = options.borderColor ?? theme.border;
  const headerColor = options.headerColor ?? theme.primary;
  
  const chars = options.style === "compact" ? {
    top: "", "top-mid": "", "top-left": "", "top-right": "",
    bottom: "", "bottom-mid": "", "bottom-left": "", "bottom-right": "",
    left: "", "left-mid": "", mid: "", "mid-mid": "",
    right: "", "right-mid": "", middle: " ",
  } : options.style === "borderless" ? {
    top: "", "top-mid": "", "top-left": "", "top-right": "",
    bottom: "", "bottom-mid": "", "bottom-left": "", "bottom-right": "",
    left: "", "left-mid": "", mid: "─", "mid-mid": "─",
    right: "", "right-mid": "", middle: " │ ",
  } : undefined;

  const t = new Table({
    head: headers.map(h => chalk.hex(headerColor).bold(h)),
    chars,
    style: {
      head: [],
      border: [borderColor],
    },
  });
  
  rows.forEach(row => t.push(row));
  
  return t.toString();
}

/**
 * Create a key-value table
 */
export function kvTable(
  data: Record<string, string>,
  options: TableOptions = {}
): string {
  const rows = Object.entries(data).map(([key, value]) => [
    dim(key),
    value,
  ]);
  return table(["Property", "Value"], rows, options);
}

// ============================================================================
// List Utilities
// ============================================================================

export interface ListOptions {
  style?: "bullet" | "dash" | "arrow" | "star" | "check" | "numbered";
  color?: string;
  indent?: number;
}

/**
 * Create a styled list
 */
export function list(items: string[], options: ListOptions = {}): string {
  const bullets: Record<string, string> = {
    bullet: "•",
    dash: "─",
    arrow: "→",
    star: "★",
    check: "✓",
    numbered: "",
  };
  
  const style = options.style ?? "bullet";
  const bullet = bullets[style];
  const color = options.color ?? theme.primary;
  const indent = " ".repeat(options.indent ?? 0);
  
  return items.map((item, i) => {
    const marker = style === "numbered" 
      ? colored(`${i + 1}.`, color)
      : colored(bullet, color);
    return `${indent}${marker} ${item}`;
  }).join("\n");
}

/**
 * Create a task list with status indicators
 */
export interface TaskItem {
  text: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export function taskList(tasks: TaskItem[]): string {
  const statusIcons: Record<string, string> = {
    pending: "○",
    in_progress: "◐",
    completed: "✓",
    failed: "✗",
  };
  
  const statusColors: Record<string, string> = {
    pending: theme.textMuted,
    in_progress: theme.yellow,
    completed: theme.success,
    failed: theme.error,
  };
  
  return tasks.map((task) => {
    const icon = colored(statusIcons[task.status], statusColors[task.status]);
    const text = task.status === "completed" 
      ? dim(task.text)
      : task.status === "in_progress"
        ? bold(task.text)
        : task.text;
    return `${icon} ${text}`;
  }).join("\n");
}

// ============================================================================
// Status & Progress
// ============================================================================

/**
 * Create a status badge
 */
export function statusBadge(
  status: "running" | "success" | "error" | "pending" | "info",
  label?: string
): string {
  const icons: Record<string, string> = {
    running: "●",
    success: "✓",
    error: "✗",
    pending: "○",
    info: "ℹ",
  };
  
  const colors: Record<string, string> = {
    running: theme.yellow,
    success: theme.success,
    error: theme.error,
    pending: theme.textMuted,
    info: theme.info,
  };
  
  const text = label ? `${icons[status]} ${label}` : icons[status];
  return colored(text, colors[status]);
}

/**
 * Create a progress bar
 */
export function progressBar(
  current: number,
  total: number,
  width: number = 20
): string {
  const percentage = Math.min(Math.max(current / total, 0), 1);
  const filled = Math.round(width * percentage);
  const empty = width - filled;
  
  const filledChar = colored("█".repeat(filled), theme.primary);
  const emptyChar = colored("░".repeat(empty), theme.textMuted);
  const percentText = dim(`${Math.round(percentage * 100)}%`);
  
  return `${filledChar}${emptyChar} ${percentText}`;
}

/**
 * Create a spinner frame (for animation)
 */
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export function spinnerFrame(index: number): string {
  return colored(spinnerFrames[index % spinnerFrames.length], theme.primary);
}

// ============================================================================
// Dividers & Separators
// ============================================================================

/**
 * Create a divider line
 */
export function divider(
  width: number = 40,
  style: "line" | "dots" | "dashes" | "double" | "thick" = "line"
): string {
  const chars: Record<string, string> = {
    line: "─",
    dots: "·",
    dashes: "╌",
    double: "═",
    thick: "━",
  };
  
  return colored(chars[style].repeat(width), theme.border);
}

/**
 * Create a section separator with title
 */
export function sectionDivider(title: string, width: number = 40): string {
  const titleLen = title.length + 2;
  const sideLen = Math.max(0, Math.floor((width - titleLen) / 2));
  const leftLine = "─".repeat(sideLen);
  const rightLine = "─".repeat(width - sideLen - titleLen);
  
  return dim(`${leftLine} `) + bold(title, theme.primary) + dim(` ${rightLine}`);
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a file path with icon
 */
export function filePath(path: string, action?: "read" | "write" | "edit"): string {
  const icons: Record<string, string> = {
    read: "→",
    write: "+",
    edit: "~",
  };
  
  const colors: Record<string, string> = {
    read: theme.blue,
    write: theme.green,
    edit: theme.yellow,
  };
  
  if (action) {
    const icon = colored(icons[action], colors[action]);
    return `${icon} ${dim(path)}`;
  }
  
  return colored(path, theme.cyan);
}

/**
 * Format duration in human readable format
 */
export function duration(ms: number): string {
  if (ms < 1000) return dim(`${ms}ms`);
  if (ms < 60000) return dim(`${(ms / 1000).toFixed(1)}s`);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return dim(`${mins}m ${secs}s`);
}

/**
 * Format a key-value pair
 */
export function keyValue(key: string, value: string, keyColor?: string): string {
  const keyStyled = colored(`${key}:`, keyColor ?? theme.textMuted);
  return `${keyStyled} ${value}`;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format number with suffix (K, M, etc.)
 */
export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ============================================================================
// Layout Utilities
// ============================================================================

/**
 * Horizontally align text
 */
export function align(
  text: string,
  width: number,
  alignment: "left" | "center" | "right" = "left"
): string {
  const lines = text.split("\n");
  return lines.map(line => {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, "");
    const padding = Math.max(0, width - stripped.length);
    
    if (alignment === "center") {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + line + " ".repeat(right);
    } else if (alignment === "right") {
      return " ".repeat(padding) + line;
    }
    return line + " ".repeat(padding);
  }).join("\n");
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

/**
 * Wrap text to width
 */
export function wrap(text: string, width: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.join("\n");
}

// ============================================================================
// Tree View Utilities
// ============================================================================

export interface TreeNode {
  name: string;
  children?: TreeNode[];
  icon?: string;
}

/**
 * Render a tree structure
 */
export function tree(root: TreeNode, prefix: string = ""): string {
  const lines: string[] = [];
  const icon = root.icon ? colored(root.icon, theme.cyan) + " " : "";
  lines.push(icon + root.name);
  
  if (root.children && root.children.length > 0) {
    root.children.forEach((child, i) => {
      const isLast = i === root.children!.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";
      
      const childIcon = child.icon ? colored(child.icon, theme.cyan) + " " : "";
      lines.push(dim(prefix + connector) + childIcon + child.name);
      
      if (child.children && child.children.length > 0) {
        const subtree = tree({ ...child, name: "" }, prefix + childPrefix)
          .split("\n")
          .slice(1)
          .map(line => line);
        lines.push(...subtree);
      }
    });
  }
  
  return lines.join("\n");
}

// ============================================================================
// Panel Utilities
// ============================================================================

export interface PanelOptions {
  title?: string;
  subtitle?: string;
  footer?: string;
  borderStyle?: "single" | "double" | "round" | "bold";
  borderColor?: string;
  width?: number;
}

/**
 * Create a panel with optional header and footer
 */
export function panel(content: string, options: PanelOptions = {}): string {
  const lines: string[] = [];
  
  if (options.title) {
    lines.push(bold(options.title, theme.primary));
    if (options.subtitle) {
      lines.push(dim(options.subtitle));
    }
    lines.push("");
  }
  
  lines.push(content);
  
  if (options.footer) {
    lines.push("");
    lines.push(dim(options.footer));
  }
  
  return box(lines.join("\n"), {
    borderStyle: options.borderStyle ?? "round",
    borderColor: options.borderColor ?? theme.border,
    padding: { top: 0, right: 2, bottom: 0, left: 2 },
    width: options.width,
  });
}

// ============================================================================
// Banner & ASCII Art
// ============================================================================

/**
 * Create an ASCII art banner
 */
export function asciiBanner(text: string, style: "simple" | "block" | "slant" = "simple"): string {
  if (style === "block") {
    const chars: Record<string, string[]> = {
      E: ["███", "█  ", "██ ", "█  ", "███"],
      R: ["██ ", "█ █", "██ ", "█ █", "█ █"],
      Z: ["███", "  █", " █ ", "█  ", "███"],
      N: ["█ █", "██ ", "█ █", "█ █", "█ █"],
      C: ["███", "█  ", "█  ", "█  ", "███"],
      O: ["███", "█ █", "█ █", "█ █", "███"],
      D: ["██ ", "█ █", "█ █", "█ █", "██ "],
      " ": ["   ", "   ", "   ", "   ", "   "],
    };
    
    const lines: string[] = ["", "", "", "", ""];
    for (const char of text.toUpperCase()) {
      const pattern = chars[char] ?? chars[" "];
      for (let i = 0; i < 5; i++) {
        lines[i] += (pattern?.[i] ?? "   ") + " ";
      }
    }
    
    return gradientText(lines.join("\n"), "primary");
  }
  
  // Simple style - just bold gradient
  return gradientText(text, "primary");
}

/**
 * Create a title banner with decorative borders
 */
export function titleBanner(title: string, subtitle?: string): string {
  const width = Math.max(title.length, subtitle?.length ?? 0) + 8;
  const topBorder = "╔" + "═".repeat(width) + "╗";
  const bottomBorder = "╚" + "═".repeat(width) + "╝";
  
  const paddedTitle = title.padStart((width + title.length) / 2).padEnd(width);
  const titleLine = "║ " + gradientText(paddedTitle, "primary") + " ║";
  
  const lines = [colored(topBorder, theme.primary), titleLine];
  
  if (subtitle) {
    const paddedSub = subtitle.padStart((width + subtitle.length) / 2).padEnd(width);
    lines.push("║ " + dim(paddedSub) + " ║");
  }
  
  lines.push(colored(bottomBorder, theme.primary));
  
  return lines.join("\n");
}

// ============================================================================
// Spinner Animations
// ============================================================================

export const spinners = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  arc: ["◜", "◠", "◝", "◞", "◡", "◟"],
  circle: ["◐", "◓", "◑", "◒"],
  square: ["◰", "◳", "◲", "◱"],
  bounce: ["⠁", "⠂", "⠄", "⠂"],
  pulse: ["█", "▓", "▒", "░", "▒", "▓"],
  arrows: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
  clock: ["🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛"],
};

export type SpinnerStyle = keyof typeof spinners;

/**
 * Get a spinner frame
 */
export function spinner(index: number, style: SpinnerStyle = "dots"): string {
  const frames = spinners[style];
  return colored(frames[index % frames.length], theme.primary);
}

/**
 * Create a spinner with message
 */
export function spinnerWithMessage(index: number, message: string, style: SpinnerStyle = "dots"): string {
  return `${spinner(index, style)} ${message}`;
}

// ============================================================================
// Stats & Metrics Display
// ============================================================================

export interface StatItem {
  label: string;
  value: string | number;
  color?: string;
  icon?: string;
}

/**
 * Display stats in a row
 */
export function statsRow(stats: StatItem[]): string {
  return stats.map(stat => {
    const icon = stat.icon ? stat.icon + " " : "";
    const value = colored(String(stat.value), stat.color ?? theme.primary);
    return `${icon}${dim(stat.label + ":")} ${value}`;
  }).join("  │  ");
}

/**
 * Display stats in a grid
 */
export function statsGrid(stats: StatItem[], columns: number = 2): string {
  const rows: string[] = [];
  for (let i = 0; i < stats.length; i += columns) {
    const rowStats = stats.slice(i, i + columns);
    rows.push(statsRow(rowStats));
  }
  return rows.join("\n");
}

// ============================================================================
// Highlight & Emphasis
// ============================================================================

/**
 * Highlight text with a background color
 */
export function highlight(text: string, color?: string): string {
  return chalk.bgHex(color ?? theme.backgroundLight)(text);
}

/**
 * Create emphasized text with icon
 */
export function emphasis(text: string, type: "tip" | "note" | "important" | "warning" | "caution" = "note"): string {
  const config: Record<string, { icon: string; color: string; label: string }> = {
    tip: { icon: "💡", color: theme.success, label: "TIP" },
    note: { icon: "📝", color: theme.info, label: "NOTE" },
    important: { icon: "❗", color: theme.accent, label: "IMPORTANT" },
    warning: { icon: "⚠️", color: theme.warning, label: "WARNING" },
    caution: { icon: "🚨", color: theme.error, label: "CAUTION" },
  };
  
  const { icon, color, label } = config[type];
  return `${icon} ${colored(label, color)}: ${text}`;
}

// ============================================================================
// Diff Display
// ============================================================================

/**
 * Format a diff line with proper coloring
 */
export function diffLine(line: string): string {
  if (line.startsWith("+")) return colored(line, theme.green);
  if (line.startsWith("-")) return colored(line, theme.red);
  if (line.startsWith("@@")) return colored(line, theme.magenta);
  if (line.startsWith("diff") || line.startsWith("index")) return colored(line, theme.cyan);
  return dim(line);
}

/**
 * Format a complete diff block
 */
export function diffBlock(diff: string): string {
  return diff.split("\n").map(diffLine).join("\n");
}

// ============================================================================
// Time & Duration Formatting
// ============================================================================

/**
 * Format a timestamp
 */
export function timestamp(date?: Date): string {
  const d = date ?? new Date();
  const time = d.toLocaleTimeString("en-US", { hour12: false });
  return dim(`[${time}]`);
}

/**
 * Format relative time
 */
export function relativeTime(ms: number): string {
  if (ms < 1000) return "just now";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

// ============================================================================
// Export all utilities
// ============================================================================

export const charmTUI = {
  // Initialization
  init: initCharm,
  isInitialized,
  
  // Theme & Gradients
  theme,
  gradients,
  
  // Text styling
  colored,
  bold,
  italic,
  dim,
  underline,
  strikethrough,
  gradientText,
  highlight,
  emphasis,
  
  // Boxes & Panels
  box,
  header,
  alert,
  codeBlock,
  panel,
  titleBanner,
  asciiBanner,
  
  // Tables
  table,
  kvTable,
  
  // Lists & Trees
  list,
  taskList,
  tree,
  
  // Status & Progress
  statusBadge,
  progressBar,
  spinnerFrame,
  spinner,
  spinnerWithMessage,
  spinners,
  
  // Dividers
  divider,
  sectionDivider,
  
  // Formatting
  filePath,
  duration,
  keyValue,
  formatBytes,
  formatNumber,
  timestamp,
  relativeTime,
  
  // Stats
  statsRow,
  statsGrid,
  
  // Diff
  diffLine,
  diffBlock,
  
  // Layout
  align,
  truncate,
  wrap,
};

export default charmTUI;
