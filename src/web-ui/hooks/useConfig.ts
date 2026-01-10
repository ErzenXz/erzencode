import { useState, useEffect, useCallback } from "react";

export type UIConfig = {
  workspaceRoot: string;
  provider: string;
  model: string;
  mode: string;
  uiMode: "web" | "vibe";
  currentSessionId: string;
  sessions: Array<{ id: string; name: string; workspaceRoot: string; createdAt: number }>;
};

export type ProviderInfo = {
  id: string;
  name: string;
  hasKey: boolean;
};

export function useConfig() {
  const [config, setConfig] = useState<UIConfig | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [configRes, providersRes] = await Promise.all([
          fetch("/api/config"),
          fetch("/api/providers"),
        ]);
        if (!cancelled) {
          const cfg = await configRes.json();
          const prov = await providersRes.json();
          setConfig(cfg);
          setProviders(prov.providers);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load config:", e);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadModels = useCallback(async (provider: string) => {
    const res = await fetch(`/api/models?provider=${provider}`);
    const data = await res.json();
    setModels(data.models || []);
    return data.models || [];
  }, []);

  const updateConfig = useCallback(async (updates: Partial<UIConfig>) => {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const newConfig = await res.json();
      setConfig(newConfig);
      return newConfig;
    }
    throw new Error("Failed to update config");
  }, []);

  const setProvider = useCallback(async (provider: string) => {
    const newConfig = await updateConfig({ provider });
    await loadModels(provider);
    return newConfig;
  }, [updateConfig, loadModels]);

  const setModel = useCallback(async (model: string) => {
    return await updateConfig({ model });
  }, [updateConfig]);

  const setWorkspaceRoot = useCallback(async (workspaceRoot: string) => {
    return await updateConfig({ workspaceRoot });
  }, [updateConfig]);

  const setMode = useCallback(async (mode: string) => {
    return await updateConfig({ mode });
  }, [updateConfig]);

  return {
    config,
    providers,
    models,
    loading,
    loadModels,
    updateConfig,
    setProvider,
    setModel,
    setWorkspaceRoot,
    setMode,
  };
}
