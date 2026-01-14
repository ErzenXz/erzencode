/**
 * ErzenCode VSCode Extension
 * Main entry point for the VSCode extension
 */

import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar/SidebarProvider.js";
import { SettingsViewProvider } from "./webview/SettingsViewProvider.js";
import { registerCommands } from "./commands/index.js";
import {
  ConfigService,
  SecretStorageService,
  SessionService,
} from "./services/index.js";

// Store service instances for global access
let configService: ConfigService;
let secretStorageService: SecretStorageService;
let sessionService: SessionService;

export function activate(context: vscode.ExtensionContext) {
  console.log("ErzenCode extension is now active!");

  // Initialize core services
  initializeServices(context).then(() => {
    console.log("All services initialized successfully");
  }).catch((error) => {
    console.error("Failed to initialize services:", error);
    vscode.window.showErrorMessage(
      `Failed to initialize ErzenCode: ${error instanceof Error ? error.message : String(error)}`
    );
  });

  // Create sidebar provider
  const sidebarProvider = new SidebarProvider(context, configService, secretStorageService, sessionService);

  // Create settings provider
  const settingsProvider = new SettingsViewProvider(context, configService, secretStorageService, sessionService);

  // Register sidebar view
  const sidebarRegistration = vscode.window.registerWebviewViewProvider(
    "erzencode.chatView",
    sidebarProvider
  );

  // Register commands
  const commandRegistrations = registerCommands(
    context,
    sidebarProvider,
    settingsProvider,
    configService,
    secretStorageService,
    sessionService
  );

  // Register all disposables
  context.subscriptions.push(
    sidebarRegistration,
    ...commandRegistrations,
    configService,
    secretStorageService,
    sessionService
  );

  // Show welcome message on first install
  showWelcomeMessage(context);
}

/**
 * Initialize all core services
 */
async function initializeServices(context: vscode.ExtensionContext): Promise<void> {
  // 1. Initialize ConfigService
  configService = new ConfigService(context);
  await configService.initialize();
  console.log("ConfigService initialized");

  // 2. Initialize SecretStorageService
  secretStorageService = new SecretStorageService(context, context.secrets);
  await secretStorageService.initialize();
  console.log("SecretStorageService initialized");

  // 3. Initialize SessionService
  sessionService = new SessionService(context);
  await sessionService.initialize();
  console.log("SessionService initialized");

  // Log current configuration status
  const config = await configService.loadLocalConfig();
  const providersWithKeys = await secretStorageService.listProvidersWithKeys();
  const sessions = sessionService.getAllSessions();

  console.log("Current configuration:", {
    provider: config.provider,
    model: config.model,
    mode: config.mode,
    providersConfigured: providersWithKeys.length,
    totalSessions: sessions.length,
  });
}

/**
 * Show welcome message on first install
 */
function showWelcomeMessage(context: vscode.ExtensionContext): void {
  const hasShownWelcome = context.globalState.get<boolean>("hasShownWelcome");

  if (!hasShownWelcome) {
    vscode.window.showInformationMessage(
      "Welcome to ErzenCode AI Assistant! Get started by opening settings to configure your API key.",
      "Open Settings",
      "Learn More"
    ).then((selection) => {
      if (selection === "Open Settings") {
        vscode.commands.executeCommand("erzencode.openSettings");
      } else if (selection === "Learn More") {
        vscode.env.openExternal(vscode.Uri.parse("https://github.com/ErzenXz/erzencode#readme"));
      }

      // Mark that we've shown the welcome message
      context.globalState.update("hasShownWelcome", true);
    });
  }
}

/**
 * Export services for use in other parts of the extension
 */
export function getServices(): {
  configService: ConfigService;
  secretStorageService: SecretStorageService;
  sessionService: SessionService;
} {
  return {
    configService,
    secretStorageService,
    sessionService,
  };
}

export function deactivate() {
  console.log("ErzenCode extension is now deactivated");

  // Services are automatically disposed via context.subscriptions
}
