/**
 * Main App component for ErzenCode Settings
 */

import React, { useState, useEffect } from "react";
import "./App.css";

interface SettingsData {
  config: any;
  globalConfig: any;
  providersWithKeys: string[];
  sessions: any[];
  configPaths: any;
}

interface Message {
  type: string;
  data: any;
}

type Section = "general" | "providers" | "models" | "sessions" | "advanced" | "about";

function App() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("providers");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as Message;

      switch (message.type) {
        case "init":
          setData(message.data);
          setLoading(false);
          break;
        case "config/response":
          if (message.data.success) {
            setData((prev) => ({ ...prev!, config: message.data.config }));
          }
          break;
        case "apiKey/response":
          if (message.data.success) {
            // Refresh data after API key change
            sendMessage({ type: "apiKey/list" });
          }
          break;
        case "apiKey/list":
          if (message.data.success === false) {
            console.error("Failed to list API keys:", message.data.error);
          } else {
            setData((prev) => ({
              ...prev!,
              providersWithKeys: message.data.providers || [],
            }));
          }
          break;
        case "session/created":
          if (message.data.session) {
            setData((prev) => ({
              ...prev!,
              sessions: [message.data.session, ...(prev?.sessions || [])],
            }));
          }
          break;
        case "session/deleted":
          setData((prev) => ({
            ...prev!,
            sessions: prev?.sessions.filter((s) => s.id !== message.data.sessionId) || [],
          }));
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify extension that webview is ready
    sendMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const sendMessage = (message: any) => {
    (window as any).vscode.postMessage(message);
  };

  if (loading || !data) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading ErzenCode Settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        providersWithKeys={data.providersWithKeys.length}
      />
      <Content>
        <Header config={data.config} />
        {renderSection(activeSection, data, sendMessage)}
      </Content>
    </div>
  );
}

function Sidebar({
  activeSection,
  onSectionChange,
  providersWithKeys,
}: {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  providersWithKeys: number;
}) {
  const sections = [
    { id: "general" as Section, label: "General", icon: "⚙️" },
    {
      id: "providers" as Section,
      label: "Providers",
      icon: "🔑",
      badge: providersWithKeys > 0 ? `${providersWithKeys}` : undefined,
    },
    { id: "models" as Section, label: "Models", icon: "🤖" },
    { id: "sessions" as Section, label: "Sessions", icon: "💬" },
    { id: "advanced" as Section, label: "Advanced", icon: "🔧" },
    { id: "about" as Section, label: "About", icon: "ℹ️" },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>ErzenCode</h2>
        <span className="version">v0.3.0</span>
      </div>
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`sidebar-item ${activeSection === section.id ? "active" : ""}`}
            onClick={() => onSectionChange(section.id)}
          >
            <span className="sidebar-icon">{section.icon}</span>
            <span className="sidebar-label">{section.label}</span>
            {section.badge && <span className="sidebar-badge">{section.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Header({ config }: { config: any }) {
  return (
    <div className="header">
      <h1>Settings</h1>
      <div className="header-status">
        {config.provider && (
          <span className="status-badge">
            Provider: <strong>{config.provider}</strong>
          </span>
        )}
        {config.model && (
          <span className="status-badge">
            Model: <strong>{config.model}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function renderSection(section: Section, data: SettingsData, sendMessage: (msg: any) => void) {
  switch (section) {
    case "general":
      return <GeneralSettings config={data.config} sendMessage={sendMessage} />;
    case "providers":
      return (
        <ProviderSettings
          config={data.config}
          providersWithKeys={data.providersWithKeys}
          sendMessage={sendMessage}
        />
      );
    case "models":
      return <ModelSettings config={data.config} sendMessage={sendMessage} />;
    case "sessions":
      return (
        <SessionSettings
          sessions={data.sessions}
          configPaths={data.configPaths}
          sendMessage={sendMessage}
        />
      );
    case "advanced":
      return (
        <AdvancedSettings
          config={data.config}
          configPaths={data.configPaths}
          sendMessage={sendMessage}
        />
      );
    case "about":
      return <AboutSettings config={data.config} />;
    default:
      return <div>Unknown section</div>;
  }
}

function GeneralSettings({ config, sendMessage }: { config: any; sendMessage: (msg: any) => void }) {
  const [settings, setSettings] = useState(config);

  const handleChange = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    sendMessage({
      type: "config/update",
      data: newSettings,
    });
  };

  return (
    <div className="section">
      <h2>General Settings</h2>

      <div className="card">
        <h3>Appearance</h3>
        <div className="form-group">
          <label>Theme</label>
          <select
            value={settings.theme || "auto"}
            onChange={(e) => handleChange("theme", e.target.value)}
          >
            <option value="auto">Auto (follow VSCode)</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
        <div className="form-group">
          <label>Renderer</label>
          <select
            value={settings.renderer || "markdown"}
            onChange={(e) => handleChange("renderer", e.target.value)}
          >
            <option value="markdown">Markdown</option>
            <option value="raw">Raw Text</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h3>Behavior</h3>
        <div className="form-group">
          <label>Default Mode</label>
          <select
            value={settings.mode || "agent"}
            onChange={(e) => handleChange("mode", e.target.value)}
          >
            <option value="agent">Agent (full capabilities)</option>
            <option value="ask">Ask (read-only)</option>
            <option value="plan">Plan (planning mode)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Thinking Level</label>
          <select
            value={settings.thinkingLevel || "off"}
            onChange={(e) => handleChange("thinkingLevel", e.target.value)}
          >
            <option value="off">Off</option>
            <option value="low">Low (1K tokens)</option>
            <option value="medium">Medium (4K tokens)</option>
            <option value="high">High (16K tokens)</option>
          </select>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.autoSave !== false}
              onChange={(e) => handleChange("autoSave", e.target.checked)}
            />
            Auto-save sessions
          </label>
        </div>
      </div>
    </div>
  );
}

function ProviderSettings({
  config,
  providersWithKeys,
  sendMessage,
}: {
  config: any;
  providersWithKeys: string[];
  sendMessage: (msg: any) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const providers = [
    { id: "anthropic", name: "Anthropic (Claude)", color: "#D97757" },
    { id: "openai", name: "OpenAI (GPT)", color: "#10A37F" },
    { id: "google", name: "Google (Gemini)", color: "#4285F4" },
    { id: "xai", name: "xAI (Grok)", color: "#FF6B6B" },
    { id: "openrouter", name: "OpenRouter", color: "#6366F1" },
    { id: "groq", name: "Groq", color: "#FF5500" },
    { id: "together", name: "Together AI", color: "#F97316" },
    { id: "fireworks", name: "Fireworks AI", color: "#F59E0B" },
    { id: "deepseek", name: "DeepSeek", color: "#7C3AED" },
    { id: "mistral", name: "Mistral AI", color: "#F97316" },
    { id: "perplexity", name: "Perplexity", color: "#26BBA2" },
    { id: "cohere", name: "Cohere", color: "#39599D" },
  ];

  const handleSetKey = () => {
    if (selectedProvider && apiKey) {
      sendMessage({
        type: "apiKey/set",
        data: { provider: selectedProvider, key: apiKey },
      });
      setApiKey("");
      setSelectedProvider(null);
    }
  };

  const handleRemoveKey = (provider: string) => {
    if (confirm(`Remove API key for ${provider}?`)) {
      sendMessage({
        type: "apiKey/delete",
        data: { provider },
      });
    }
  };

  return (
    <div className="section">
      <h2>Provider Configuration</h2>
      <p className="section-description">
        Configure API keys for AI providers. Keys are stored securely in VSCode's
        encrypted storage.
      </p>

      <div className="providers-grid">
        {providers.map((provider) => {
          const hasKey = providersWithKeys.includes(provider.id);
          const isSelected = config.provider === provider.id;

          return (
            <div
              key={provider.id}
              className={`provider-card ${isSelected ? "selected" : ""}`}
              style={{ borderLeftColor: provider.color }}
            >
              <div className="provider-header">
                <h3>{provider.name}</h3>
                <span className={`status-badge ${hasKey ? "success" : "warning"}`}>
                  {hasKey ? "✓ Configured" : "⚠ Needs Key"}
                </span>
              </div>

              <div className="provider-actions">
                {hasKey ? (
                  <button
                    className="button button-danger"
                    onClick={() => handleRemoveKey(provider.id)}
                  >
                    Remove Key
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    onClick={() => setSelectedProvider(provider.id)}
                  >
                    Set API Key
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedProvider && (
        <div className="modal-overlay" onClick={() => setSelectedProvider(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set API Key</h3>
            <p>
              Enter your API key for{" "}
              <strong>
                {providers.find((p) => p.id === selectedProvider)?.name}
              </strong>
            </p>

            <input
              type="password"
              className="input"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
            />

            <div className="modal-actions">
              <button className="button" onClick={() => setSelectedProvider(null)}>
                Cancel
              </button>
              <button
                className="button button-primary"
                onClick={handleSetKey}
                disabled={!apiKey}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelSettings({ config, sendMessage }: { config: any; sendMessage: (msg: any) => void }) {
  const [model, setModel] = useState(config.model || "");

  const handleSave = () => {
    sendMessage({
      type: "config/update",
      data: { ...config, model },
    });
  };

  return (
    <div className="section">
      <h2>Model Configuration</h2>

      <div className="card">
        <h3>Current Model</h3>
        <div className="form-group">
          <label>Model ID</label>
          <input
            type="text"
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g., claude-sonnet-4-20250514"
          />
          <p className="help-text">
            Enter the model ID for your selected provider. Leave empty to use the
            provider's default model.
          </p>
        </div>

        <button className="button button-primary" onClick={handleSave}>
          Save Model
        </button>
      </div>

      <div className="card">
        <h3>Popular Models</h3>
        <div className="model-list">
          <div className="model-item">
            <code>claude-sonnet-4-20250514</code>
            <span className="model-provider">Anthropic</span>
          </div>
          <div className="model-item">
            <code>claude-3-5-sonnet-20241022</code>
            <span className="model-provider">Anthropic</span>
          </div>
          <div className="model-item">
            <code>gpt-4o</code>
            <span className="model-provider">OpenAI</span>
          </div>
          <div className="model-item">
            <code>gemini-2.0-flash-exp</code>
            <span className="model-provider">Google</span>
          </div>
          <div className="model-item">
            <code>deepseek-chat</code>
            <span className="model-provider">DeepSeek</span>
          </div>
          <div className="model-item">
            <code>deepseek-r1</code>
            <span className="model-provider">DeepSeek</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionSettings({
  sessions,
  configPaths,
  sendMessage,
}: {
  sessions: any[];
  configPaths: any;
  sendMessage: (msg: any) => void;
}) {
  const handleCreateSession = () => {
    const name = prompt("Enter session name:", "New Session");
    if (name) {
      sendMessage({
        type: "session/create",
        data: { name },
      });
    }
  };

  const handleDeleteSession = (sessionId: string, sessionName: string) => {
    if (confirm(`Delete session "${sessionName}"?`)) {
      sendMessage({
        type: "session/delete",
        data: { sessionId },
      });
    }
  };

  const handleExportSession = (sessionId: string, sessionName: string) => {
    sendMessage({
      type: "session/export",
      data: { sessionId, format: "markdown" },
    });
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2>Sessions</h2>
        <button className="button button-primary" onClick={handleCreateSession}>
          + New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <p>No sessions yet. Create your first session to get started!</p>
          <button className="button button-primary" onClick={handleCreateSession}>
            Create a Session
          </button>
        </div>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <div key={session.id} className="session-card">
              <div className="session-header">
                <h3>{session.name}</h3>
                <span className="session-count">{session.messages.length} messages</span>
              </div>
              <div className="session-meta">
                <span className="session-date">
                  {new Date(session.updatedAt).toLocaleString()}
                </span>
                <span className="session-path">{session.workingDirectory}</span>
              </div>
              <div className="session-actions">
                <button
                  className="button button-small"
                  onClick={() => handleExportSession(session.id, session.name)}
                >
                  Export
                </button>
                <button
                  className="button button-small button-danger"
                  onClick={() => handleDeleteSession(session.id, session.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Storage Locations</h3>
        <div className="path-list">
          <div className="path-item">
            <strong>Config:</strong> <code>{configPaths.config}</code>
          </div>
          <div className="path-item">
            <strong>Global:</strong> <code>{configPaths.global}</code>
          </div>
          <div className="path-item">
            <strong>Sessions:</strong> <code>{configPaths.sessions}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedSettings({ config, configPaths, sendMessage }: { config: any; configPaths: any; sendMessage: (msg: any) => void }) {
  const handleResetConfig = async () => {
    if (confirm("Reset all configuration to defaults? This cannot be undone.")) {
      // This would need to be implemented
      alert("Reset functionality coming soon");
    }
  };

  const handleOpenConfig = (type: "local" | "global") => {
    sendMessage({
      type: "config/openFile",
      data: { type },
    });
  };

  return (
    <div className="section">
      <h2>Advanced Settings</h2>

      <div className="card">
        <h3>Configuration Files</h3>
        <p className="section-description">
          Directly edit your configuration files. Be careful when making manual
          changes!
        </p>
        <div className="button-group">
          <button
            className="button button-secondary"
            onClick={() => handleOpenConfig("local")}
          >
            Open Local Config
          </button>
          <button
            className="button button-secondary"
            onClick={() => handleOpenConfig("global")}
          >
            Open Global Config
          </button>
        </div>
      </div>

      <div className="card card-danger">
        <h3>Danger Zone</h3>
        <p className="section-description">
          These actions are irreversible. Please be careful!
        </p>
        <button
          className="button button-danger"
          onClick={handleResetConfig}
        >
          Reset All Configuration
        </button>
      </div>
    </div>
  );
}

function AboutSettings({ config }: { config: any }) {
  return (
    <div className="section">
      <h2>About ErzenCode</h2>

      <div className="card">
        <div className="about-header">
          <h3>ErzenCode AI Assistant</h3>
          <span className="version">v0.3.0</span>
        </div>
        <p>
          An AI-powered coding assistant for VSCode with full feature parity to the
          CLI tool.
        </p>
        <div className="about-links">
          <a
            href="https://github.com/ErzenXz/erzencode"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Repository
          </a>
          <a
            href="https://github.com/ErzenXz/erzencode/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report Issues
          </a>
        </div>
      </div>

      <div className="card">
        <h3>Configuration</h3>
        <div className="config-details">
          <div className="config-item">
            <strong>Provider:</strong> {config.provider || "Not set"}
          </div>
          <div className="config-item">
            <strong>Model:</strong> {config.model || "Not set"}
          </div>
          <div className="config-item">
            <strong>Mode:</strong> {config.mode || "agent"}
          </div>
          <div className="config-item">
            <strong>Setup Complete:</strong>{" "}
            {config.setupComplete ? "Yes" : "No"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Content({ children }: { children: React.ReactNode }) {
  return <div className="content">{children}</div>;
}

export default App;
