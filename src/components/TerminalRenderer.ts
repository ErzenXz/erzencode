/**
 * Terminal Renderer - Beautiful output rendering using Charm TUI
 * Used for rendering AI responses, tool outputs, and system messages
 */

import {
  initCharm,
  theme,
  colored,
  bold,
  dim,
  box,
  table,
  list,
  taskList,
  statusBadge,
  progressBar,
  divider,
  sectionDivider,
  header,
  alert,
  codeBlock,
  filePath,
  duration,
  keyValue,
  formatNumber,
  tree,
  panel,
  titleBanner,
  statsRow,
  statsGrid,
  emphasis,
  diffBlock,
  timestamp,
  relativeTime,
  spinner,
  spinnerWithMessage,
  gradientText,
  type TaskItem,
  type TreeNode,
  type StatItem,
  type SpinnerStyle,
} from "./charm-tui.js";

let isInitialized = false;

/**
 * Ensure charm is initialized before rendering
 */
async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    await initCharm();
    isInitialized = true;
  }
}

// ============================================================================
// AI Response Rendering
// ============================================================================

/**
 * Render an AI assistant message
 */
export async function renderAssistantMessage(content: string): Promise<string> {
  await ensureInitialized();
  // Simple formatting - content is returned as-is, caller can use markdown renderer
  return content;
}

/**
 * Render a user message
 */
export async function renderUserMessage(content: string): Promise<string> {
  await ensureInitialized();
  const icon = colored("❯", theme.primary);
  const text = content;
  return `${icon} ${text}`;
}

/**
 * Render a system message
 */
export async function renderSystemMessage(content: string): Promise<string> {
  await ensureInitialized();
  return alert(content, "info");
}

// ============================================================================
// Tool Output Rendering
// ============================================================================

export interface ToolResult {
  name: string;
  status: "success" | "error" | "running";
  output?: string;
  duration?: number;
  metadata?: Record<string, string>;
}

/**
 * Render a tool execution result
 */
export async function renderToolResult(result: ToolResult): Promise<string> {
  await ensureInitialized();
  
  const lines: string[] = [];
  
  // Header with tool name and status
  const statusIcon = statusBadge(result.status);
  const toolName = bold(result.name, theme.cyan);
  const durationText = result.duration ? dim(` (${duration(result.duration)})`) : "";
  
  lines.push(`${statusIcon} ${toolName}${durationText}`);
  
  // Metadata if present
  if (result.metadata && Object.keys(result.metadata).length > 0) {
    const metaLines = Object.entries(result.metadata)
      .map(([k, v]) => keyValue(k, v))
      .join("  ");
    lines.push(dim(`  ${metaLines}`));
  }
  
  // Output content
  if (result.output) {
    const outputBox = box(result.output, {
      borderStyle: "round",
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
    });
    lines.push(outputBox);
  }
  
  return lines.join("\n");
}

/**
 * Render multiple tool results in a compact format
 */
export async function renderToolResults(results: ToolResult[]): Promise<string> {
  await ensureInitialized();
  
  const rendered = await Promise.all(results.map(renderToolResult));
  return rendered.join("\n" + divider(40) + "\n");
}

// ============================================================================
// File Operations Rendering
// ============================================================================

export interface FileOperation {
  path: string;
  action: "read" | "write" | "edit" | "delete" | "create";
  lines?: { start: number; end: number };
  preview?: string;
}

/**
 * Render a file operation
 */
export async function renderFileOperation(op: FileOperation): Promise<string> {
  await ensureInitialized();
  
  const actionIcons: Record<string, string> = {
    read: "→",
    write: "+",
    edit: "~",
    delete: "✗",
    create: "★",
  };
  
  const actionColors: Record<string, string> = {
    read: theme.blue,
    write: theme.green,
    edit: theme.yellow,
    delete: theme.red,
    create: theme.accent,
  };
  
  const icon = colored(actionIcons[op.action], actionColors[op.action]);
  const pathText = dim(op.path);
  const linesText = op.lines 
    ? dim(`:${op.lines.start}-${op.lines.end}`)
    : "";
  
  let result = `${icon} ${pathText}${linesText}`;
  
  if (op.preview) {
    result += "\n" + codeBlock(op.preview);
  }
  
  return result;
}

/**
 * Render a list of file operations
 */
export async function renderFileOperations(ops: FileOperation[]): Promise<string> {
  await ensureInitialized();
  
  const rendered = await Promise.all(ops.map(renderFileOperation));
  return rendered.join("\n");
}

// ============================================================================
// Session & Context Rendering
// ============================================================================

export interface SessionInfo {
  name: string;
  model: string;
  provider: string;
  mode: string;
  messageCount: number;
  tokensUsed: number;
  contextWindow: number;
  duration: number;
}

/**
 * Render session information panel
 */
export async function renderSessionInfo(info: SessionInfo): Promise<string> {
  await ensureInitialized();
  
  const lines = [
    keyValue("Session", info.name),
    keyValue("Model", colored(info.model, theme.green)),
    keyValue("Provider", colored(info.provider, theme.yellow)),
    keyValue("Mode", colored(info.mode, theme.blue)),
    "",
    keyValue("Messages", String(info.messageCount)),
    keyValue("Tokens", `${formatTokens(info.tokensUsed)} / ${formatTokens(info.contextWindow)}`),
    progressBar(info.tokensUsed, info.contextWindow, 15),
    "",
    keyValue("Duration", duration(info.duration)),
  ];
  
  return box(lines.join("\n"), {
    title: "Session Info",
    borderStyle: "round",
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
  });
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ============================================================================
// Task/Plan Rendering
// ============================================================================

export interface PlanStep {
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

/**
 * Render a task plan
 */
export async function renderPlan(
  title: string,
  steps: PlanStep[]
): Promise<string> {
  await ensureInitialized();
  
  const tasks: TaskItem[] = steps.map((step) => ({
    text: step.description,
    status: step.status,
  }));
  
  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  const progressText = dim(`${completed}/${total}`);
  
  const content = [
    `${bold(title, theme.primary)} ${progressText}`,
    progressBar(completed, total, 20),
    "",
    taskList(tasks),
  ].join("\n");
  
  return box(content, {
    borderStyle: "round",
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
  });
}

// ============================================================================
// Error Rendering
// ============================================================================

/**
 * Render an error message
 */
export async function renderError(
  message: string,
  details?: string
): Promise<string> {
  await ensureInitialized();
  
  let content = colored(`✗ ${message}`, theme.error);
  
  if (details) {
    content += "\n" + dim(details);
  }
  
  return box(content, {
    borderStyle: "round",
    borderColor: theme.error,
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
  });
}

/**
 * Render a warning message
 */
export async function renderWarning(message: string): Promise<string> {
  await ensureInitialized();
  return alert(message, "warning");
}

/**
 * Render a success message
 */
export async function renderSuccess(message: string): Promise<string> {
  await ensureInitialized();
  return alert(message, "success");
}

// ============================================================================
// Data Rendering
// ============================================================================

/**
 * Render a data table
 */
export async function renderTable(
  headers: string[],
  rows: string[][],
  title?: string
): Promise<string> {
  await ensureInitialized();
  
  let result = table(headers, rows);
  
  if (title) {
    result = bold(title, theme.primary) + "\n" + result;
  }
  
  return result;
}

/**
 * Render a key-value list
 */
export async function renderKeyValueList(
  data: Record<string, string>,
  title?: string
): Promise<string> {
  await ensureInitialized();
  
  const lines = Object.entries(data).map(([k, v]) => keyValue(k, v));
  let content = lines.join("\n");
  
  if (title) {
    content = bold(title, theme.primary) + "\n" + content;
  }
  
  return content;
}

/**
 * Render a simple list
 */
export async function renderList(
  items: string[],
  title?: string
): Promise<string> {
  await ensureInitialized();
  
  let result = list(items);
  
  if (title) {
    result = bold(title, theme.primary) + "\n" + result;
  }
  
  return result;
}

// ============================================================================
// Composite Layouts
// ============================================================================

/**
 * Render a welcome banner
 */
export async function renderWelcomeBanner(
  appName: string,
  version: string,
  tagline?: string
): Promise<string> {
  await ensureInitialized();
  
  const title = bold(appName, theme.primary);
  const ver = dim(`v${version}`);
  const tag = tagline ? "\n" + dim(tagline) : "";
  
  return box(`${title} ${ver}${tag}`, {
    borderStyle: "double",
    padding: { top: 0, right: 2, bottom: 0, left: 2 },
  });
}

/**
 * Render a help section
 */
export async function renderHelp(
  commands: Array<{ command: string; description: string }>
): Promise<string> {
  await ensureInitialized();
  
  const rows = commands.map((c) => [
    colored(c.command, theme.cyan),
    dim(c.description),
  ]);
  
  return table(["Command", "Description"], rows);
}

/**
 * Render thinking/processing indicator
 */
export async function renderThinking(message: string = "Thinking..."): Promise<string> {
  await ensureInitialized();
  
  const icon = colored("◐", theme.magenta);
  const text = colored(message, theme.magenta);
  
  return `${icon} ${text}`;
}

// ============================================================================
// Export the renderer
// ============================================================================

/**
 * Render a tree structure
 */
export async function renderTree(root: TreeNode): Promise<string> {
  await ensureInitialized();
  return tree(root);
}

/**
 * Render stats in a row
 */
export async function renderStats(stats: StatItem[]): Promise<string> {
  await ensureInitialized();
  return statsRow(stats);
}

/**
 * Render stats in a grid
 */
export async function renderStatsGrid(stats: StatItem[], columns: number = 2): Promise<string> {
  await ensureInitialized();
  return statsGrid(stats, columns);
}

/**
 * Render an emphasis/callout message
 */
export async function renderEmphasis(
  text: string,
  type: "tip" | "note" | "important" | "warning" | "caution" = "note"
): Promise<string> {
  await ensureInitialized();
  return emphasis(text, type);
}

/**
 * Render a diff block
 */
export async function renderDiff(diff: string): Promise<string> {
  await ensureInitialized();
  return diffBlock(diff);
}

/**
 * Render a panel with title
 */
export async function renderPanel(
  content: string,
  title?: string,
  subtitle?: string
): Promise<string> {
  await ensureInitialized();
  return panel(content, { title, subtitle });
}

/**
 * Render a spinner with message
 */
export async function renderSpinner(
  index: number,
  message: string,
  style: SpinnerStyle = "dots"
): Promise<string> {
  await ensureInitialized();
  return spinnerWithMessage(index, message, style);
}

/**
 * Render a section divider
 */
export async function renderDivider(title?: string, width: number = 40): Promise<string> {
  await ensureInitialized();
  if (title) {
    return sectionDivider(title, width);
  }
  return divider(width);
}

/**
 * Render a title banner
 */
export async function renderTitleBanner(title: string, subtitle?: string): Promise<string> {
  await ensureInitialized();
  return titleBanner(title, subtitle);
}

/**
 * Render gradient text
 */
export async function renderGradient(text: string, gradientName: string = "primary"): Promise<string> {
  await ensureInitialized();
  return gradientText(text, gradientName as any);
}

/**
 * Render a timestamp
 */
export function renderTimestamp(date?: Date): string {
  return timestamp(date);
}

/**
 * Render relative time
 */
export function renderRelativeTime(ms: number): string {
  return relativeTime(ms);
}

export const terminalRenderer = {
  // Initialization
  ensureInitialized,
  
  // AI Messages
  renderAssistantMessage,
  renderUserMessage,
  renderSystemMessage,
  
  // Tool Results
  renderToolResult,
  renderToolResults,
  
  // File Operations
  renderFileOperation,
  renderFileOperations,
  
  // Session
  renderSessionInfo,
  
  // Tasks/Plans
  renderPlan,
  
  // Notifications
  renderError,
  renderWarning,
  renderSuccess,
  renderEmphasis,
  
  // Data
  renderTable,
  renderKeyValueList,
  renderList,
  renderTree,
  renderStats,
  renderStatsGrid,
  renderDiff,
  
  // Layouts
  renderWelcomeBanner,
  renderHelp,
  renderThinking,
  renderPanel,
  renderDivider,
  renderTitleBanner,
  renderGradient,
  renderSpinner,
  
  // Time
  renderTimestamp,
  renderRelativeTime,
};

export default terminalRenderer;
