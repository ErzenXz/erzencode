/**
 * Charm-Ink Bridge - Utility for using charm-tui with Ink components
 * Provides React components that render charm-tui styled output in Ink
 */

import React from "react";
import { Text, Box } from "ink";
import {
  initCharm,
  theme as charmTheme,
  colored,
  bold,
  dim,
  gradientText,
  gradients,
  box as charmBox,
  table as charmTable,
  list as charmList,
  taskList as charmTaskList,
  statusBadge as charmStatusBadge,
  progressBar as charmProgressBar,
  divider as charmDivider,
  sectionDivider as charmSectionDivider,
  alert as charmAlert,
  codeBlock as charmCodeBlock,
  header as charmHeader,
  filePath as charmFilePath,
  duration as charmDuration,
  keyValue as charmKeyValue,
  formatNumber,
  formatBytes,
  type TaskItem,
  type BoxOptions,
  type ListOptions,
  type TableOptions,
} from "../../components/charm-tui.js";
import type { ThemeColors } from "../types.js";

// Re-export theme for easy access
export { charmTheme as theme };

// Initialize charm (call once at app startup)
let initialized = false;
export async function initCharmInk(): Promise<void> {
  if (!initialized) {
    await initCharm();
    initialized = true;
  }
}

/**
 * Create ThemeColors from charm-tui theme
 */
export function createCharmThemeColors(): ThemeColors {
  return {
    primary: charmTheme.primary,
    secondary: charmTheme.accent,
    success: charmTheme.success,
    warning: charmTheme.warning,
    error: charmTheme.error,
    info: charmTheme.info,
    text: charmTheme.text,
    textMuted: charmTheme.textMuted,
    textDim: charmTheme.textMuted,
    border: charmTheme.border,
    user: charmTheme.cyan,
    assistant: charmTheme.green,
    tool: charmTheme.yellow,
  };
}

/**
 * Component that renders pre-styled charm-tui output
 */
export const CharmText: React.FC<{ children: string }> = ({ children }) => (
  <Text>{children}</Text>
);

/**
 * Gradient text component
 */
export const GradientText: React.FC<{
  children: string;
  gradient?: keyof typeof gradients;
}> = ({ children, gradient = "primary" }) => (
  <Text>{gradientText(children, gradient)}</Text>
);

/**
 * Bold colored text
 */
export const BoldText: React.FC<{
  children: string;
  color?: string;
}> = ({ children, color }) => (
  <Text>{bold(children, color)}</Text>
);

/**
 * Dim/muted text
 */
export const DimText: React.FC<{ children: string }> = ({ children }) => (
  <Text>{dim(children)}</Text>
);

/**
 * Colored text
 */
export const ColoredText: React.FC<{
  children: string;
  color: string;
}> = ({ children, color }) => (
  <Text>{colored(children, color)}</Text>
);

/**
 * Status badge component
 */
export const StatusBadge: React.FC<{
  status: "running" | "success" | "error" | "pending" | "info";
  label?: string;
}> = ({ status, label }) => (
  <Text>{charmStatusBadge(status, label)}</Text>
);

/**
 * Progress bar component
 */
export const ProgressBar: React.FC<{
  current: number;
  total: number;
  width?: number;
}> = ({ current, total, width = 20 }) => (
  <Text>{charmProgressBar(current, total, width)}</Text>
);

/**
 * Divider component
 */
export const Divider: React.FC<{
  width?: number;
  style?: "line" | "dots" | "dashes" | "double" | "thick";
}> = ({ width = 40, style = "line" }) => (
  <Text>{charmDivider(width, style)}</Text>
);

/**
 * Section divider with title
 */
export const SectionDivider: React.FC<{
  title: string;
  width?: number;
}> = ({ title, width = 40 }) => (
  <Text>{charmSectionDivider(title, width)}</Text>
);

/**
 * Alert box component
 */
export const Alert: React.FC<{
  children: string;
  type?: "info" | "success" | "warning" | "error";
}> = ({ children, type = "info" }) => (
  <Text>{charmAlert(children, type)}</Text>
);

/**
 * Styled box component
 */
export const StyledBox: React.FC<{
  children: string;
  options?: BoxOptions;
}> = ({ children, options }) => (
  <Text>{charmBox(children, options)}</Text>
);

/**
 * Code block component
 */
export const CodeBlock: React.FC<{
  children: string;
  language?: string;
}> = ({ children, language }) => (
  <Text>{charmCodeBlock(children, language)}</Text>
);

/**
 * Header component
 */
export const CharmHeader: React.FC<{
  title: string;
  subtitle?: string;
}> = ({ title, subtitle }) => (
  <Text>{charmHeader(title, subtitle)}</Text>
);

/**
 * Table component
 */
export const Table: React.FC<{
  headers: string[];
  rows: string[][];
  options?: TableOptions;
}> = ({ headers, rows, options }) => (
  <Text>{charmTable(headers, rows, options)}</Text>
);

/**
 * List component
 */
export const List: React.FC<{
  items: string[];
  options?: ListOptions;
}> = ({ items, options }) => (
  <Text>{charmList(items, options)}</Text>
);

/**
 * Task list component
 */
export const TaskList: React.FC<{
  tasks: TaskItem[];
}> = ({ tasks }) => (
  <Text>{charmTaskList(tasks)}</Text>
);

/**
 * File path display
 */
export const FilePath: React.FC<{
  path: string;
  action?: "read" | "write" | "edit";
}> = ({ path, action }) => (
  <Text>{charmFilePath(path, action)}</Text>
);

/**
 * Duration display
 */
export const Duration: React.FC<{ ms: number }> = ({ ms }) => (
  <Text>{charmDuration(ms)}</Text>
);

/**
 * Key-value pair display
 */
export const KeyValue: React.FC<{
  label: string;
  value: string;
  labelColor?: string;
}> = ({ label, value, labelColor }) => (
  <Text>{charmKeyValue(label, value, labelColor)}</Text>
);

/**
 * Format number with suffix
 */
export const FormattedNumber: React.FC<{ value: number }> = ({ value }) => (
  <Text>{formatNumber(value)}</Text>
);

/**
 * Format bytes
 */
export const FormattedBytes: React.FC<{ bytes: number }> = ({ bytes }) => (
  <Text>{formatBytes(bytes)}</Text>
);

/**
 * Beautiful welcome banner
 */
export const WelcomeBanner: React.FC<{
  appName: string;
  version: string;
  tagline?: string;
}> = ({ appName, version, tagline }) => {
  const title = gradientText(appName, "primary");
  const ver = dim(`v${version}`);
  const tag = tagline ? "\n" + dim(tagline) : "";
  
  return (
    <Text>
      {charmBox(`${title} ${ver}${tag}`, {
        borderStyle: "double",
        padding: { top: 0, right: 2, bottom: 0, left: 2 },
      })}
    </Text>
  );
};

/**
 * Tool result display
 */
export const ToolResult: React.FC<{
  name: string;
  status: "running" | "success" | "error";
  output?: string;
  duration?: number;
  metadata?: Record<string, string>;
}> = ({ name, status, output, duration: dur, metadata }) => {
  const lines: string[] = [];
  
  const statusIcon = charmStatusBadge(status);
  const toolName = bold(name, charmTheme.cyan);
  const durationText = dur ? dim(` (${charmDuration(dur)})`) : "";
  
  lines.push(`${statusIcon} ${toolName}${durationText}`);
  
  if (metadata && Object.keys(metadata).length > 0) {
    const metaLines = Object.entries(metadata)
      .map(([k, v]) => charmKeyValue(k, v))
      .join("  ");
    lines.push(dim(`  ${metaLines}`));
  }
  
  if (output) {
    lines.push(charmBox(output, {
      borderStyle: "round",
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
    }));
  }
  
  return <Text>{lines.join("\n")}</Text>;
};

/**
 * Session info panel
 */
export const SessionInfo: React.FC<{
  name: string;
  model: string;
  provider: string;
  mode: string;
  messageCount: number;
  tokensUsed: number;
  contextWindow: number;
  duration: number;
}> = ({ name, model, provider, mode, messageCount, tokensUsed, contextWindow, duration: dur }) => {
  const lines = [
    charmKeyValue("Session", name),
    charmKeyValue("Model", colored(model, charmTheme.green)),
    charmKeyValue("Provider", colored(provider, charmTheme.yellow)),
    charmKeyValue("Mode", colored(mode, charmTheme.blue)),
    "",
    charmKeyValue("Messages", String(messageCount)),
    charmKeyValue("Tokens", `${formatNumber(tokensUsed)} / ${formatNumber(contextWindow)}`),
    charmProgressBar(tokensUsed, contextWindow, 15),
    "",
    charmKeyValue("Duration", charmDuration(dur)),
  ];
  
  return (
    <Text>
      {charmBox(lines.join("\n"), {
        title: "Session Info",
        borderStyle: "round",
        padding: { top: 0, right: 1, bottom: 0, left: 1 },
      })}
    </Text>
  );
};

/**
 * Plan/task progress display
 */
export const PlanProgress: React.FC<{
  title: string;
  steps: Array<{
    description: string;
    status: "pending" | "in_progress" | "completed" | "failed";
  }>;
}> = ({ title, steps }) => {
  const tasks: TaskItem[] = steps.map((step) => ({
    text: step.description,
    status: step.status,
  }));
  
  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  const progressText = dim(`${completed}/${total}`);
  
  const content = [
    `${bold(title, charmTheme.primary)} ${progressText}`,
    charmProgressBar(completed, total, 20),
    "",
    charmTaskList(tasks),
  ].join("\n");
  
  return (
    <Text>
      {charmBox(content, {
        borderStyle: "round",
        padding: { top: 0, right: 1, bottom: 0, left: 1 },
      })}
    </Text>
  );
};

// Export utility functions for direct use
export {
  colored,
  bold,
  dim,
  gradientText,
  gradients,
  formatNumber,
  formatBytes,
};
