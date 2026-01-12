#!/usr/bin/env node
/**
 * Charm TUI Demo - Showcase beautiful terminal UI capabilities
 * Run with: npx tsx src/charm-demo.ts
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
  gradientText,
  gradients,
} from "./components/charm-tui.js";

import {
  renderWelcomeBanner,
  renderPlan,
  renderToolResult,
  renderSessionInfo,
  renderHelp,
  renderError,
  renderSuccess,
  renderAssistantMessage,
} from "./components/TerminalRenderer.js";

async function demo() {
  console.log("\n");
  
  // Initialize Charm
  await initCharm();
  
  // ══════════════════════════════════════════════════════════════════════════
  // Welcome Banner
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(await renderWelcomeBanner(
    "ErzenCode",
    "0.2.0",
    "AI-powered coding assistant CLI"
  ));
  
  console.log("\n");
  console.log(divider(60));
  console.log(bold("\n📦 CHARM TUI COMPONENTS DEMO\n", theme.primary));
  
  // ══════════════════════════════════════════════════════════════════════════
  // Status Badges
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Status Badges:", theme.cyan));
  console.log([
    statusBadge("running", "Running"),
    statusBadge("success", "Success"),
    statusBadge("error", "Error"),
    statusBadge("pending", "Pending"),
    statusBadge("info", "Info"),
  ].join("  "));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Progress Bars
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Progress Bars:", theme.cyan));
  console.log("  " + progressBar(3, 10, 30));
  console.log("  " + progressBar(7, 10, 30));
  console.log("  " + progressBar(10, 10, 30));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Alerts
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Alerts:", theme.cyan));
  console.log(alert("This is an info message", "info"));
  console.log(alert("Operation completed successfully!", "success"));
  console.log(alert("Please review before proceeding", "warning"));
  console.log(alert("Something went wrong", "error"));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Tables
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Beautiful Tables:", theme.cyan));
  console.log(table(
    ["Model", "Provider", "Context", "Speed"],
    [
      ["Claude 3.5 Sonnet", "Anthropic", "200K", "Fast"],
      ["GPT-4o", "OpenAI", "128K", "Very Fast"],
      ["Gemini 2.0 Flash", "Google", "1M", "Fast"],
      ["DeepSeek V3", "DeepSeek", "64K", "Fast"],
    ]
  ));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Lists
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Styled Lists:", theme.cyan));
  console.log(list([
    "Read file contents",
    "Edit source code",
    "Run terminal commands",
    "Search codebase",
    "Manage tasks",
  ], { style: "star" }));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Task Lists
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Task List:", theme.cyan));
  console.log(taskList([
    { text: "Initialize project structure", status: "completed" },
    { text: "Set up TypeScript configuration", status: "completed" },
    { text: "Implement core AI functionality", status: "completed" },
    { text: "Add beautiful TUI with charsm", status: "in_progress" },
    { text: "Write comprehensive tests", status: "pending" },
    { text: "Deploy to npm", status: "pending" },
  ]));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Code Blocks
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Code Block:", theme.cyan));
  console.log(codeBlock(
    `import { initCharm, table, alert } from "./charm-tui";

async function main() {
  await initCharm();
  console.log(alert("Hello, Charm!", "success"));
}`,
    "typescript"
  ));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // File Paths
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("File Operations:", theme.cyan));
  console.log("  " + filePath("src/components/charm-tui.ts", "read"));
  console.log("  " + filePath("src/cli.ts", "edit"));
  console.log("  " + filePath("dist/index.js", "write"));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Key-Value Pairs
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Key-Value Display:", theme.cyan));
  console.log("  " + keyValue("Provider", colored("Anthropic", theme.yellow)));
  console.log("  " + keyValue("Model", colored("claude-sonnet-4-20250514", theme.green)));
  console.log("  " + keyValue("Tokens", colored("45.2K", theme.cyan)));
  console.log("  " + keyValue("Duration", duration(3450)));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Boxes
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Styled Boxes:", theme.cyan));
  console.log(box("A simple rounded box with some content inside.", {
    borderStyle: "round",
    padding: { top: 0, right: 2, bottom: 0, left: 2 },
  }));
  console.log(box(
    bold("Important Notice", theme.warning) + "\n" +
    "This is a double-bordered box for emphasis.",
    { borderStyle: "double", padding: { top: 0, right: 2, bottom: 0, left: 2 } }
  ));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Tool Results
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Tool Execution Results:", theme.cyan));
  console.log(await renderToolResult({
    name: "read_file",
    status: "success",
    output: "File contents read successfully (256 lines)",
    duration: 45,
    metadata: { path: "src/cli.ts", lines: "1-256" },
  }));
  console.log(await renderToolResult({
    name: "run_command",
    status: "running",
    metadata: { command: "pnpm build" },
  }));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Plan Rendering
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Task Plan:", theme.cyan));
  console.log(await renderPlan("Implement New Feature", [
    { description: "Research requirements", status: "completed" },
    { description: "Design architecture", status: "completed" },
    { description: "Write implementation", status: "in_progress" },
    { description: "Add unit tests", status: "pending" },
    { description: "Update documentation", status: "pending" },
  ]));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Session Info
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Session Information:", theme.cyan));
  console.log(await renderSessionInfo({
    name: "feature-development",
    model: "claude-sonnet-4-20250514",
    provider: "Anthropic",
    mode: "Agent",
    messageCount: 24,
    tokensUsed: 45200,
    contextWindow: 200000,
    duration: 1234567,
  }));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Help Section
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Help Commands:", theme.cyan));
  console.log(await renderHelp([
    { command: "/help", description: "Show this help message" },
    { command: "/models", description: "Switch AI model" },
    { command: "/clear", description: "Clear conversation history" },
    { command: "/save", description: "Save current session" },
    { command: "/exit", description: "Exit the application" },
  ]));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Markdown Rendering
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Markdown Rendering:", theme.cyan));
  const markdown = `
# Welcome to ErzenCode

This is a **beautiful** terminal UI built with *charsm*.

## Features

- Beautiful styled output
- Tables and lists
- Progress indicators
- Markdown rendering

### Code Example

\`\`\`typescript
const result = await ai.generate({
  prompt: "Hello, world!"
});
\`\`\`

> "Make the command line glamorous" - Charm
`;
  
  console.log(await renderAssistantMessage(markdown));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Notifications
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Notifications:", theme.cyan));
  console.log(await renderSuccess("Build completed successfully!"));
  console.log(await renderError("Failed to connect to API", "Check your network connection and API key."));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Dividers
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(bold("Divider Styles:", theme.cyan));
  console.log("  Line:   " + divider(30, "line"));
  console.log("  Dots:   " + divider(30, "dots"));
  console.log("  Dashes: " + divider(30, "dashes"));
  console.log("\n");
  
  // ══════════════════════════════════════════════════════════════════════════
  // Finale
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log(divider(60));
  console.log("\n" + box(
    bold("✨ Charm TUI Demo Complete!", theme.success) + "\n\n" +
    dim("Built with chalk, boxen & gradient-string") + "\n" +
    dim("Inspired by https://charm.land/"),
    { borderStyle: "double", padding: { top: 0, right: 2, bottom: 0, left: 2 } }
  ));
  console.log("\n");
}

// Run the demo
demo().catch(console.error);
