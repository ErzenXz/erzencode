/**
 * Agent Service for VSCode Extension
 * Manages AI agent interactions using shared core logic
 */

import * as vscode from "vscode";
import { createAIAgent, type AgentConfig } from "@erzencode/core/ai-agent.js";
import {
  loadConfig,
  resolveConfigPath,
  getApiKeyAsync,
  getBaseUrlAsync,
} from "@erzencode/core/config.js";
import { VSCodeFileSystemAdapter } from "../providers/VSCodeFileSystemAdapter.js";
import { VSCodeTerminalAdapter } from "../providers/VSCodeTerminalAdapter.js";

export class AgentService {
  private agent: any;
  private agentInitialized: boolean = false;
  private initializationPromise: Promise<void>;
  private workspaceRoot: string;
  private fsAdapter: VSCodeFileSystemAdapter;
  private terminalAdapter: VSCodeTerminalAdapter;
  private currentProvider: string = "";
  private currentModel: string = "";

  constructor(private context: vscode.ExtensionContext) {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    this.fsAdapter = new VSCodeFileSystemAdapter();
    this.terminalAdapter = new VSCodeTerminalAdapter();

    // Store the promise so we can await it later
    this.initializationPromise = this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    try {
      console.log("Initializing ErzenCode agent...");

      const configPath = resolveConfigPath({});
      console.log("Config path:", configPath);

      const config = await loadConfig(configPath);
      console.log("Loaded config:", config ? "Config found" : "No config");

      const vscodeConfig = vscode.workspace.getConfiguration("erzencode");
      const provider = (config?.provider || vscodeConfig.get("provider") || "anthropic") as AgentConfig["provider"];
      const model = config?.model || vscodeConfig.get("model") || "claude-sonnet-4-20250514";
      const mode = (config?.mode || vscodeConfig.get("mode") || "agent") as AgentConfig["mode"];

      // Store current provider and model for later use
      this.currentProvider = provider;
      this.currentModel = model;

      // Get API key using CLI's priority system (env vars → global config)
      const apiKey = await getApiKeyAsync(provider);
      console.log("API key found:", !!apiKey || provider === "ollama");

      // Get base URL using CLI's priority system
      const baseUrl = await getBaseUrlAsync(provider);

      if (!apiKey && provider !== "ollama") {
        console.warn("No API key found for provider:", provider);
        this.agentInitialized = false;
        vscode.window.showWarningMessage(
          `ErzenCode: No API key configured for ${provider}. Please run 'erzencode init' in your terminal or set the API key in ~/.erzencode/global.json. For now, using VSCode settings as fallback.`,
        );

        // Fallback to VSCode settings for backwards compatibility
        const vscodeApiKey = vscodeConfig.get(`apiKeys.${provider}`) as string | undefined;
        if (!vscodeApiKey) {
          this.agent = null;
          return;
        }

        console.log("Using VSCode settings as fallback");
        this.agent = createAIAgent({
          provider,
          model,
          mode,
          workspaceRoot: this.workspaceRoot,
          apiKey: vscodeApiKey,
          baseUrl: baseUrl || vscodeConfig.get("baseUrl") || undefined,
        });
      } else {
        this.agent = createAIAgent({
          provider,
          model,
          mode,
          workspaceRoot: this.workspaceRoot,
          apiKey: provider === "ollama" ? undefined : apiKey,
          baseUrl,
        });
      }

      // Initialize the agent (this sets up environment context)
      if (this.agent && typeof this.agent.initialize === "function") {
        await this.agent.initialize();
      }

      this.agentInitialized = true;
      console.log("ErzenCode agent initialized successfully", {
        provider,
        model,
        mode,
        hasApiKey: !!apiKey || provider === "ollama",
      });
    } catch (error) {
      console.error("Failed to initialize ErzenCode agent:", error);
      vscode.window.showErrorMessage(
        `Failed to initialize ErzenCode: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.agentInitialized = false;
    }
  }

  async *streamMessage(content: string): AsyncGenerator<any, void, unknown> {
    try {
      // Wait for agent to be initialized
      await this.initializationPromise;

      if (!this.agent || !this.agentInitialized) {
        yield {
          type: "error",
          data: {
            message: `Agent not initialized. No API key configured for provider '${this.currentProvider}'. Please run 'erzencode init' in your terminal to set up your API key.`,
          },
        };
        return;
      }

      console.log("Streaming message:", content);

      const messages = [{ role: "user", content }];

      for await (const event of this.agent.stream(messages)) {
        yield event;
      }
    } catch (error) {
      console.error("Error in streamMessage:", error);
      yield {
        type: "error",
        data: {
          message: error instanceof Error ? error.message : String(error),
          fullError: error,
        },
      };
    }
  }

  async getConfig(): Promise<any> {
    const configPath = resolveConfigPath({});
    const config = await loadConfig(configPath);
    return config;
  }

  isReady(): boolean {
    return this.agentInitialized && this.agent !== null;
  }
}
