import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UIConfig = {
  workspaceRoot: string;
  provider: string;
  model: string;
  mode: string;
  uiMode: "web" | "vibe";
  thinkingLevel?: "off" | "low" | "medium" | "high";
  temperature?: number;
  maxTokens?: number;
  currentSessionId: string;
  sessions: Array<{ id: string; name: string; workspaceRoot: string; createdAt: number }>;
};

export type ProviderInfo = {
  id: string;
  name: string;
  hasKey: boolean;
};

type ConfigContextValue = {
  config: UIConfig | null;
  providers: ProviderInfo[];
  models: string[];
  loading: boolean;
  refreshConfig: () => Promise<UIConfig | null>;
  refreshProviders: () => Promise<ProviderInfo[]>;
  loadModels: (provider: string) => Promise<string[]>;
  updateConfig: (updates: Partial<UIConfig>) => Promise<UIConfig>;
  setProvider: (provider: string) => Promise<UIConfig>;
  setModel: (model: string) => Promise<UIConfig>;
  setWorkspaceRoot: (workspaceRoot: string) => Promise<UIConfig>;
  setMode: (mode: string) => Promise<UIConfig>;
  setThinkingLevel: (thinkingLevel: NonNullable<UIConfig["thinkingLevel"]>) => Promise<UIConfig>;
  setTemperature: (temperature: number) => Promise<UIConfig>;
  setMaxTokens: (maxTokens: number) => Promise<UIConfig>;
  switchSession: (sessionId: string) => Promise<any>;
  createSession: () => Promise<any>;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

function useConfigState(): ConfigContextValue {
  const [config, setConfig] = useState<UIConfig | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) return null;
      const cfg = (await res.json()) as UIConfig;
      setConfig(cfg);
      return cfg;
    } catch {
      return null;
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    const res = await fetch("/api/providers");
    const data = await res.json();
    const next = (data.providers || []) as ProviderInfo[];
    setProviders(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [configRes, providersRes] = await Promise.all([fetch("/api/config"), fetch("/api/providers")]);
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

  const setThinkingLevel = useCallback(async (thinkingLevel: NonNullable<UIConfig["thinkingLevel"]>) => {
    return await updateConfig({ thinkingLevel });
  }, [updateConfig]);

  const setTemperature = useCallback(async (temperature: number) => {
    return await updateConfig({ temperature });
  }, [updateConfig]);

  const setMaxTokens = useCallback(async (maxTokens: number) => {
    return await updateConfig({ maxTokens });
  }, [updateConfig]);

  const switchSession = useCallback(async (sessionId: string) => {
    const res = await fetch("/api/sessions/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              currentSessionId: data.session.id,
              workspaceRoot: data.session.workspaceRoot,
            }
          : null
      );
      await refreshConfig();
      return data;
    }
    throw new Error("Failed to switch session");
  }, [refreshConfig]);

  const createSession = useCallback(async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              currentSessionId: data.session.id,
              workspaceRoot: data.session.workspaceRoot,
              sessions: [
                ...(prev.sessions || []),
                {
                  id: data.session.id,
                  name: data.session.name,
                  workspaceRoot: data.session.workspaceRoot,
                  createdAt: Date.now(),
                },
              ],
            }
          : null
      );
      await refreshConfig();
      return data;
    }
    throw new Error("Failed to create session");
  }, [refreshConfig]);

  return useMemo(
    () => ({
      config,
      providers,
      models,
      loading,
      refreshConfig,
      refreshProviders,
      loadModels,
      updateConfig,
      setProvider,
      setModel,
      setWorkspaceRoot,
      setMode,
      setThinkingLevel,
      setTemperature,
      setMaxTokens,
      switchSession,
      createSession,
    }),
    [
      config,
      providers,
      models,
      loading,
      refreshConfig,
      refreshProviders,
      loadModels,
      updateConfig,
      setProvider,
      setModel,
      setWorkspaceRoot,
      setMode,
      setThinkingLevel,
      setTemperature,
      setMaxTokens,
      switchSession,
      createSession,
    ]
  );
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const value = useConfigState();
  return createElement(ConfigContext.Provider, { value }, children);
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return ctx;
}
