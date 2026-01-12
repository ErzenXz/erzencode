#!/usr/bin/env node

/**
 * Erzencode - AI Coding CLI
 * A modern command-line interface for AI-powered coding assistance
 */

// IMPORTANT: must run before importing AI SDK / providers to suppress warning spam
import "./bootstrap.js";

import { Command } from "commander";
import chalk from "chalk";
import * as readline from "readline";
import { createAIAgent, type AgentConfig } from "./ai-agent.js";
import type { ProviderType } from "./ai-provider.js";
import fs from "fs/promises";
import path from "path";
import inquirer from "inquirer";
import { renderMarkdown } from "./markdown.js";
import { runErzenCodeUI } from "./ui/index.js";
import { startWebUI } from "./web-ui-new.js";
import {
  initCharm,
  theme,
  colored,
  bold,
  dim,
  box,
  table,
  list,
  kvTable,
  statusBadge,
  progressBar,
  divider,
  sectionDivider,
  header,
  alert,
  keyValue,
  gradientText,
} from "./components/charm-tui.js";
import {
  renderWelcomeBanner,
  renderHelp,
  renderError,
  renderSuccess,
  renderWarning,
} from "./components/TerminalRenderer.js";
import {
  DEFAULT_MODELS,
  MODEL_CHOICES,
  PROVIDER_CHOICES,
  PROVIDERS,
  resolveConfigPath,
  loadConfig,
  saveConfig,
  resolveThinkingConfig,
  modelSupportsThinking,
  ensureConfigDirs,
  getConfigDir,
  getApiKey,
  getApiKeyAsync,
  getBaseUrl,
  fetchProviderModels,
  isConfigComplete,
  ensureConfig,
  type ErzencodeConfig,
  type ThinkingLevel,
} from "./config.js";

const VERSION = "0.2.0";

const program = new Command();

// ============================================================================
// CLI Setup
// ============================================================================

program
  .name("erzencode")
  .description("AI-powered coding assistant CLI")
  .version(VERSION)
  .option("--config <path>", "Path to config file")
  .option("--cwd <dir>", "Working directory for file operations")
  .option(
    "--thinking <level>",
    "Thinking level: off | low | medium | high",
    "off",
  )
  .option(
    "--renderer <renderer>",
    "Output renderer: raw | markdown",
    "markdown",
  )
  .option(
    "--select-model",
    "Prompt to select provider/model before chat",
    false,
  )
  .option(
    "--web",
    "Launch web UI instead of terminal UI",
    false,
  );

// ============================================================================
// Commands
// ============================================================================

program
  .command("run")
  .description("Run a single coding task")
  .argument("<task>", "The task to perform")
  .option("-p, --provider <provider>", "AI provider", "openai")
  .option("-m, --model <model>", "Model to use")
  .option("--mode <mode>", "Mode: agent | ask | review", "agent")
  .option("--api-key <key>", "API key override")
  .option("--base-url <url>", "Custom base URL")
  .option("--providers <file>", "JSON file with ProviderConfig[]")
  .option("--allow-unknown-models", "Allow custom/unknown model IDs", false)
  .option("-v, --verbose", "Show detailed output", false)
  .action(async (task: string, options) => {
    await initCharm();
    const agentConfig = await buildAgentConfig({
      ...program.opts(),
      ...options,
    });
    if (!agentConfig) {
      console.error(alert("Configuration error. Run 'erzencode init' to set up.", "error"));
      process.exit(1);
    }

    const agent = createAIAgent(agentConfig as any);
    try {
      // Simple single-task run using stream
      const messages = [{ role: "user" as const, content: task }];
      let response = "";
      for await (const event of agent.stream(messages)) {
        if (event.type === "text-delta") {
          const text = (event.data as any).text ?? "";
          process.stdout.write(text);
          response += text;
        } else if (event.type === "tool-call") {
          const data = event.data as any;
          process.stdout.write(
            `\n${statusBadge("running", "Running")} ${colored(data.toolName, theme.cyan)}\n`,
          );
        } else if (event.type === "tool-result") {
          const data = event.data as any;
          const status = data.isError ? "error" : "success";
          process.stdout.write(`   ${statusBadge(status)} ${dim(data.toolName)}\n`);
        } else if (event.type === "error") {
          console.error("\n" + alert((event.data as any).error, "error"));
        }
      }
      console.log();
    } catch (error: any) {
      console.error("\n" + alert(`Error: ${error.message || error}`, "error"));
      process.exit(1);
    }
  });

program
  .command("chat")
  .description("Start an interactive chat session (legacy readline mode)")
  .option("-p, --provider <provider>", "AI provider", "openai")
  .option("-m, --model <model>", "Model to use")
  .option("--mode <mode>", "Mode: agent | ask | review", "agent")
  .option("--api-key <key>", "API key override")
  .option("--base-url <url>", "Custom base URL")
  .option("--providers <file>", "JSON file with ProviderConfig[]")
  .option("--allow-unknown-models", "Allow custom/unknown model IDs", false)
  .option("--auto-context", "Inject lightweight project context", false)
  .option("-v, --verbose", "Show detailed output", false)
  .action(async (options) => {
    const agentConfig = await buildAgentConfig({
      ...program.opts(),
      ...options,
    });
    if (!agentConfig) process.exit(1);

    await startLegacyChat(agentConfig, {
      autoContext: options.autoContext,
    });
  });

program
  .command("init")
  .description("Create or update Erzencode configuration")
  .action(async () => {
    await runInitWizard(program.opts());
  });

program
  .command("config")
  .description("Show current configuration")
  .action(async () => {
    await initCharm();
    const configPath = resolveConfigPath(program.opts());
    const config = await loadConfig(configPath);

    console.log("\n" + header("Erzencode Configuration"));
    console.log(dim(`  Config path: ${configPath}`));
    console.log(dim(`  Config dir:  ${getConfigDir()}`));
    console.log("");

    if (config) {
      const modeColors: Record<string, string> = {
        plan: theme.warning,
        agent: theme.info,
        ask: theme.success,
      };
      const modeValue = config.mode ?? "agent";
      const modeColor = modeColors[modeValue] ?? theme.textMuted;

      const configData = [
        ["Provider", colored(config.provider ?? "openai", theme.yellow)],
        ["Model", colored(config.model ?? DEFAULT_MODELS.openai, theme.green)],
        ["Mode", colored(modeValue, modeColor)],
        ["Thinking", colored(config.thinkingLevel ?? "off", theme.magenta)],
        ["Renderer", config.renderer ?? "markdown"],
      ];

      if (config.workspaceRoot) {
        configData.push(["Workspace", dim(config.workspaceRoot)]);
      }

      console.log(table(["Setting", "Value"], configData));
    } else {
      console.log(await renderWarning('No configuration found. Run "erzencode init" to create one.'));
    }
    console.log("");
  });

program
  .command("models [provider]")
  .description("List available models for a provider")
  .action(async (providerArg?: string) => {
    await initCharm();
    const configPath = resolveConfigPath(program.opts());
    const config = await loadConfig(configPath);
    const provider = (providerArg ??
      config?.provider ??
      "openai") as ProviderType;

    const providerName = PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
    console.log("\n" + sectionDivider(`Models for ${providerName}`, 50));
    console.log("");

    // Try to fetch dynamic models first
    const apiKey = getApiKey(provider);
    if (apiKey) {
      try {
        console.log(dim("  Fetching models from API..."));
        const models = await fetchProviderModels(provider, apiKey);
        if (models.length > 0) {
          console.log(list(models, { style: "arrow", color: theme.green }));
          console.log("");
          return;
        }
      } catch {
        // Fall back to static list
      }
    }

    // Static list
    const staticModels = MODEL_CHOICES[provider] ?? [];
    if (staticModels.length > 0) {
      console.log(list(staticModels, { style: "arrow", color: theme.green }));
    } else {
      console.log(await renderWarning("No preset models available. Use --allow-unknown-models with any model ID."));
    }
    console.log("");
  });

program
  .command("providers")
  .description("List available providers")
  .action(async () => {
    await initCharm();
    console.log("\n" + sectionDivider("Available Providers", 50));
    console.log("");

    const providerRows = PROVIDERS.map((p) => {
      const hasKey = getApiKey(p.id);
      const status = hasKey 
        ? statusBadge("success", "Ready") 
        : statusBadge("pending", "No Key");
      return [colored(p.id, theme.yellow), p.name, status];
    });

    console.log(table(["ID", "Provider", "Status"], providerRows));
    console.log(dim("\n  ✓ Ready = API key found in environment"));
    console.log("");
  });

// Default command - start Ink UI
program.action(async () => {
  await startInkUI(program.opts());
});

// ============================================================================
// Helper Functions
// ============================================================================

async function loadProvidersFile(
  filePath: string,
  baseDir: string,
): Promise<any[]> {
  const absolute = path.resolve(baseDir, filePath);
  const content = await fs.readFile(absolute, "utf-8");
  const parsed = JSON.parse(content) as any[];
  if (!Array.isArray(parsed)) {
    throw new Error(
      "Providers file must export a JSON array of provider configs",
    );
  }
  return parsed;
}

async function buildAgentConfig(options: any) {
  const configPath = resolveConfigPath(options);
  const config = await loadConfig(configPath);

  let provider = (options.provider ??
    process.env.AI_INFRA_PROVIDER ??
    config?.provider ??
    "openai") as ProviderType;

  const defaultModel = config?.model ?? DEFAULT_MODELS[provider];
  let model = options.model ?? process.env.AI_INFRA_MODEL ?? defaultModel;

  // Prompt for model selection if requested
  const shouldPromptForModel = !options.noPrompt && options.selectModel;

  if (shouldPromptForModel) {
    const selection = await promptForProviderModel(provider, model);
    if (selection) {
      provider = selection.provider;
      model = selection.model;
    }
  }

  // Check for API key: CLI option > env var > stored in global config > local config
  const apiKey =
    options.apiKey ?? (await getApiKeyAsync(provider)) ?? config?.apiKey;
  const baseUrl =
    options.baseUrl ??
    process.env.AI_INFRA_BASE_URL ??
    config?.baseUrl ??
    getBaseUrl(provider);

  const knownModels = MODEL_CHOICES[provider] ?? [];
  const modelIsKnown = knownModels.includes(model);
  let allowUnknownModels =
    options.allowUnknownModels ??
    config?.allowUnknownModels ??
    isOpenAICompatible(provider);
  if (!modelIsKnown) {
    allowUnknownModels = true;
  }

  // Determine workspace root
  const configWorkspace = config?.workspaceRoot;
  const lockWorkspace = config?.lockWorkspace ?? false;
  const defaultWorkspace =
    options.cwd ??
    process.env.AI_INFRA_WORKSPACE_ROOT ??
    process.env.INIT_CWD ??
    process.cwd();
  const workspaceRoot =
    lockWorkspace && configWorkspace ? configWorkspace : defaultWorkspace;

  const renderer = options.renderer ?? config?.renderer ?? "markdown";
  const mode = options.mode ?? config?.mode ?? "agent";
  const supportsThinking = modelSupportsThinking(provider, model);

  // Default thinking level: "medium" for reasoning models, "off" for others
  const defaultThinkingLevel: ThinkingLevel = supportsThinking
    ? "medium"
    : "off";
  const thinkingLevel = (options.thinking ??
    config?.thinkingLevel ??
    defaultThinkingLevel) as ThinkingLevel;

  // Load providers from file if specified
  let providers: any[] | undefined;
  if (options.providers) {
    try {
      providers = await loadProvidersFile(options.providers, workspaceRoot);
      // Apply overrides
      for (const p of providers) {
        if (p.type === provider) {
          if (!p.apiKey && apiKey) p.apiKey = apiKey;
          if (!p.baseUrl && baseUrl) p.baseUrl = baseUrl;
          if (!p.allowUnknownModels && allowUnknownModels)
            p.allowUnknownModels = true;
          if (!p.defaultModel && model) p.defaultModel = model;
        }
      }
    } catch (error: any) {
      console.error(
        chalk.red(`Error loading providers file: ${error.message || error}`),
      );
      return null;
    }
  }

  // Validate API key - return null silently, let caller handle it
  if (!apiKey && provider !== "ollama" && !providers) {
    return null;
  }

  return {
    apiKey,
    provider,
    model,
    baseUrl,
    allowUnknownModels,
    providers,
    mode,
    verbose: options.verbose,
    workspaceRoot,
    renderer,
    thinking: resolveThinkingConfig(thinkingLevel, supportsThinking),
  };
}

async function promptForProviderModel(
  provider: ProviderType,
  model: string,
): Promise<{ provider: ProviderType; model: string } | null> {
  const { selectedProvider } = await inquirer.prompt<{
    selectedProvider: ProviderType;
  }>([
    {
      type: "list",
      name: "selectedProvider",
      message: "Choose provider",
      choices: PROVIDERS.map((p) => ({
        name: `${p.name} ${getApiKey(p.id) ? "\u2713" : ""}`,
        value: p.id,
      })),
      default: provider,
    },
  ]);

  const presets = MODEL_CHOICES[selectedProvider] ?? [];
  const choices =
    presets.length > 0 ? [...presets, "Custom..."] : ["Custom..."];

  const { selectedModel } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedModel",
      message: "Choose model",
      choices,
      default: model,
    },
  ]);

  if (selectedModel === "Custom...") {
    const { customModel } = await inquirer.prompt([
      {
        type: "input",
        name: "customModel",
        message: "Enter model ID",
        default: model,
      },
    ]);
    return { provider: selectedProvider, model: customModel };
  }

  return { provider: selectedProvider, model: selectedModel };
}

async function startWebUIMode(options: any, loadedConfig: ErzencodeConfig): Promise<void> {
  const provider = (loadedConfig.provider ?? "anthropic") as ProviderType;
  const model = loadedConfig.model ?? DEFAULT_MODELS[provider] ?? "claude-sonnet-4-20250514";
  const workspaceRoot = options.cwd ?? process.env.AI_INFRA_WORKSPACE_ROOT ?? process.env.INIT_CWD ?? process.cwd();
  const mode = (loadedConfig.mode ?? "agent") as "agent" | "ask" | "plan";
  const supportsThinking = modelSupportsThinking(provider, model);
  const thinking = resolveThinkingConfig(
    (options.thinking ?? loadedConfig.thinkingLevel ?? "off") as ThinkingLevel,
    supportsThinking,
  );

  const baseConfig = {
    provider,
    model,
    mode,
    workspaceRoot,
    renderer: "markdown" as const,
    thinking,
    allowUnknownModels: true,
  };

  await initCharm();
  console.log(gradientText("🌐 Starting Web UI...", "primary"));
  console.log("");

  const server = await startWebUI({
    baseConfig,
    initialWorkspaceRoot: workspaceRoot,
    provider,
    model,
    mode,
    uiMode: "web",
    openBrowser: true,
  });

  console.log(colored(`✓ Web UI running at ${server.url}`, "success"));
  console.log(dim("Press Ctrl+C to stop"));
  console.log("");

  // Keep process alive
  process.on("SIGINT", async () => {
    console.log("\n" + colored("Shutting down...", "info"));
    await server.close();
    process.exit(0);
  });
}

async function startInkUI(options: any): Promise<void> {
  // Ensure config directories exist
  await ensureConfigDirs();

  const configPath = resolveConfigPath(options);
  const loadedConfig = await ensureConfig(configPath);

  // Check if web UI mode is requested
  if (options.web) {
    await startWebUIMode(options, loadedConfig);
    return;
  }

  // Only show setup if:
  // 1. --select-model flag is passed
  // 2. Config is not complete (no provider, model, or API key)
  const configComplete = await isConfigComplete(loadedConfig);
  const showSetup = Boolean(options.selectModel) || !configComplete;

  // If we're showing setup, don't require API key validation
  // The onboarding flow will ask for it
  if (showSetup) {
    // Build a minimal config for the UI - API key will be collected during onboarding
    const provider = (loadedConfig.provider ?? "anthropic") as ProviderType;
    const model =
      loadedConfig.model ??
      DEFAULT_MODELS[provider] ??
      "claude-sonnet-4-20250514";
    const workspaceRoot =
      options.cwd ??
      process.env.AI_INFRA_WORKSPACE_ROOT ??
      process.env.INIT_CWD ??
      process.cwd();

    const supportsThinking = modelSupportsThinking(provider, model);
    const baseConfig = {
      provider,
      model,
      mode: (loadedConfig.mode ?? "agent") as "agent" | "ask" | "plan",
      workspaceRoot,
      renderer: (options.renderer ?? loadedConfig.renderer ?? "markdown") as
        | "raw"
        | "markdown",
      thinking: resolveThinkingConfig(
        (options.thinking ??
          loadedConfig.thinkingLevel ??
          "off") as ThinkingLevel,
        supportsThinking,
      ),
      allowUnknownModels: true,
    };

    await runErzenCodeUI({
      baseConfig,
      configPath,
      saveableConfig: loadedConfig,
      showSetup: true,
    });
    return;
  }

  // Config is complete - go straight to chat without setup screens
  const baseConfig = await buildAgentConfig({ ...options, noPrompt: true });

  // If API key is missing, show setup flow instead of erroring
  if (!baseConfig) {
    const provider = (loadedConfig.provider ?? "anthropic") as ProviderType;
    const model =
      loadedConfig.model ??
      DEFAULT_MODELS[provider] ??
      "claude-sonnet-4-20250514";
    const workspaceRoot =
      options.cwd ??
      process.env.AI_INFRA_WORKSPACE_ROOT ??
      process.env.INIT_CWD ??
      process.cwd();

    const supportsThinking = modelSupportsThinking(provider, model);
    const fallbackConfig = {
      provider,
      model,
      mode: (loadedConfig.mode ?? "agent") as "agent" | "ask" | "plan",
      workspaceRoot,
      renderer: (options.renderer ?? loadedConfig.renderer ?? "markdown") as
        | "raw"
        | "markdown",
      thinking: resolveThinkingConfig(
        (options.thinking ??
          loadedConfig.thinkingLevel ??
          "off") as ThinkingLevel,
        supportsThinking,
      ),
      allowUnknownModels: true,
    };

    // Show setup flow to collect API key
    await runErzenCodeUI({
      baseConfig: fallbackConfig,
      configPath,
      saveableConfig: loadedConfig,
      showSetup: true,
    });
    return;
  }

  await runErzenCodeUI({
    baseConfig,
    configPath,
    saveableConfig: loadedConfig,
    showSetup: false,
  });
}

async function runInitWizard(options: any): Promise<void> {
  await initCharm();
  await ensureConfigDirs();

  const configPath = resolveConfigPath(options);
  const existing = await loadConfig(configPath);

  console.log("\n" + gradientText("✨ Erzencode Configuration Wizard", "primary"));
  console.log(divider(40));
  console.log("");

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "Default provider",
      default: existing?.provider ?? "openai",
      choices: PROVIDERS.map((p) => ({
        name: `${p.name} ${getApiKey(p.id) ? "\u2713" : ""}`,
        value: p.id,
      })),
    },
    {
      type: "list",
      name: "mode",
      message: "Default mode",
      default: existing?.mode ?? "agent",
      choices: [
        { name: "agent - Full access (read, write, execute)", value: "agent" },
        { name: "ask - Read-only (answer questions)", value: "ask" },
        { name: "review - Analysis mode (recommendations)", value: "review" },
      ],
    },
    {
      type: "list",
      name: "thinkingLevel",
      message: "Thinking level",
      default: existing?.thinkingLevel ?? "off",
      choices: [
        { name: "off - No extended thinking", value: "off" },
        { name: "low - Light reasoning (1K tokens)", value: "low" },
        { name: "medium - Moderate reasoning (4K tokens)", value: "medium" },
        { name: "high - Deep reasoning (16K tokens)", value: "high" },
      ],
    },
    {
      type: "list",
      name: "renderer",
      message: "Output renderer",
      default: existing?.renderer ?? "markdown",
      choices: ["markdown", "raw"],
    },
  ]);

  const nextConfig: ErzencodeConfig = {
    ...existing,
    model:
      existing?.model ??
      DEFAULT_MODELS[answers.provider as ProviderType] ??
      "gpt-4o",
    ...answers,
  };

  await saveConfig(configPath, nextConfig);
  console.log("\n" + alert(`Config saved to ${configPath}`, "success"));
  console.log("");
}

async function startLegacyChat(
  agentConfig: Awaited<ReturnType<typeof buildAgentConfig>>,
  options: { autoContext?: boolean },
): Promise<void> {
  if (!agentConfig) return;

  await initCharm();

  console.log("\n" + await renderWelcomeBanner("Erzencode", VERSION, "Legacy Chat Mode"));
  console.log("");
  console.log(box(
    keyValue("Provider", colored(agentConfig.provider, theme.yellow)) + "  " +
    keyValue("Model", colored(agentConfig.model, theme.green)),
    { borderStyle: "round", padding: { top: 0, right: 1, bottom: 0, left: 1 } }
  ));
  console.log(dim("  Type your tasks. Commands: exit, clear, reset, help\n"));

  const agent = createAIAgent(agentConfig as any);

  const contextSummary = options.autoContext
    ? await buildContextSummary(agentConfig.workspaceRoot ?? process.cwd())
    : null;

  let messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const chat = async (): Promise<void> => {
    rl.question(colored("\n❯ ", theme.primary), async (input) => {
      const task = input.trim();

      if (!task) {
        chat();
        return;
      }

      if (task.toLowerCase() === "exit" || task.toLowerCase() === "quit") {
        console.log("\n" + alert("Goodbye! 👋", "info"));
        rl.close();
        process.exit(0);
      }

      if (task.toLowerCase() === "clear") {
        console.clear();
        console.log("\n" + bold("🤖 Erzencode", theme.primary) + "\n");
        chat();
        return;
      }

      if (task.toLowerCase() === "reset") {
        messages = [];
        console.log("\n" + alert("Conversation reset.", "warning"));
        chat();
        return;
      }

      if (task.toLowerCase() === "help") {
        await showLegacyHelp();
        chat();
        return;
      }

      console.log("\n" + bold("Assistant", theme.success) + "\n");

      try {
        messages.push({ role: "user", content: task });
        let finalResponse = "";

        const streamRaw = agentConfig.renderer !== "markdown";
        for await (const event of agent.stream(messages)) {
          if (event.type === "text-delta") {
            const chunk = (event.data as any).text ?? "";
            if (chunk && streamRaw) process.stdout.write(chunk);
            finalResponse += chunk;
          } else if (event.type === "reasoning") {
            const text = (event.data as any).text ?? "";
            if (text) process.stdout.write(colored(`\n💭 ${text}\n`, theme.magenta));
          } else if (event.type === "tool-call") {
            const data = event.data as any;
            process.stdout.write(
              `\n${statusBadge("running", "Running")} ${colored(data.toolName, theme.cyan)}\n`,
            );
          } else if (event.type === "tool-result") {
            const data = event.data as any;
            const status = data.isError ? "error" : "success";
            process.stdout.write(`   ${statusBadge(status)} ${dim(data.toolName)}\n`);
          } else if (event.type === "error") {
            const error = (event.data as any).error ?? "Unknown error";
            console.error("\n" + alert(`Error: ${error}`, "error"));
          }
        }

        if (finalResponse) {
          messages.push({ role: "assistant", content: finalResponse });
          if (agentConfig.renderer === "markdown") {
            process.stdout.write(`\n${renderMarkdown(finalResponse)}\n`);
          }
        }
      } catch (error: any) {
        console.error("\n" + alert(`Error: ${error.message || error}`, "error"));
      }

      chat();
    });
  };

  rl.on("close", () => {
    console.log("\n" + alert("Goodbye! 👋", "info"));
    process.exit(0);
  });

  chat();
}

async function showLegacyHelp(): Promise<void> {
  console.log("\n" + sectionDivider("Help", 40));
  console.log("");

  const commands = [
    { command: "exit, quit", description: "Exit the chat" },
    { command: "clear", description: "Clear the screen" },
    { command: "reset", description: "Reset conversation memory" },
    { command: "help", description: "Show this help message" },
  ];

  console.log(await renderHelp(commands));
  console.log("");

  console.log(bold("Example Tasks", theme.cyan));
  const examples = [
    '"Read package.json and explain what this project does"',
    '"Create a new TypeScript file with a hello world function"',
    '"Find all TODO comments in the codebase"',
    '"Run the tests and fix any failures"',
  ];
  console.log(list(examples, { style: "arrow", color: theme.textMuted }));
  console.log("");
}

async function buildContextSummary(root: string): Promise<string> {
  const summary: string[] = [];

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const names = entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .slice(0, 50);
    summary.push(`Project root: ${root}`);
    summary.push(`Top-level entries: ${names.join(", ")}`);
  } catch {
    // Ignore directory listing failures
  }

  const packageJsonPath = path.join(root, "package.json");
  try {
    const pkgRaw = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(pkgRaw) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    summary.push(`Package name: ${pkg.name ?? "unknown"}`);
    if (pkg.scripts) {
      summary.push(`Scripts: ${Object.keys(pkg.scripts).join(", ")}`);
    }
    if (pkg.dependencies) {
      summary.push(
        `Dependencies: ${Object.keys(pkg.dependencies).slice(0, 20).join(", ")}`,
      );
    }
  } catch {
    // Ignore package.json parsing failures
  }

  const readmePath = path.join(root, "README.md");
  try {
    const readme = await fs.readFile(readmePath, "utf-8");
    summary.push("README excerpt:");
    summary.push(readme.split("\n").slice(0, 40).join("\n"));
  } catch {
    // README not required
  }

  return `Project context (auto):\n${summary.join("\n")}`;
}

function isOpenAICompatible(provider: string): boolean {
  return [
    "openrouter",
    "together",
    "fireworks",
    "xai",
    "perplexity",
    "groq",
    "mistral",
    "cohere",
    "deepseek",
  ].includes(provider);
}

// Parse and run
program.parse();
