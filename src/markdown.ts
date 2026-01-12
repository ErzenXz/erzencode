import chalk from "chalk";
import { codeToANSI } from "@shikijs/cli";
import type { BundledLanguage, BundledTheme } from "shiki";
import { theme, colored, dim, bold } from "./components/charm-tui.js";

/**
 * Terminal markdown renderer with Shiki syntax highlighting.
 * Uses VS Code-quality syntax highlighting for code blocks.
 */

// Default theme for syntax highlighting
const DEFAULT_THEME: BundledTheme = "github-dark";

// Cache for highlighted code to avoid re-highlighting
const highlightCache = new Map<string, string>();

/**
 * Get syntax-highlighted code using Shiki.
 * Falls back to plain colored output if highlighting fails.
 */
async function highlightCode(code: string, lang: string): Promise<string> {
  const cacheKey = `${lang}:${code}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) return cached;

  try {
    // Map common language aliases
    const langMap: Record<string, BundledLanguage> = {
      js: "javascript",
      ts: "typescript",
      tsx: "tsx",
      jsx: "jsx",
      py: "python",
      rb: "ruby",
      sh: "bash",
      shell: "bash",
      zsh: "bash",
      yml: "yaml",
      md: "markdown",
      dockerfile: "docker",
    };

    const mappedLang = (langMap[lang.toLowerCase()] ?? lang.toLowerCase()) as BundledLanguage;
    const result = await codeToANSI(code, mappedLang, DEFAULT_THEME);
    highlightCache.set(cacheKey, result);
    return result;
  } catch {
    // Fallback to simple cyan coloring
    return code.split("\n").map(line => chalk.cyan(line)).join("\n");
  }
}

/**
 * Synchronous code highlighting fallback.
 * Used when async highlighting isn't available.
 */
function highlightCodeSync(code: string, lang?: string): string {
  const lines = code.split("\n");
  
  // Simple syntax-aware coloring based on language
  if (lang === "diff" || lang === "patch") {
    return renderDiffBlock(code);
  }
  
  // Default: cyan for code
  return lines.map(line => chalk.cyan(line)).join("\n");
}

/**
 * Render a diff block with git-style coloring using charm-tui theme.
 */
function renderDiffBlock(diffText: string): string {
  const lines = (diffText ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw ?? "";
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      out.push(colored(line, theme.cyan));
      continue;
    }
    if (line.startsWith("@@")) {
      out.push(colored(line, theme.magenta));
      continue;
    }
    if (line.startsWith("+")) {
      out.push(colored(line, theme.green));
      continue;
    }
    if (line.startsWith("-")) {
      out.push(colored(line, theme.red));
      continue;
    }
    out.push(dim(line));
  }

  return out.join("\n");
}

/**
 * Render a code block with header and footer using charm-tui theme.
 */
function renderCodeBlock(code: string, lang?: string): string {
  const highlighted = highlightCodeSync(code, lang);
  const langLabel = lang ? dim(` ${lang} `) : "";
  const border = colored("─".repeat(3), theme.border);
  
  return `${border}${langLabel}${border}\n${highlighted}\n${border}`;
}

/**
 * Render markdown text for terminal display.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";
  return renderMarkdownWithWidth(text, 80);
}

/**
 * Render markdown with a specific terminal width.
 * Clean, readable output optimized for CLI.
 */
export function renderMarkdownWithWidth(text: string, width: number): string {
  if (!text) return "";

  try {
    let output = text;

    // Handle diff/patch code blocks specially
    output = output.replace(
      /```(diff|patch)\n([\s\S]*?)```/g,
      (_m, _lang, body: string) => renderDiffBlock(body ?? "")
    );

    // Handle other code blocks
    output = output.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, lang: string, body: string) => renderCodeBlock(body?.trimEnd() ?? "", lang)
    );

    // Inline code
    output = output.replace(/`([^`]+)`/g, (_, code) => bold(code, theme.cyan));

    // Bold
    output = output.replace(/\*\*([^*]+)\*\*/g, (_, t) => bold(t));

    // Italic
    output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, t) => chalk.italic(t));
    output = output.replace(/(?<!_)_([^_]+)_(?!_)/g, (_, t) => chalk.italic(t));

    // Headings - styled with charm-tui theme colors
    output = output.replace(/^### (.+)$/gm, (_, t) => bold(`   ${t}`, theme.primary));
    output = output.replace(/^## (.+)$/gm, (_, t) => bold(`  ${t}`, theme.primary));
    output = output.replace(/^# (.+)$/gm, (_, t) => chalk.underline(bold(` ${t}`, theme.primary)));

    // Blockquotes
    output = output.replace(/^> (.+)$/gm, (_, t) => dim(`  │ ${chalk.italic(t)}`));

    // Horizontal rules
    output = output.replace(/^---+$/gm, () => colored("─".repeat(Math.min(40, width - 4)), theme.border));

    // Unordered lists - with proper bullets
    output = output.replace(
      /^(\s*)[-*] (.+)$/gm,
      (_, indent, t) => `${indent}  ${colored("•", theme.primary)} ${t}`
    );

    // Ordered lists
    output = output.replace(
      /^(\s*)(\d+)\. (.+)$/gm,
      (_, indent, num, t) => `${indent}  ${colored(`${num}.`, theme.primary)} ${t}`
    );

    // Links [text](url)
    output = output.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, url) => `${chalk.underline(colored(text, theme.info))} ${dim(`(${url})`)}`
    );

    // Clean up extra newlines
    output = output.replace(/\n{3,}/g, "\n\n");
    output = output.trimEnd();

    return output;
  } catch {
    return renderSimple(text);
  }
}

/**
 * Render markdown with async Shiki highlighting.
 * Use this for final display when you can await.
 */
export async function renderMarkdownAsync(text: string, width: number = 80): Promise<string> {
  if (!text) return "";

  try {
    let output = text;

    // Extract and highlight code blocks
    const codeBlocks: Array<{ placeholder: string; lang: string; code: string }> = [];
    let blockIndex = 0;

    // Handle diff/patch code blocks specially (sync)
    output = output.replace(
      /```(diff|patch)\n([\s\S]*?)```/g,
      (_m, _lang, body: string) => renderDiffBlock(body ?? "")
    );

    // Extract other code blocks for async highlighting
    output = output.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, lang: string, body: string) => {
        const placeholder = `__CODE_BLOCK_${blockIndex++}__`;
        codeBlocks.push({ placeholder, lang: lang || "text", code: body?.trimEnd() ?? "" });
        return placeholder;
      }
    );

    // Highlight code blocks in parallel
    const highlightedBlocks = await Promise.all(
      codeBlocks.map(async ({ lang, code }) => {
        const highlighted = await highlightCode(code, lang);
        const langLabel = lang ? chalk.gray.dim(` ${lang} `) : "";
        const border = chalk.gray("─".repeat(3));
        return `${border}${langLabel}${border}\n${highlighted}\n${border}`;
      })
    );

    // Replace placeholders with highlighted code
    codeBlocks.forEach(({ placeholder }, i) => {
      output = output.replace(placeholder, highlightedBlocks[i] ?? "");
    });

    // Apply inline formatting (same as sync version)
    output = output.replace(/`([^`]+)`/g, (_, code) => bold(code, theme.cyan));
    output = output.replace(/\*\*([^*]+)\*\*/g, (_, t) => bold(t));
    output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, t) => chalk.italic(t));
    output = output.replace(/(?<!_)_([^_]+)_(?!_)/g, (_, t) => chalk.italic(t));
    output = output.replace(/^### (.+)$/gm, (_, t) => bold(`   ${t}`, theme.primary));
    output = output.replace(/^## (.+)$/gm, (_, t) => bold(`  ${t}`, theme.primary));
    output = output.replace(/^# (.+)$/gm, (_, t) => chalk.underline(bold(` ${t}`, theme.primary)));
    output = output.replace(/^> (.+)$/gm, (_, t) => dim(`  │ ${chalk.italic(t)}`));
    output = output.replace(/^---+$/gm, () => colored("─".repeat(Math.min(40, width - 4)), theme.border));
    output = output.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, t) => `${indent}  ${colored("•", theme.primary)} ${t}`);
    output = output.replace(/^(\s*)(\d+)\. (.+)$/gm, (_, indent, num, t) => `${indent}  ${colored(`${num}.`, theme.primary)} ${t}`);
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `${chalk.underline(colored(text, theme.info))} ${dim(`(${url})`)}`);

    output = output.replace(/\n{3,}/g, "\n\n");
    output = output.trimEnd();

    return output;
  } catch {
    return renderMarkdownWithWidth(text, width);
  }
}

/**
 * Simple fallback markdown rendering.
 * Used when main renderer fails or for streaming.
 */
export function renderSimple(text: string): string {
  if (!text) return "";

  let output = text;

  // Inline code
  output = output.replace(/`([^`]+)`/g, (_, code) => colored(code, theme.cyan));

  // Bold
  output = output.replace(/\*\*([^*]+)\*\*/g, (_, t) => bold(t));

  // Italic
  output = output.replace(/\*([^*]+)\*/g, (_, t) => chalk.italic(t));
  output = output.replace(/_([^_]+)_/g, (_, t) => chalk.italic(t));

  // Headings (simple)
  output = output.replace(/^### (.+)$/gm, (_, t) => bold(t, theme.primary));
  output = output.replace(/^## (.+)$/gm, (_, t) => bold(t, theme.primary));
  output = output.replace(/^# (.+)$/gm, (_, t) => bold(t, theme.primary));

  // Lists
  output = output.replace(/^[-*] (.+)$/gm, (_, t) => `  ${colored("•", theme.primary)} ${t}`);
  output = output.replace(/^\d+\. (.+)$/gm, (_, t) => `  ${colored("•", theme.primary)} ${t}`);

  return output;
}

/**
 * Check if text contains markdown that should be rendered.
 */
export function hasMarkdown(text: string): boolean {
  if (!text) return false;

  const patterns = [
    /```[\s\S]*```/, // Code blocks
    /`[^`]+`/, // Inline code
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /^#+\s/m, // Headings
    /^\s*[-*]\s/m, // Lists
    /^\s*\d+\.\s/m, // Numbered lists
    /\[.+\]\(.+\)/, // Links
  ];

  return patterns.some((p) => p.test(text));
}

/**
 * Strip markdown formatting from text.
 * Useful for calculating display width.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  return text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1") // Remove inline code markers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic
    .replace(/_([^_]+)_/g, "$1") // Remove underscore italic
    .replace(/^#+\s*/gm, "") // Remove heading markers
    .replace(/^\s*[-*]\s/gm, "  ") // Simplify lists
    .replace(/\[(.+?)\]\(.+?\)/g, "$1"); // Extract link text
}
