#!/usr/bin/env node

/**
 * Erzencode - AI Coding CLI
 * A modern command-line interface for AI-powered coding assistance
 */

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

const MODE_COLOR = {
  plan: chalk.hex("#f59e0b"),
  agent: chalk.blue,
  ask: chalk.green,
} as const;

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
    const agentConfig = await buildAgentConfig({
      ...program.opts(),
      ...options,
    });
    if (!agentConfig) process.exit(1);

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
        } else if (event.type === "error") {
          console.error(chalk.red("\nError:"), (event.data as any).error);
        }
      }
      console.log();
    } catch (error) {
      console.error(chalk.red("Error:"), error);
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
    const configPath = resolveConfigPath(program.opts());
    const config = await loadConfig(configPath);

    console.log(chalk.cyan("\nErzencode Configuration\n"));
    console.log(chalk.gray(`Config path: ${configPath}`));
    console.log(chalk.gray(`Config dir:  ${getConfigDir()}\n`));

    if (config) {
      console.log(`Provider:    ${chalk.yellow(config.provider ?? "openai")}`);
      console.log(
        `Model:       ${chalk.green(config.model ?? DEFAULT_MODELS.openai)}`,
      );
      const modeValue = (config.mode ?? "agent") as keyof typeof MODE_COLOR;
      const modeColor = MODE_COLOR[modeValue] ?? chalk.gray;
      console.log(`Mode:        ${modeColor(config.mode ?? "agent")}`);
      console.log(
        `Thinking:    ${chalk.magenta(config.thinkingLevel ?? "off")}`,
      );
      console.log(`Renderer:    ${config.renderer ?? "markdown"}`);
      if (config.workspaceRoot) {
        console.log(`Workspace:   ${config.workspaceRoot}`);
      }
    } else {
      console.log(
        chalk.yellow(
          'No configuration found. Run "erzencode init" to create one.',
        ),
      );
    }
    console.log("");
  });

program
  .command("models [provider]")
  .description("List available models for a provider")
  .action(async (providerArg?: string) => {
    const configPath = resolveConfigPath(program.opts());
    const config = await loadConfig(configPath);
    const provider = (providerArg ??
      config?.provider ??
      "openai") as ProviderType;

    console.log(
      chalk.cyan(
        `\nModels for ${PROVIDERS.find((p) => p.id === provider)?.name ?? provider}\n`,
      ),
    );

    // Try to fetch dynamic models first
    const apiKey = getApiKey(provider);
    if (apiKey) {
      try {
        console.log(chalk.gray("Fetching models from API..."));
        const models = await fetchProviderModels(provider, apiKey);
        if (models.length > 0) {
          models.forEach((m) => console.log(`  ${chalk.green(m)}`));
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
      staticModels.forEach((m) => console.log(`  ${chalk.green(m)}`));
    } else {
      console.log(
        chalk.yellow(
          "  No preset models available. Use --allow-unknown-models with any model ID.",
        ),
      );
    }
    console.log("");
  });

program
  .command("providers")
  .description("List available providers")
  .action(() => {
    console.log(chalk.cyan("\nAvailable Providers\n"));
    PROVIDERS.forEach((p) => {
      const hasKey = getApiKey(p.id);
      const status = hasKey ? chalk.green("\u2713") : chalk.gray("\u2717");
      console.log(`  ${status} ${chalk.yellow(p.id.padEnd(12))} ${p.name}`);
    });
    console.log(chalk.gray("\n\u2713 = API key found in environment\n"));
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

async function startInkUI(options: any): Promise<void> {
  // Ensure config directories exist
  await ensureConfigDirs();

  const configPath = resolveConfigPath(options);
  const loadedConfig = await ensureConfig(configPath);

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
  console.log(chalk.cyan(`\n✓ Config loaded from ${configPath}`));
  console.log(
    chalk.gray(
      `  Provider: ${loadedConfig.provider} | Model: ${loadedConfig.model}\n`,
    ),
  );

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
  await ensureConfigDirs();

  const configPath = resolveConfigPath(options);
  const existing = await loadConfig(configPath);

  console.log(chalk.cyan("\nErzencode Configuration Wizard\n"));

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
  console.log(chalk.green(`\n\u2713 Config saved to ${configPath}\n`));
}

async function startLegacyChat(
  agentConfig: Awaited<ReturnType<typeof buildAgentConfig>>,
  options: { autoContext?: boolean },
): Promise<void> {
  if (!agentConfig) return;

  console.log(chalk.blue("\n\u{1F916} Erzencode (Legacy Chat Mode)"));
  console.log(
    chalk.gray("Type your tasks. Commands: exit, clear, reset, help\n"),
  );
  console.log(
    chalk.gray(
      `Provider: ${agentConfig.provider} | Model: ${agentConfig.model}\n`,
    ),
  );

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
    rl.question(chalk.cyan("\nYou: "), async (input) => {
      const task = input.trim();

      if (!task) {
        chat();
        return;
      }

      if (task.toLowerCase() === "exit" || task.toLowerCase() === "quit") {
        console.log(chalk.blue("\nGoodbye! \u{1F44B}\n"));
        rl.close();
        process.exit(0);
      }

      if (task.toLowerCase() === "clear") {
        console.clear();
        console.log(chalk.blue("\n\u{1F916} Erzencode\n"));
        chat();
        return;
      }

      if (task.toLowerCase() === "reset") {
        messages = [];
        console.log(chalk.yellow("\n\u{1F9F9} Conversation reset.\n"));
        chat();
        return;
      }

      if (task.toLowerCase() === "help") {
        showLegacyHelp();
        chat();
        return;
      }

      console.log(chalk.green("\nAssistant: "));

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
            if (text) process.stdout.write(chalk.gray(`\n💭 ${text}\n`));
          } else if (event.type === "tool-call") {
            const data = event.data as any;
            process.stdout.write(
              chalk.gray(`\n\u{1F527} Running: ${data.toolName}\n`),
            );
          } else if (event.type === "tool-result") {
            const data = event.data as any;
            const icon = data.isError ? "\u274C" : "\u2713";
            process.stdout.write(chalk.gray(`   ${icon} ${data.toolName}\n`));
          } else if (event.type === "error") {
            const error = (event.data as any).error ?? "Unknown error";
            console.error(chalk.red(`\nError: ${error}`));
          }
        }

        if (finalResponse) {
          messages.push({ role: "assistant", content: finalResponse });
          if (agentConfig.renderer === "markdown") {
            process.stdout.write(`\n${renderMarkdown(finalResponse)}\n`);
          }
        }
      } catch (error: any) {
        console.error(chalk.red("\n\u274C Error:"), error.message || error);
      }

      chat();
    });
  };

  rl.on("close", () => {
    console.log(chalk.blue("\nGoodbye! \u{1F44B}\n"));
    process.exit(0);
  });

  chat();
}

function showLegacyHelp(): void {
  console.log(chalk.cyan("\nAvailable commands:"));
  console.log(chalk.gray("  exit, quit  - Exit the chat"));
  console.log(chalk.gray("  clear       - Clear the screen"));
  console.log(chalk.gray("  reset       - Reset conversation memory"));
  console.log(chalk.gray("  help        - Show this help message"));
  console.log(chalk.gray("\nExample tasks:"));
  console.log(
    chalk.gray('  - "Read package.json and explain what this project does"'),
  );
  console.log(
    chalk.gray(
      '  - "Create a new TypeScript file with a hello world function"',
    ),
  );
  console.log(chalk.gray('  - "Find all TODO comments in the codebase"'));
  console.log(chalk.gray('  - "Run the tests and fix any failures"'));
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
