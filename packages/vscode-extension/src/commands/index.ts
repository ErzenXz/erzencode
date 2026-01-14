/**
 * VSCode Command Registration
 */

import * as vscode from "vscode";
import type { SidebarProvider } from "../sidebar/SidebarProvider.js";
import type { SettingsViewProvider } from "../webview/SettingsViewProvider.js";
import type { ConfigService } from "../services/ConfigService.js";
import type { SecretStorageService } from "../services/SecretStorageService.js";
import type { SessionService } from "../services/SessionService.js";

export function registerCommands(
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider,
  settings: SettingsViewProvider,
  configService: ConfigService,
  secretStorageService: SecretStorageService,
  sessionService: SessionService
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Open chat sidebar
  const openChat = vscode.commands.registerCommand("erzencode.openChat", () => {
    vscode.commands.executeCommand("erzencode.chatView.focus");
  });

  // Quick chat with input box
  const quickChat = vscode.commands.registerCommand(
    "erzencode.quickChat",
    async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Ask ErzenCode",
        placeHolder: "What do you need help with?",
      });

      if (input) {
        // Focus the sidebar and send the message
        await vscode.commands.executeCommand("erzencode.chatView.focus");
        sidebar.sendMessage(input);
      }
    }
  );

  // Explain selected code
  const explainCode = vscode.commands.registerCommand(
    "erzencode.explainCode",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          "Please select some code to explain"
        );
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showWarningMessage(
          "Please select some code to explain"
        );
        return;
      }

      // Focus sidebar and send explanation request
      await vscode.commands.executeCommand("erzencode.chatView.focus");
      sidebar.sendMessage(
        `Explain this code:\n\`\`\`\n${selectedText}\n\`\`\``
      );
    }
  );

  // Fix selected code
  const fixCode = vscode.commands.registerCommand("erzencode.fixCode", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Please select some code to fix");
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
      vscode.window.showWarningMessage("Please select some code to fix");
      return;
    }

    // Focus sidebar and send fix request
    await vscode.commands.executeCommand("erzencode.chatView.focus");
    sidebar.sendMessage(
      `Fix this code:\n\`\`\`\n${selectedText}\n\`\`\``
    );
  });

  // New session
  const newSession = vscode.commands.registerCommand(
    "erzencode.newSession",
    async () => {
      try {
        const session = await sessionService.createSession();
        vscode.window.showInformationMessage(`Created new session: ${session.name}`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create session: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Open settings webview
  const openSettings = vscode.commands.registerCommand(
    "erzencode.openSettings",
    async () => {
      await settings.show();
    }
  );

  // Set API key command
  const setApiKey = vscode.commands.registerCommand(
    "erzencode.setApiKey",
    async () => {
      await setApiKeyCommand(configService, secretStorageService);
    }
  );

  // Switch provider command
  const switchProvider = vscode.commands.registerCommand(
    "erzencode.switchProvider",
    async () => {
      const providers = [
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
        "copilot",
        "ollama",
      ];

      const selected = await vscode.window.showQuickPick(providers, {
        placeHolder: "Select an AI provider",
      });

      if (selected) {
        const config = await configService.loadLocalConfig();
        config.provider = selected as any;
        await configService.saveLocalConfig(config);
        vscode.window.showInformationMessage(`Switched to ${selected}`);
      }
    }
  );

  // Switch model command
  const switchModel = vscode.commands.registerCommand(
    "erzencode.switchModel",
    async () => {
      const config = await configService.loadLocalConfig();
      const currentModel = config.model || "";

      const input = await vscode.window.showInputBox({
        prompt: "Enter model ID",
        value: currentModel,
        placeHolder: "e.g., claude-sonnet-4-20250514",
      });

      if (input !== undefined) {
        config.model = input;
        await configService.saveLocalConfig(config);
        vscode.window.showInformationMessage(`Model switched to ${input}`);
      }
    }
  );

  disposables.push(
    openChat,
    quickChat,
    explainCode,
    fixCode,
    newSession,
    openSettings,
    setApiKey,
    switchProvider,
    switchModel
  );

  return disposables;
}

/**
 * Helper: Set API key command
 */
async function setApiKeyCommand(
  configService: ConfigService,
  secretStorageService: SecretStorageService
): Promise<void> {
  const providers = [
    { label: "Anthropic (Claude)", value: "anthropic" },
    { label: "OpenAI (GPT)", value: "openai" },
    { label: "Google (Gemini)", value: "google" },
    { label: "xAI (Grok)", value: "xai" },
    { label: "OpenRouter", value: "openrouter" },
    { label: "Groq", value: "groq" },
    { label: "Together AI", value: "together" },
    { label: "Fireworks AI", value: "fireworks" },
    { label: "DeepSeek", value: "deepseek" },
    { label: "Mistral AI", value: "mistral" },
    { label: "Perplexity", value: "perplexity" },
    { label: "Cohere", value: "cohere" },
  ];

  const selected = await vscode.window.showQuickPick(providers, {
    placeHolder: "Select a provider",
  });

  if (!selected) {
    return;
  }

  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter ${selected.label} API key`,
    password: true,
    placeHolder: "Paste your API key here",
  });

  if (apiKey) {
    await secretStorageService.setApiKey(selected.value, apiKey);

    // Update config to use this provider
    const config = await configService.loadLocalConfig();
    config.provider = selected.value as any;
    await configService.saveLocalConfig(config);
  }
}

/**
 * Helper: View sessions command
 */
async function viewSessionsCommand(sessionService: SessionService): Promise<void> {
  const sessions = sessionService.getAllSessions();

  if (sessions.length === 0) {
    vscode.window.showInformationMessage("No sessions found. Create a new session to get started!");
    return;
  }

  const items = sessions.map((session) => ({
    label: session.name,
    description: `${session.messages.length} messages`,
    detail: new Date(session.updatedAt).toLocaleString(),
    sessionId: session.id,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a session",
  });

  if (selected) {
    const session = sessionService.loadSession(selected.sessionId);
    if (session) {
      vscode.window.showInformationMessage(`Loaded session: ${session.name}`);
    }
  }
}
