import chalk from "chalk";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

/**
 * Terminal-optimized markdown rendering
 * Uses marked-terminal for proper rendering with syntax highlighting
 */

// Configure marked with terminal renderer
const marked = new Marked();
marked.use(
  markedTerminal({
    // Code styling
    code: chalk.cyan,
    codespan: chalk.cyan,

    // Heading styling
    heading: chalk.bold.white,
    firstHeading: chalk.bold.white,

    // List styling
    listitem: chalk.white,

    // Link styling
    link: chalk.blue.underline,
    href: chalk.blue.underline,

    // Emphasis
    strong: chalk.bold,
    em: chalk.italic,
    del: chalk.strikethrough,

    // Block elements
    blockquote: chalk.gray.italic,
    hr: chalk.gray,

    // Table styling
    tableOptions: {},

    // Other
    paragraph: chalk.white,
    width: 80,
    reflowText: true,
    showSectionPrefix: false,
    tab: 2,
    unescape: true,
  }) as any,
);

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
      out.push(chalk.cyan(line));
      continue;
    }
    if (line.startsWith("@@")) {
      out.push(chalk.cyanBright.bold(line));
      continue;
    }
    if (line.startsWith("+")) {
      out.push(chalk.green(line));
      continue;
    }
    if (line.startsWith("-")) {
      out.push(chalk.red(line));
      continue;
    }
    out.push(chalk.gray(line));
  }

  return out.join("\n");
}

/**
 * Render markdown text for terminal display
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";
  return renderMarkdownWithWidth(text, 80);
}

/**
 * Render markdown with a specific terminal width
 * Clean, readable output optimized for CLI
 */
export function renderMarkdownWithWidth(text: string, width: number): string {
  if (!text) return "";

  try {
    const diffBlocks: string[] = [];
    const placeholderPrefix = "__AI_DIFF_BLOCK_";
    const placeholderSuffix = "__";
    const preprocessed = text.replace(
      /```(diff|patch)\n([\s\S]*?)```/g,
      (_m, _lang, body: string) => {
        const idx = diffBlocks.length;
        diffBlocks.push(body ?? "");
        return `${placeholderPrefix}${idx}${placeholderSuffix}`;
      },
    );

    // Update width configuration
    marked.use(
      markedTerminal({
        width: Math.max(40, width - 4),
        reflowText: true,
        showSectionPrefix: false,
      }) as any,
    );

    // Parse and render markdown
    let output = marked.parse(preprocessed) as string;

    // Re-insert diff blocks with git-style coloring
    if (diffBlocks.length > 0) {
      for (let i = 0; i < diffBlocks.length; i++) {
        const token = `${placeholderPrefix}${i}${placeholderSuffix}`;
        output = output.replace(token, `\n${renderDiffBlock(diffBlocks[i] ?? "")}\n`);
      }
    }

    // Clean up extra newlines
    output = output.replace(/\n{3,}/g, "\n\n");

    // Trim trailing whitespace
    output = output.trimEnd();

    return output;
  } catch (error) {
    // Fallback to simple rendering if marked fails
    return renderSimple(text);
  }
}

/**
 * Simple fallback markdown rendering
 * Used when marked-terminal fails or for streaming
 */
export function renderSimple(text: string): string {
  if (!text) return "";

  let output = text;

  // Inline code
  output = output.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

  // Bold
  output = output.replace(/\*\*([^*]+)\*\*/g, (_, t) => chalk.bold(t));

  // Italic
  output = output.replace(/\*([^*]+)\*/g, (_, t) => chalk.italic(t));
  output = output.replace(/_([^_]+)_/g, (_, t) => chalk.italic(t));

  // Headings (simple)
  output = output.replace(/^### (.+)$/gm, (_, t) => chalk.bold.white(t));
  output = output.replace(/^## (.+)$/gm, (_, t) => chalk.bold.white(t));
  output = output.replace(/^# (.+)$/gm, (_, t) => chalk.bold.white(t));

  // Lists
  output = output.replace(
    /^[-*] (.+)$/gm,
    (_, t) => `  ${chalk.gray("-")} ${t}`,
  );
  output = output.replace(
    /^\d+\. (.+)$/gm,
    (_, t) => `  ${chalk.gray("-")} ${t}`,
  );

  return output;
}

/**
 * Check if text contains markdown that should be rendered
 */
export function hasMarkdown(text: string): boolean {
  if (!text) return false;

  // Check for common markdown patterns
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
 * Strip markdown formatting from text
 * Useful for calculating display width
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
