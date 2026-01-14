/**
 * Models Service for VSCode Extension
 * Manages dynamic model loading using shared core logic
 */

import * as vscode from "vscode";
import {
  getModelsForProviderAsync,
  PROVIDERS,
  DEFAULT_MODELS,
  getApiKeyAsync,
  type ModelInfo,
  type ProviderInfo,
  preloadDynamicModels,
  hasDynamicModelsCache,
} from "@erzencode/core";

export class ModelsService {
  private providers: ProviderInfo[];
  private providerStatus: Map<string, boolean> = new Map();
  private providerModels: Map<string, ModelInfo[]> = new Map();

  constructor() {
    this.providers = PROVIDERS;
    this.initializeProviderStatus();
  }

  private async initializeProviderStatus(): Promise<void> {
    for (const provider of this.providers) {
      const apiKey = await getApiKeyAsync(provider.id as string);
      this.providerStatus.set(provider.id, !!apiKey || provider.id === "ollama");
    }
  }

  /**
   * Get all providers with their status
   */
  async getProviders(): Promise<
    Array<{ id: string; name: string; status: string; description?: string }>
  > {
    await this.initializeProviderStatus();

    return this.providers.map((p) => ({
      id: p.id as string,
      name: p.name,
      status: this.providerStatus.get(p.id) ? "configured" : "needs-key",
      description: p.description,
    }));
  }

  /**
   * Get models for a specific provider
   */
  async getModels(providerId: string): Promise<ModelInfo[]> {
    // Check cache first
    if (this.providerModels.has(providerId)) {
      return this.providerModels.get(providerId)!;
    }

    try {
      const models = await getModelsForProviderAsync(providerId);
      this.providerModels.set(providerId, models);
      return models;
    } catch {
      // Return default model if loading fails
      const defaultModel = DEFAULT_MODELS[providerId];
      if (defaultModel) {
        return [{
          id: defaultModel,
          name: defaultModel,
          provider: providerId,
          contextWindow: 128000,
        }];
      }
      return [];
    }
  }

  /**
   * Preload models for all providers
   */
  async preloadModels(): Promise<void> {
    try {
      await preloadDynamicModels();
    } catch (error) {
      console.error("Failed to preload models:", error);
    }
  }

  /**
   * Check if models cache is valid
   */
  hasModelsCache(): boolean {
    return hasDynamicModelsCache();
  }

  /**
   * Get default model for a provider
   */
  getDefaultModel(providerId: string): string {
    return DEFAULT_MODELS[providerId] || "gpt-4o";
  }

  /**
   * Clear models cache
   */
  clearCache(): void {
    this.providerModels.clear();
  }

  /**
   * Update provider status after API key change
   */
  async updateProviderStatus(providerId: string): Promise<void> {
    const apiKey = await getApiKeyAsync(providerId);
    this.providerStatus.set(providerId, !!apiKey || providerId === "ollama");
  }
}
