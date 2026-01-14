/**
 * ConfigService - Centralized configuration file management
 * Handles loading, saving, and validating Erzencode config files
 */

import * as vscode from "vscode";
import {
  getConfigDir,
  getDataDir,
  resolveConfigPath,
  getGlobalConfigPath,
  getSessionsPath,
  ensureConfigDirs,
  loadConfig,
  loadGlobalConfig,
  saveConfig,
  saveGlobalConfig,
  createDefaultConfig,
  type ErzencodeConfig,
  type GlobalConfig,
} from "@erzencode/core/config.js";

export interface ConfigEvents {
  configChanged: (config: ErzencodeConfig) => void;
  globalConfigChanged: (config: GlobalConfig) => void;
  configCreated: () => void;
}

export class ConfigService {
  private configPath: string;
  private globalConfigPath: string;
  private sessionsPath: string;
  private configWatcher?: vscode.FileSystemWatcher;
  private globalConfigWatcher?: vscode.FileSystemWatcher;
  private _onConfigChanged = new vscode.EventEmitter<ErzencodeConfig>();
  private _onGlobalConfigChanged = new vscode.EventEmitter<GlobalConfig>();
  private _onConfigCreated = new vscode.EventEmitter<void>();

  readonly onConfigChanged = this._onConfigChanged.event;
  readonly onGlobalConfigChanged = this._onGlobalConfigChanged.event;
  readonly onConfigCreated = this._onConfigCreated.event;

  constructor(private context: vscode.ExtensionContext) {
    this.configPath = resolveConfigPath({});
    this.globalConfigPath = getGlobalConfigPath();
    this.sessionsPath = getSessionsPath();
  }

  /**
   * Initialize the config service
   * Ensures config directories exist and creates default config if needed
   */
  async initialize(): Promise<void> {
    await this.ensureConfigExists();
    this.setupFileWatchers();
  }

  /**
   * Load local config from ~/.erzencode/config.json
   */
  async loadLocalConfig(): Promise<ErzencodeConfig> {
    try {
      const config = await loadConfig(this.configPath);
      if (!config) {
        // Config doesn't exist, create default
        return await this.createDefaultConfig();
      }
      return config;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}`
      );
      return createDefaultConfig();
    }
  }

  /**
   * Save local config to ~/.erzencode/config.json
   */
  async saveLocalConfig(config: ErzencodeConfig): Promise<void> {
    try {
      await saveConfig(this.configPath, config);
      this._onConfigChanged.fire(config);
    } catch (error) {
      throw new Error(
        `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load global config from ~/.erzencode/global.json
   */
  async loadGlobalConfig(): Promise<GlobalConfig> {
    try {
      return await loadGlobalConfig();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load global config: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  /**
   * Save global config to ~/.erzencode/global.json
   */
  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    try {
      await saveGlobalConfig(config);
      this._onGlobalConfigChanged.fire(config);
    } catch (error) {
      throw new Error(
        `Failed to save global config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensure config directories and default config exist
   * Creates ~/.erzencode/config.json if it doesn't exist
   */
  async ensureConfigExists(): Promise<ErzencodeConfig> {
    await ensureConfigDirs();

    let config = await loadConfig(this.configPath);
    if (!config) {
      config = createDefaultConfig();
      await saveConfig(this.configPath, config);
      this._onConfigCreated.fire();
      vscode.window.showInformationMessage(
        "Created default Erzencode configuration at ~/.erzencode/config.json"
      );
    }

    // Ensure global config exists
    let globalConfig = await loadGlobalConfig();
    if (!globalConfig || Object.keys(globalConfig).length === 0) {
      globalConfig = {};
      await saveGlobalConfig(globalConfig);
    }

    return config;
  }

  /**
   * Create default config and save it
   */
  async createDefaultConfig(): Promise<ErzencodeConfig> {
    const config = createDefaultConfig();
    await this.saveLocalConfig(config);
    return config;
  }

  /**
   * Validate config structure
   * Returns validation result with errors if any
   */
  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config || typeof config !== "object") {
      return { valid: false, errors: ["Config is not an object"] };
    }

    const c = config as Partial<ErzencodeConfig>;

    // Validate provider
    if (c.provider && typeof c.provider !== "string") {
      errors.push("Provider must be a string");
    }

    // Validate model
    if (c.model && typeof c.model !== "string") {
      errors.push("Model must be a string");
    }

    // Validate mode
    if (c.mode && !["agent", "ask", "plan"].includes(c.mode)) {
      errors.push("Mode must be one of: agent, ask, plan");
    }

    // Validate thinking level
    if (c.thinkingLevel && !["off", "low", "medium", "high"].includes(c.thinkingLevel)) {
      errors.push("Thinking level must be one of: off, low, medium, high");
    }

    // Validate theme
    if (c.theme && typeof c.theme !== "string") {
      errors.push("Theme must be a string");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Merge local and global config with priority
   * Local config takes precedence over global config
   */
  mergeConfigs(local: ErzencodeConfig, global: GlobalConfig): ErzencodeConfig & { global: GlobalConfig } {
    return {
      ...local,
      // Use global defaults if local doesn't have them
      provider: local.provider || global.defaultProvider,
      model: local.model || global.defaultModel,
      global,
    };
  }

  /**
   * Get config file paths for display
   */
  getConfigPaths(): { config: string; global: string; sessions: string; configDir: string; dataDir: string } {
    return {
      config: this.configPath,
      global: this.globalConfigPath,
      sessions: this.sessionsPath,
      configDir: getConfigDir(),
      dataDir: getDataDir(),
    };
  }

  /**
   * Open config file in VSCode editor
   */
  async openConfigFile(type: "local" | "global"): Promise<void> {
    const path = type === "local" ? this.configPath : this.globalConfigPath;

    try {
      // Ensure file exists
      if (type === "local") {
        await this.ensureConfigExists();
      }

      const uri = vscode.Uri.file(path);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open ${type} config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reset config to defaults
   * Warning: This will overwrite existing config
   */
  async resetConfig(type: "local" | "global"): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure you want to reset the ${type} config to defaults? This will overwrite your current configuration.`,
      { modal: true },
      "Reset",
      "Cancel"
    );

    if (confirmed === "Reset") {
      if (type === "local") {
        const config = createDefaultConfig();
        await this.saveLocalConfig(config);
      } else {
        await this.saveGlobalConfig({});
      }
      vscode.window.showInformationMessage(`${type === "local" ? "Local" : "Global"} config reset to defaults`);
    }
  }

  /**
   * Setup file watchers for config changes
   */
  private setupFileWatchers(): void {
    // Watch local config
    const configUri = vscode.Uri.file(this.configPath);
    this.configWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(configUri.fsPath, "*")
    );

    this.configWatcher.onDidChange(async () => {
      const config = await this.loadLocalConfig();
      this._onConfigChanged.fire(config);
    });

    // Watch global config
    const globalConfigUri = vscode.Uri.file(this.globalConfigPath);
    this.globalConfigWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(globalConfigUri.fsPath, "*")
    );

    this.globalConfigWatcher.onDidChange(async () => {
      const config = await this.loadGlobalConfig();
      this._onGlobalConfigChanged.fire(config);
    });

    // Store disposables
    this.context.subscriptions.push(this.configWatcher, this.globalConfigWatcher);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onConfigChanged.dispose();
    this._onGlobalConfigChanged.dispose();
    this._onConfigCreated.dispose();
    this.configWatcher?.dispose();
    this.globalConfigWatcher?.dispose();
  }
}
