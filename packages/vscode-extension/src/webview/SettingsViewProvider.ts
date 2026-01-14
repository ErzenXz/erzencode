/**
 * SettingsViewProvider - Webview provider for ErzenCode settings UI
 * Manages the React-based settings panel
 */

import * as vscode from "vscode";
import type { ConfigService } from "../services/ConfigService.js";
import type { SecretStorageService } from "../services/SecretStorageService.js";
import type { SessionService } from "../services/SessionService.js";
import type { WebviewMessagingService } from "../services/WebviewMessagingService.js";

export class SettingsViewProvider {
  private currentPanel?: vscode.WebviewPanel;
  private messaging?: WebviewMessagingService;

  constructor(
    private context: vscode.ExtensionContext,
    private configService: ConfigService,
    private secretStorageService: SecretStorageService,
    private sessionService: SessionService
  ) {}

  /**
   * Show or create the settings webview panel
   */
  public async show(): Promise<void> {
    // If already open, focus it
    if (this.currentPanel) {
      this.currentPanel.reveal();
      return;
    }

    // Create the panel
    this.currentPanel = vscode.window.createWebviewPanel(
      "erzencode.settings",
      "ErzenCode Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "dist/settings"),
        ],
      }
    );

    // Set the webview content
    this.currentPanel.webview.html = this.getWebviewContent(this.currentPanel.webview);

    // Setup message handlers
    this.setupMessageHandlers(this.currentPanel);

    // Handle panel close
    this.currentPanel.onDidDispose(() => {
      this.currentPanel = undefined;
      this.messaging?.dispose();
    });
  }

  /**
   * Setup message handlers for the webview
   */
  private setupMessageHandlers(panel: vscode.WebviewPanel): void {
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "ready":
          await this.handleReady();
          break;

        case "config/get":
          await this.handleGetConfig();
          break;

        case "config/update":
          await this.handleUpdateConfig(message.data);
          break;

        case "apiKey/set":
          await this.handleSetApiKey(message.data);
          break;

        case "apiKey/get":
          await this.handleGetApiKey(message.data);
          break;

        case "apiKey/delete":
          await this.handleDeleteApiKey(message.data);
          break;

        case "apiKey/list":
          await this.handleListApiKeys();
          break;

        case "session/list":
          await this.handleListSessions();
          break;

        case "session/create":
          await this.handleCreateSession(message.data);
          break;

        case "session/delete":
          await this.handleDeleteSession(message.data);
          break;

        case "session/export":
          await this.handleExportSession(message.data);
          break;
      }
    });
  }

  /**
   * Handle webview ready - send initial state
   */
  private async handleReady(): Promise<void> {
    const config = await this.configService.loadLocalConfig();
    const globalConfig = await this.configService.loadGlobalConfig();
    const providersWithKeys = await this.secretStorageService.listProvidersWithKeys();
    const sessions = this.sessionService.getAllSessions();
    const configPaths = this.configService.getConfigPaths();

    this.postMessage({
      type: "init",
      data: {
        config,
        globalConfig,
        providersWithKeys,
        sessions,
        configPaths,
      },
    });
  }

  /**
   * Get current config
   */
  private async handleGetConfig(): Promise<void> {
    const config = await this.configService.loadLocalConfig();
    this.postMessage({
      type: "config/response",
      data: { success: true, config },
    });
  }

  /**
   * Update config
   */
  private async handleUpdateConfig(data: any): Promise<void> {
    try {
      const currentConfig = await this.configService.loadLocalConfig();
      const updatedConfig = { ...currentConfig, ...data };
      await this.configService.saveLocalConfig(updatedConfig);

      this.postMessage({
        type: "config/response",
        data: { success: true, config: updatedConfig },
      });

      vscode.window.showInformationMessage("Configuration saved");
    } catch (error) {
      this.postMessage({
        type: "config/response",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Set API key
   */
  private async handleSetApiKey(data: { provider: string; key: string }): Promise<void> {
    try {
      await this.secretStorageService.setApiKey(data.provider, data.key);

      // Update config to use this provider
      const config = await this.configService.loadLocalConfig();
      config.provider = data.provider as any;
      await this.configService.saveLocalConfig(config);

      this.postMessage({
        type: "apiKey/response",
        data: { success: true, provider: data.provider },
      });
    } catch (error) {
      this.postMessage({
        type: "apiKey/response",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Get API key
   */
  private async handleGetApiKey(data: { provider: string }): Promise<void> {
    try {
      const hasKey = await this.secretStorageService.hasApiKey(data.provider);

      this.postMessage({
        type: "apiKey/response",
        data: { success: true, provider: data.provider, hasKey },
      });
    } catch (error) {
      this.postMessage({
        type: "apiKey/response",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Delete API key
   */
  private async handleDeleteApiKey(data: { provider: string }): Promise<void> {
    try {
      await this.secretStorageService.deleteApiKey(data.provider);

      this.postMessage({
        type: "apiKey/response",
        data: { success: true, provider: data.provider, hasKey: false },
      });
    } catch (error) {
      this.postMessage({
        type: "apiKey/response",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * List all API keys
   */
  private async handleListApiKeys(): Promise<void> {
    try {
      const providers = await this.secretStorageService.listProvidersWithKeys();
      const statuses = await this.secretStorageService.getProviderStatuses([
        "anthropic",
        "openai",
        "google",
        "xai",
        "openrouter",
        "groq",
        "together",
        "fireworks",
        "deepseek",
        "mistral",
        "perplexity",
        "cohere",
      ]);

      this.postMessage({
        type: "apiKey/list",
        data: { providers, statuses },
      });
    } catch (error) {
      this.postMessage({
        type: "apiKey/list",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * List sessions
   */
  private async handleListSessions(): Promise<void> {
    try {
      const sessions = this.sessionService.getAllSessions();
      const stats = this.sessionService.getStats();

      this.postMessage({
        type: "session/list",
        data: { sessions, stats },
      });
    } catch (error) {
      this.postMessage({
        type: "session/list",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Create session
   */
  private async handleCreateSession(data: { name?: string }): Promise<void> {
    try {
      const session = await this.sessionService.createSession(data);

      this.postMessage({
        type: "session/created",
        data: { session },
      });
    } catch (error) {
      this.postMessage({
        type: "session/error",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Delete session
   */
  private async handleDeleteSession(data: { sessionId: string }): Promise<void> {
    try {
      await this.sessionService.deleteSession(data.sessionId);

      this.postMessage({
        type: "session/deleted",
        data: { sessionId: data.sessionId },
      });
    } catch (error) {
      // User might have cancelled, ignore
    }
  }

  /**
   * Export session
   */
  private async handleExportSession(data: {
    sessionId: string;
    format: "json" | "markdown";
  }): Promise<void> {
    try {
      const exported = await this.sessionService.exportSession(
        data.sessionId,
        { format: data.format }
      );

      this.postMessage({
        type: "session/exported",
        data: { sessionId: data.sessionId, content: exported },
      });
    } catch (error) {
      this.postMessage({
        type: "session/error",
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Post message to webview
   */
  private postMessage(message: any): void {
    this.currentPanel?.webview.postMessage(message);
  }

  /**
   * Get webview HTML content
   */
  private getWebviewContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist/settings/assets/index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist/settings/assets/index.css")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-eval' 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource};">
  <title>ErzenCode Settings</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
