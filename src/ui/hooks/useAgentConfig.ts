/**
 * Custom hook for managing AI agent configuration in the Terminal UI.
 * Handles provider, model, mode, and thinking level settings.
 */

import { useState, useCallback, useEffect } from "react";
import type { ProviderType } from "../../ai-provider.js";
import type { AgentMode as CodingAgentMode } from "../../ai-agent.js";
import type { ThinkingLevel } from "../types/ui-state.js";
import {
  MODEL_CHOICES,
  DEFAULT_MODELS,
  modelSupportsThinking,
  fetchProviderModels,
} from "../../config.js";

/**
 * Agent configuration.
 */
export interface AgentConfig {
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  thinking: ThinkingLevel;
}

/**
 * Return type for the useAgentConfig hook.
 */
export interface UseAgentConfigReturn {
  /** Current provider */
  provider: ProviderType;
  /** Current model */
  model: string;
  /** Current mode */
  mode: CodingAgentMode;
  /** Current thinking level */
  thinking: ThinkingLevel;
  /** Set the provider */
  setProvider: (provider: ProviderType) => void;
  /** Set the model */
  setModel: (model: string) => void;
  /** Set the mode */
  setMode: (mode: CodingAgentMode) => void;
  /** Set the thinking level */
  setThinking: (level: ThinkingLevel) => void;
  /** Whether the current model supports thinking */
  supportsThinking: boolean;
  /** Available models for the current provider */
  availableModels: string[];
  /** Whether models are being loaded */
  isLoadingModels: boolean;
  /** Invalidate the agent (force recreation) */
  invalidateAgent: () => void;
  /** Agent invalidation counter */
  agentVersion: number;
}

/**
 * Hook for managing AI agent configuration.
 * @param initialConfig - Initial configuration
 * @returns Agent configuration state and manipulation functions
 */
export function useAgentConfig(initialConfig: AgentConfig): UseAgentConfigReturn {
  const [provider, setProviderState] = useState<ProviderType>(
    initialConfig.provider
  );
  const [model, setModelState] = useState(initialConfig.model);
  const [mode, setModeState] = useState<CodingAgentMode>(initialConfig.mode);
  const [thinking, setThinkingState] = useState<ThinkingLevel>(
    initialConfig.thinking
  );
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [agentVersion, setAgentVersion] = useState(0);

  // Check if current model supports thinking
  const supportsThinking = modelSupportsThinking(provider, model);

  // Get available models (dynamic or static)
  const availableModels =
    dynamicModels.length > 0 ? dynamicModels : MODEL_CHOICES[provider] ?? [];

  // Load dynamic models when provider changes
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await fetchProviderModels(provider);
        if (!cancelled && models.length > 0) {
          setDynamicModels(models);
        }
      } catch {
        // Fall back to static models
        if (!cancelled) {
          setDynamicModels([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModels(false);
        }
      }
    };

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  const setProvider = useCallback((newProvider: ProviderType) => {
    setProviderState(newProvider);
    // Reset to default model for the new provider
    setModelState(DEFAULT_MODELS[newProvider] ?? "gpt-4o");
    setDynamicModels([]);
    setAgentVersion((v) => v + 1);
  }, []);

  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
    setAgentVersion((v) => v + 1);
  }, []);

  const setMode = useCallback((newMode: CodingAgentMode) => {
    setModeState(newMode);
  }, []);

  const setThinking = useCallback((level: ThinkingLevel) => {
    setThinkingState(level);
    setAgentVersion((v) => v + 1);
  }, []);

  const invalidateAgent = useCallback(() => {
    setAgentVersion((v) => v + 1);
  }, []);

  return {
    provider,
    model,
    mode,
    thinking,
    setProvider,
    setModel,
    setMode,
    setThinking,
    supportsThinking,
    availableModels,
    isLoadingModels,
    invalidateAgent,
    agentVersion,
  };
}
