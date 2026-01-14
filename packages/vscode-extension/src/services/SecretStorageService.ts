/**
 * SecretStorageService - Secure API key management using VSCode's SecretStorage API
 * Handles storing, retrieving, and managing API keys securely
 */

import * as vscode from "vscode";
import { loadGlobalConfig, saveGlobalConfig, type GlobalConfig } from "@erzencode/core/config.js";

export interface ProviderKeyStatus {
  provider: string;
  hasKey: boolean;
  migrated?: boolean;
}

export class SecretStorageService {
  private static readonly API_KEY_PREFIX = "erzencode.apiKeys.";
  private cachedKeys: Map<string, string> = new Map();
  private _onApiKeyChanged = new vscode.EventEmitter<ProviderKeyStatus>();
  readonly onApiKeyChanged = this._onApiKeyChanged.event;

  constructor(
    private context: vscode.ExtensionContext,
    private secretStorage: vscode.SecretStorage
  ) {}

  /**
   * Initialize the secret storage service
   * Checks for migration needed and loads provider statuses
   */
  async initialize(): Promise<void> {
    // Check if migration is needed (global.json has API keys)
    await this.migrateIfNeeded();
  }

  /**
   * Store an API key securely
   */
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    const key = this.getStorageKey(provider);
    await this.secretStorage.store(key, apiKey);

    // Update cache
    this.cachedKeys.set(provider, apiKey);

    // Emit event
    this._onApiKeyChanged.fire({ provider, hasKey: true });

    vscode.window.showInformationMessage(`API key saved for ${provider}`);
  }

  /**
   * Retrieve an API key
   * Checks cache first, then SecretStorage, then falls back to global.json
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    // Check cache first
    if (this.cachedKeys.has(provider)) {
      return this.cachedKeys.get(provider);
    }

    // Check SecretStorage
    const key = this.getStorageKey(provider);
    const apiKey = await this.secretStorage.get(key);

    if (apiKey) {
      // Cache for performance
      this.cachedKeys.set(provider, apiKey);
      return apiKey;
    }

    // Fallback to global.json for backwards compatibility
    const globalConfig = await loadGlobalConfig();
    const fallbackKey = globalConfig.apiKeys?.[provider as keyof NonNullable<GlobalConfig["apiKeys"]>];

    if (fallbackKey) {
      // Migrate to SecretStorage
      await this.setApiKey(provider, fallbackKey);
      // Remove from global.json
      await this.removeKeyFromGlobalConfig(provider);
      return fallbackKey;
    }

    return undefined;
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(provider: string): Promise<void> {
    const key = this.getStorageKey(provider);
    await this.secretStorage.delete(key);

    // Remove from cache
    this.cachedKeys.delete(provider);

    // Emit event
    this._onApiKeyChanged.fire({ provider, hasKey: false });

    vscode.window.showInformationMessage(`API key removed for ${provider}`);
  }

  /**
   * Check if an API key exists for a provider
   */
  async hasApiKey(provider: string): Promise<boolean> {
    const apiKey = await this.getApiKey(provider);
    return !!apiKey;
  }

  /**
   * List all providers that have API keys stored
   */
  async listProvidersWithKeys(): Promise<string[]> {
    // This is a limitation of SecretStorage - we can't list all keys
    // So we need to check common providers
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
      "azure",
      "exa",
      "voyage",
      "ollama",
    ];

    const providersWithKeys: string[] = [];
    for (const provider of providers) {
      if (await this.hasApiKey(provider)) {
        providersWithKeys.push(provider);
      }
    }

    return providersWithKeys;
  }

  /**
   * Get status of all providers (whether they have keys or not)
   */
  async getProviderStatuses(providers: string[]): Promise<ProviderKeyStatus[]> {
    const statuses: ProviderKeyStatus[] = [];

    for (const provider of providers) {
      const hasKey = await this.hasApiKey(provider);
      statuses.push({ provider, hasKey });
    }

    return statuses;
  }

  /**
   * Test an API key by making a simple validation request
   * This is a basic format check - actual API validation happens when making requests
   */
  async testApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    // Basic format validation
    if (!apiKey || apiKey.trim().length === 0) {
      return { valid: false, error: "API key is empty" };
    }

    // Provider-specific format checks
    const formatChecks: Record<string, (key: string) => boolean> = {
      anthropic: (key) => key.startsWith("sk-ant-"),
      openai: (key) => key.startsWith("sk-"),
      google: (key) => key.startsWith("AIza"),
      xai: (key) => key.startsWith("xai-"),
      openrouter: (key) => key.startsWith("sk-or-"),
      groq: (key) => key.startsWith("gsk_"),
      together: (key) => key.length > 20,
      fireworks: (key) => key.length > 20,
      deepseek: (key) => key.startsWith("sk-"),
      mistral: (key) => key.length > 20,
      perplexity: (key) => key.startsWith("pplx-"),
      cohere: (key) => key.length > 20,
      voyage: (key) => key.length > 20,
    };

    const formatCheck = formatChecks[provider];
    if (formatCheck && !formatCheck(apiKey)) {
      return {
        valid: false,
        error: `Invalid ${provider} API key format. Expected format for ${provider} keys.`,
      };
    }

    return { valid: true };
  }

  /**
   * Migrate API keys from global.json to SecretStorage
   * This is called automatically on initialization
   */
  private async migrateIfNeeded(): Promise<void> {
    try {
      const globalConfig = await loadGlobalConfig();

      if (!globalConfig.apiKeys || Object.keys(globalConfig.apiKeys).length === 0) {
        return; // No keys to migrate
      }

      // Check if we've already migrated
      const migrationFlag = await this.secretStorage.get("erzencode.migrationCompleted");
      if (migrationFlag === "true") {
        return;
      }

      // Ask user if they want to migrate
      const confirm = await vscode.window.showWarningMessage(
        "ErzenCode found API keys in your global.json config. For better security, we recommend moving them to VSCode's secure storage. Would you like to migrate now?",
        "Migrate",
        "Later"
      );

      if (confirm === "Migrate") {
        let migratedCount = 0;

        for (const [provider, apiKey] of Object.entries(globalConfig.apiKeys)) {
          if (apiKey) {
            await this.setApiKey(provider, apiKey);
            await this.removeKeyFromGlobalConfig(provider);
            migratedCount++;
          }
        }

        // Mark migration as complete
        await this.secretStorage.store("erzencode.migrationCompleted", "true");

        vscode.window.showInformationMessage(
          `Successfully migrated ${migratedCount} API key(s) to secure storage`
        );
      }
    } catch (error) {
      console.error("Error during migration:", error);
      // Don't block on migration errors
    }
  }

  /**
   * Remove API key from global.json after migration
   */
  private async removeKeyFromGlobalConfig(provider: string): Promise<void> {
    try {
      const globalConfig = await loadGlobalConfig();

      if (globalConfig.apiKeys) {
        delete globalConfig.apiKeys[provider as keyof typeof globalConfig.apiKeys];
        await saveGlobalConfig(globalConfig);
      }
    } catch (error) {
      console.error(`Error removing ${provider} key from global config:`, error);
    }
  }

  /**
   * Clear all stored API keys
   * WARNING: This is destructive and should only be used for debugging/reset
   */
  async clearAllKeys(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      "Are you sure you want to delete all stored API keys? This cannot be undone.",
      { modal: true },
      "Delete All",
      "Cancel"
    );

    if (confirmed === "Delete All") {
      const providers = await this.listProvidersWithKeys();

      for (const provider of providers) {
        await this.deleteApiKey(provider);
      }

      // Reset migration flag so we can migrate again if needed
      await this.secretStorage.delete("erzencode.migrationCompleted");

      vscode.window.showInformationMessage("All API keys have been deleted");
    }
  }

  /**
   * Export API keys (for backup purposes)
   * Returns a masked version for security
   */
  async exportApiKeyList(): Promise<Array<{ provider: string; hasKey: boolean; keyPreview: string }>> {
    const providers = await this.listProvidersWithKeys();

    return providers.map((provider) => {
      const key = this.cachedKeys.get(provider);
      const keyPreview = key ? `${key.slice(0, 8)}...${key.slice(-4)}` : "Not in cache";

      return {
        provider,
        hasKey: true,
        keyPreview,
      };
    });
  }

  /**
   * Get the storage key for a provider
   */
  private getStorageKey(provider: string): string {
    return `${SecretStorageService.API_KEY_PREFIX}${provider}`;
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cachedKeys.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onApiKeyChanged.dispose();
  }
}
