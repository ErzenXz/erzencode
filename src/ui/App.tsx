import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { spawn } from "node:child_process";
import { Box, Text, render, useApp, useInput, useStdin, useStdout } from "ink";
import type { ProviderType } from "../ai-provider.js";
import {
  createAIAgent,
  type AgentConfig as CodingAgentConfig,
  type AgentMode as CodingAgentMode,
} from "../ai-agent.js";
import {
  setTodoUpdateCallback,
  getTodos,
  type TodoItem,
  setBashYoloMode,
  addBashAllowPrefix,
  removeBashAllowPrefix,
  approveBashCommandOnce,
  cancelBashApproval,
  getBashApprovalStatus,
  getPendingBashApprovals,
} from "../tools-standalone.js";
import { startWebUI, type WebUIHandle } from "../web-ui-new.js";
import {
  getAllThemes,
  getCurrentTheme,
  initTheme,
  setTheme,
} from "../themes.js";
import {
  DEFAULT_MODELS,
  MODEL_CHOICES,
  PROVIDERS,
  resolveThinkingConfig,
  fetchProviderModels,
  modelSupportsThinking,
  type ErzencodeConfig,
  saveConfig,
  appendToCommandHistory,
  getApiKeyAsync,
  setApiKey,
} from "../config.js";
import {
  getModel,
  modelSupports,
  preloadDynamicModels,
  getModelAsync,
} from "../models.js";
import {
  compactConversation,
  shouldCompact,
  createCompactedMessage,
  estimateTokens,
  formatCompactionResult,
} from "../compaction.js";
import figures from "figures";

import {
  type Stage,
  type ModalType,
  type ThinkingLevel,
  type ChatMessage,
  type MessagePart,
  type ToolPart,
  type FileInfo,
  type SessionState,
  type SlashCommand,
  MODE_COLORS,
  MODES,
  SLASH_COMMANDS,
  THINKING_LEVELS,
} from "./types.js";
import {
  generateId,
  truncate,
  formatTokens,
  formatTime,
  clamp,
  getToolDisplayName,
} from "./utils.js";
import {
  Header,
  ChatFeed,
  InputBox,
  StatusBar,
  ContextSidebar,
  WelcomeScreen,
  HelpModal,
  ThemeModal,
  ThinkingModal,
  ModelsModal,
  SessionsModal,
  ProviderModal,
  SettingsModal,
  ApiKeyModal,
  CopilotAuthModal,
} from "./components/index.js";

function openInBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";

  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {}
}

interface AppProps {
  baseConfig: CodingAgentConfig;
  configPath: string;
  saveableConfig: ErzencodeConfig;
  showSetup: boolean;
  onExit: () => void;
}

export const App: React.FC<AppProps> = ({
  baseConfig,
  configPath,
  saveableConfig,
  showSetup,
  onExit,
}) => {
  const { exit } = useApp();
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 100;
  const workingDirectory = process.cwd();

  // Stage & Modal
  const [stage, setStage] = useState<Stage>(showSetup ? "welcome" : "chat");
  const [activeModal, setActiveModal] = useState<ModalType>("none");

  // Theme
  const [themeId, setThemeId] = useState<string>(
    () => initTheme(saveableConfig.theme).id,
  );
  const theme = useMemo(() => getCurrentTheme(), [themeId]);
  const themeColors = theme.colors;

  // Model & Provider
  const [provider, setProvider] = useState<ProviderType>(
    baseConfig.provider as ProviderType,
  );
  const [model, setModel] = useState<string>(baseConfig.model ?? "gpt-4o");
  const [mode, setMode] = useState<CodingAgentMode>(
    (baseConfig.mode as CodingAgentMode) ?? "agent",
  );
  const supportsThinking = modelSupportsThinking(provider, model);
  // Default to "medium" for reasoning models, "off" for others
  const [thinking, setThinking] = useState<ThinkingLevel>(() =>
    modelSupportsThinking(
      baseConfig.provider ?? "openai",
      baseConfig.model ?? "gpt-4o",
    )
      ? "medium"
      : "off",
  );
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Modal Selection
  const [modalSelectionIndex, setModalSelectionIndex] = useState(0);

  // Sessions
  const [sessions, setSessions] = useState<SessionState[]>(() => [
    {
      id: generateId(),
      name: "Session 1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDirectory,
      messages: [],
      provider,
      model,
    },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState(
    sessions[0]?.id ?? "",
  );
  const sessionCounterRef = useRef(2);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId) ?? sessions[0]!;
  }, [sessions, currentSessionId]);

  // UI State
  const [input, setInput] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [isThinking, setIsThinking] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeFiles, setActiveFiles] = useState<Map<string, FileInfo>>(
    new Map(),
  );
  const [sessionTokens, setSessionTokens] = useState(0);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [lastTaskInputTokens, setLastTaskInputTokens] = useState(0);
  const [lastTaskOutputTokens, setLastTaskOutputTokens] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [activityLineCount, setActivityLineCount] = useState(0);
  const [runningTools, setRunningTools] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionStartTimeRef = useRef(Date.now());
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0);
  const [attachedImages, setAttachedImages] = useState<string[]>([]); // paths to attached images
  const [messageQueue, setMessageQueue] = useState<
    Array<{ text: string; images: string[] }>
  >([]); // Queued messages

  const [bashApprovalPrompt, setBashApprovalPrompt] = useState<{
    approvalId: string;
    command: string;
    workdir: string;
  } | null>(null);
  const [bashApprovalIndex, setBashApprovalIndex] = useState(0);

  // Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteMatches, setAutocompleteMatches] = useState<
    SlashCommand[]
  >([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // API Key Modal
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyCursorIndex, setApiKeyCursorIndex] = useState(0);
  const [pendingProvider, setPendingProvider] = useState<{
    id: string;
    name: string;
    envVar: string;
  } | null>(null);

  // Copilot OAuth Modal
  const [copilotOAuthStatus, setCopilotOAuthStatus] = useState<
    "waiting" | "polling" | "success" | "error"
  >("waiting");
  const [copilotUserCode, setCopilotUserCode] = useState<string | null>(null);
  const [copilotVerificationUri, setCopilotVerificationUri] = useState<
    string | null
  >(null);
  const [copilotOAuthError, setCopilotOAuthError] = useState<string | null>(
    null,
  );

  // Dimensions (used by keyboard handlers; must be declared before useInput)
  const headerHeight = 1; // simplified header is just 1 line
  const statusRowHeight = 1;
  const autocompleteHeight = showAutocomplete ? 8 : 0; // border(2) + items(5) + hint(1)
  const composerHeight = 3; // border(2) + line(1)
  const modeRowHeight = 1;
  const footerHeight =
    statusRowHeight + autocompleteHeight + composerHeight + modeRowHeight;
  const contentHeight = Math.max(
    5,
    terminalHeight - headerHeight - footerHeight,
  );
  const sidebarWidth =
    terminalWidth >= 100
      ? 30
      : terminalWidth >= 80
        ? 26
        : Math.max(20, Math.floor(terminalWidth * 0.28));
  const mainWidth = Math.max(30, terminalWidth - sidebarWidth - 2);

  // Cancel
  const [cancelCountdown, setCancelCountdown] = useState<number | null>(null);
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Command History
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const agentRef = useRef<ReturnType<typeof createAIAgent> | null>(null);
  const agentConfigRef = useRef<{
    provider: string;
    model: string;
    mode: CodingAgentMode;
    thinking: ThinkingLevel;
  } | null>(null);
  const conversationMapRef = useRef<Map<string, any>>(new Map());
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const webUIRef = useRef<WebUIHandle | null>(null);
  const hasSavedConfigRef = useRef(false);
  const prevActivityLineCountRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const activityLineCountRef = useRef(0);
  const cursorRef = useRef(0);

  const setInputAndCursor = useCallback((next: string) => {
    setInput(next);
    cursorRef.current = next.length;
    setCursorIndex(next.length);
  }, []);

  // Session elapsed time
  useEffect(() => {
    const t = setInterval(
      () => setSessionElapsedTime(Date.now() - sessionStartTimeRef.current),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  // Keyboard input handler
  useInput((inputKey, key) => {
    // Welcome stage
    if (stage === "welcome") {
      if (key.return) setStage("chat");
      return;
    }

    if (bashApprovalPrompt) {
      if (key.escape) {
        const { approvalId } = bashApprovalPrompt;
        (async () => {
          try {
            await cancelBashApproval(approvalId, "user cancelled");
          } catch {
            // ignore
          } finally {
            setBashApprovalPrompt(null);
            setStatus("bash approval: cancelled");
          }
        })();
        return;
      }
      if (key.upArrow) {
        setBashApprovalIndex((i) => (i + 4 - 1) % 4);
        return;
      }
      if (key.downArrow) {
        setBashApprovalIndex((i) => (i + 1) % 4);
        return;
      }
      if (key.return) {
        const { approvalId, command } = bashApprovalPrompt;
        const prefix = command.trim().split(/\s+/)[0] ?? "";
        (async () => {
          try {
            if (bashApprovalIndex === 0) {
              const res = await approveBashCommandOnce(approvalId);
              setStatus(
                res.ok
                  ? "bash allow-once: approved"
                  : `bash allow-once failed: ${res.reason ?? "unknown error"}`,
              );
            } else if (bashApprovalIndex === 1) {
              if (!prefix) {
                setStatus("bash allow prefix failed: empty prefix");
              } else {
                await addBashAllowPrefix(prefix);
                setStatus(`bash allow prefix added: ${prefix}`);
              }
            } else if (bashApprovalIndex === 2) {
              await setBashYoloMode(true);
              setStatus("bash yolo: on");
            } else {
              await cancelBashApproval(approvalId, "user cancelled");
              setStatus("bash approval: cancelled");
            }
          } catch (e: any) {
            setStatus(`bash approval error: ${e?.message ?? String(e)}`);
          } finally {
            setBashApprovalPrompt(null);
          }
        })();
        return;
      }
      return;
    }

    // Ctrl+C to exit
    if (key.ctrl && inputKey === "c") {
      exit();
      onExit();
      return;
    }

    // Modal navigation
    if (activeModal !== "none") {
      // Special handling for API key modal (text input)
      if (activeModal === "apikey") {
        if (key.escape) {
          setActiveModal("none");
          setPendingProvider(null);
          setApiKeyInput("");
          setApiKeyCursorIndex(0);
          setStatus("Cancelled");
          return;
        }
        if (key.return) {
          // Save the API key
          if (apiKeyInput.trim() && pendingProvider) {
            (async () => {
              try {
                await setApiKey(pendingProvider.id, apiKeyInput.trim());
                setProvider(pendingProvider.id as ProviderType);
                setModel(
                  DEFAULT_MODELS[pendingProvider.id as ProviderType] ??
                    "gpt-4o",
                );
                agentConfigRef.current = null;
                setStatus(`Provider: ${pendingProvider.name} (key saved)`);
              } catch (e) {
                setStatus("Failed to save API key");
              }
              setActiveModal("none");
              setPendingProvider(null);
              setApiKeyInput("");
              setApiKeyCursorIndex(0);
            })();
          }
          return;
        }
        // Handle backspace for API key input
        const isBackspace =
          key.backspace ||
          inputKey === "\x7f" ||
          inputKey === "\b" ||
          inputKey.charCodeAt(0) === 127 ||
          inputKey.charCodeAt(0) === 8;
        if (isBackspace) {
          if (apiKeyCursorIndex > 0) {
            setApiKeyInput(
              (prev) =>
                prev.slice(0, apiKeyCursorIndex - 1) +
                prev.slice(apiKeyCursorIndex),
            );
            setApiKeyCursorIndex((prev) => prev - 1);
          }
          return;
        }
        // Handle left/right arrow for cursor
        if (key.leftArrow) {
          setApiKeyCursorIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.rightArrow) {
          setApiKeyCursorIndex((prev) =>
            Math.min(apiKeyInput.length, prev + 1),
          );
          return;
        }
        // Handle printable characters
        if (
          !key.ctrl &&
          !key.meta &&
          inputKey &&
          !inputKey.includes("\u001b")
        ) {
          setApiKeyInput(
            (prev) =>
              prev.slice(0, apiKeyCursorIndex) +
              inputKey +
              prev.slice(apiKeyCursorIndex),
          );
          setApiKeyCursorIndex((prev) => prev + inputKey.length);
        }
        return;
      }

      // Special handling for Copilot OAuth modal
      if (activeModal === "copilot-oauth") {
        if (key.escape) {
          setActiveModal("none");
          setCopilotOAuthStatus("waiting");
          setCopilotUserCode(null);
          setCopilotVerificationUri(null);
          setCopilotOAuthError(null);
          setStatus("Cancelled");
          return;
        }
        // If success, any key closes the modal
        if (copilotOAuthStatus === "success" && (key.return || inputKey)) {
          setActiveModal("none");
          return;
        }
        return;
      }

      // Standard modal navigation (non-input modals)
      if (key.escape) {
        setActiveModal("none");
        setModalSelectionIndex(0);
        return;
      }
      if (key.upArrow) {
        setModalSelectionIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        const maxItems = getModalItemCount();
        setModalSelectionIndex((prev) => Math.min(maxItems - 1, prev + 1));
        return;
      }
      if (key.return) {
        handleModalSelect();
        return;
      }
      return;
    }

    // Tab: autocomplete completion (when open), otherwise switch modes
    if (key.tab && !isThinking && stage === "chat") {
      const selected = autocompleteMatches[autocompleteIndex];
      if (showAutocomplete && selected) {
        setInputAndCursor(`/${selected.name} `);
        setShowAutocomplete(false);
        return;
      }
      const currentIndex = MODES.indexOf(mode);
      const nextIndex = (currentIndex + 1) % MODES.length;
      const nextMode = MODES[nextIndex]!;
      setMode(nextMode);
      setStatus(
        `Mode: ${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}`,
      );
      return;
    }

    // ESC handling
    if (key.escape) {
      if (showAutocomplete) {
        setShowAutocomplete(false);
        return;
      }
      if (isThinking) {
        if (cancelCountdown !== null) {
          if (abortControllerRef.current) abortControllerRef.current.abort();
          setIsThinking(false);
          setStatus("Cancelled");
          setCancelCountdown(null);
          if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        } else {
          setCancelCountdown(2);
          cancelTimeoutRef.current = setTimeout(
            () => setCancelCountdown(null),
            2000,
          );
        }
      }
      return;
    }

    // Autocomplete navigation
    if (showAutocomplete) {
      if (key.upArrow) {
        setAutocompleteIndex((prev) =>
          prev > 0 ? prev - 1 : autocompleteMatches.length - 1,
        );
        return;
      }
      if (key.downArrow) {
        setAutocompleteIndex((prev) =>
          prev < autocompleteMatches.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      // Enter selects the command AND executes it immediately for no-arg commands
      if (key.return && autocompleteMatches[autocompleteIndex]) {
        const selectedCmd = autocompleteMatches[autocompleteIndex];
        const cmdText = `/${selectedCmd.name}`;
        setShowAutocomplete(false);

        // Commands that don't need args - execute immediately
        const noArgCommands = [
          "help",
          "models",
          "theme",
          "sessions",
          "provider",
          "settings",
          "reset",
          "clear",
          "save",
          "exit",
          "web",
        ];
        if (noArgCommands.includes(selectedCmd.name)) {
          setInputAndCursor("");
          handleCommand(cmdText);
        } else {
          // Commands that need args - just set the input
          setInputAndCursor(`${cmdText} `);
        }
        return;
      }
    }

    // Command history
    if (!showAutocomplete) {
      if (key.upArrow && commandHistory.length > 0) {
        if (historyIndex === -1) {
          setHistoryIndex(commandHistory.length - 1);
          setInputAndCursor(commandHistory[commandHistory.length - 1] ?? "");
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInputAndCursor(commandHistory[historyIndex - 1] ?? "");
        }
        return;
      }
      if (key.downArrow && historyIndex !== -1) {
        if (historyIndex < commandHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInputAndCursor(commandHistory[historyIndex + 1] ?? "");
        } else {
          setHistoryIndex(-1);
          setInputAndCursor("");
        }
        return;
      }
    }

    // Page scrolling
    if (key.pageUp || key.pageDown) {
      const step = 5;
      if (key.pageUp) {
        const maxScroll = Math.max(0, activityLineCount - contentHeight);
        setScrollOffset((prev) => clamp(prev + step, 0, maxScroll));
      } else {
        setScrollOffset((prev) => Math.max(0, prev - step));
      }
      return;
    }

    // Ctrl+U/D scrolling
    if (key.ctrl && (inputKey === "u" || inputKey === "d")) {
      const step = Math.max(3, Math.floor(contentHeight / 2));
      if (inputKey === "u") {
        const maxScroll = Math.max(0, activityLineCount - contentHeight);
        setScrollOffset((prev) => clamp(prev + step, 0, maxScroll));
      } else {
        setScrollOffset((prev) => Math.max(0, prev - step));
      }
      return;
    }

    // Text editing & submit
    if (key.return) {
      if (key.ctrl) {
        setInput((prev) => {
          const cur = cursorRef.current;
          const next = prev.slice(0, cur) + "\n" + prev.slice(cur);
          const nextCursor = cur + 1;
          cursorRef.current = nextCursor;
          setCursorIndex(nextCursor);
          return next;
        });
        return;
      }
      handleSubmit();
      return;
    }

    // Backspace and Delete - handle before escape sequence filter
    // Check both Ink's key detection and raw character codes for macOS compatibility
    const isBackspace =
      key.backspace ||
      inputKey === "\x7f" ||
      inputKey === "\b" ||
      inputKey.charCodeAt(0) === 127 ||
      inputKey.charCodeAt(0) === 8;
    const isDelete =
      key.delete ||
      inputKey === "\x1b[3~" ||
      (inputKey.startsWith("\x1b") && inputKey.includes("3~"));

    if (isBackspace || isDelete) {
      setInput((prev) => {
        const cur = cursorRef.current;
        if (isBackspace) {
          if (cur <= 0) return prev;
          const next = prev.slice(0, cur - 1) + prev.slice(cur);
          const nextCursor = cur - 1;
          cursorRef.current = nextCursor;
          setCursorIndex(nextCursor);
          return next;
        }
        // delete
        if (cur >= prev.length) return prev;
        const next = prev.slice(0, cur) + prev.slice(cur + 1);
        cursorRef.current = cur;
        setCursorIndex(cur);
        return next;
      });
      return;
    }

    // Arrow keys for cursor movement
    if (key.leftArrow) {
      const next = Math.max(0, cursorRef.current - 1);
      cursorRef.current = next;
      setCursorIndex(next);
      return;
    }

    if (key.rightArrow) {
      const next = Math.min(input.length, cursorRef.current + 1);
      cursorRef.current = next;
      setCursorIndex(next);
      return;
    }

    // Ctrl+A - beginning of line
    if (key.ctrl && inputKey === "a") {
      cursorRef.current = 0;
      setCursorIndex(0);
      return;
    }

    // Ctrl+E - end of line
    if (key.ctrl && inputKey === "e") {
      cursorRef.current = input.length;
      setCursorIndex(input.length);
      return;
    }

    // Ignore mouse/escape sequences so they don't end up in the composer.
    // (Wheel events can appear as "[<65;83;32M" on some terminals.)
    if (
      inputKey.includes("\u001b") ||
      /^\[?<\d+;\d+;\d+[mM]$/.test(inputKey) ||
      inputKey.startsWith("[<")
    ) {
      return;
    }

    // Append printable input (Ink gives printable characters in inputKey)
    if (!key.ctrl && !key.meta && inputKey) {
      setInput((prev) => {
        const cur = cursorRef.current;
        const next = prev.slice(0, cur) + inputKey + prev.slice(cur);
        const nextCursor = cur + inputKey.length;
        cursorRef.current = nextCursor;
        setCursorIndex(nextCursor);
        return next;
      });
    }
  });

  // Modal item count helper
  const getModalItemCount = useCallback(() => {
    switch (activeModal) {
      case "models":
        return (
          dynamicModels.length > 0
            ? dynamicModels
            : (MODEL_CHOICES[provider] ?? [])
        ).length;
      case "sessions":
        return sessions.length;
      case "theme":
        return getAllThemes().length;
      case "provider":
        return PROVIDERS.length;
      case "thinking":
        return THINKING_LEVELS.length;
      default:
        return 0;
    }
  }, [activeModal, dynamicModels, provider, sessions.length]);

  // Save config
  const saveCurrentConfig = useCallback(async () => {
    const nextConfig: ErzencodeConfig = {
      ...saveableConfig,
      provider,
      model,
      mode,
      theme: themeId,
      setupComplete: true,
    };
    await saveConfig(configPath, nextConfig);
  }, [saveableConfig, provider, model, mode, themeId, configPath]);

  useEffect(() => {
    if (!hasSavedConfigRef.current) {
      hasSavedConfigRef.current = true;
      return;
    }
    saveCurrentConfig().catch(() => {});
  }, [provider, model, mode, themeId, saveCurrentConfig]);

  useEffect(() => {
    setTheme(themeId);
  }, [themeId]);

  // Modal selection handler
  const handleModalSelect = useCallback(() => {
    switch (activeModal) {
      case "models": {
        const allModels =
          dynamicModels.length > 0
            ? dynamicModels
            : (MODEL_CHOICES[provider] ?? []);
        const selectedModel = allModels[modalSelectionIndex];
        if (selectedModel) {
          setModel(selectedModel);
          agentConfigRef.current = null;
          setStatus(`Model: ${selectedModel}`);
        }
        setActiveModal("none");
        break;
      }
      case "theme": {
        const themes = getAllThemes();
        const selectedTheme = themes[modalSelectionIndex];
        if (selectedTheme) {
          setTheme(selectedTheme.id);
          setThemeId(selectedTheme.id);
          setStatus(`Theme: ${selectedTheme.name}`);
        }
        setActiveModal("none");
        break;
      }
      case "sessions": {
        const selectedSession = sessions[modalSelectionIndex];
        if (selectedSession) {
          setCurrentSessionId(selectedSession.id);
          setStatus(`Session: ${selectedSession.name}`);
        }
        setActiveModal("none");
        break;
      }
      case "provider": {
        const selectedProvider = PROVIDERS[modalSelectionIndex];
        if (selectedProvider) {
          // Check if API key exists for this provider
          (async () => {
            const apiKey = await getApiKeyAsync(selectedProvider.id);
            if (apiKey || selectedProvider.id === "ollama") {
              // API key exists or not needed - switch directly
              setProvider(selectedProvider.id as ProviderType);
              setModel(
                DEFAULT_MODELS[selectedProvider.id as ProviderType] ?? "gpt-4o",
              );
              agentConfigRef.current = null;
              setStatus(`Provider: ${selectedProvider.name}`);
              setActiveModal("none");
            } else if (selectedProvider.id === "copilot") {
              // Copilot uses OAuth device flow
              setCopilotOAuthStatus("waiting");
              setCopilotUserCode(null);
              setCopilotVerificationUri(null);
              setCopilotOAuthError(null);
              setActiveModal("copilot-oauth");

              // Start the OAuth device flow
              try {
                const { startDeviceFlow, pollForToken } =
                  await import("../copilot-auth.js");
                const deviceCode = await startDeviceFlow();
                setCopilotUserCode(deviceCode.user_code);
                setCopilotVerificationUri(deviceCode.verification_uri);
                setCopilotOAuthStatus("polling");

                // Poll for token in background
                const token = await pollForToken(
                  deviceCode.device_code,
                  deviceCode.interval,
                  deviceCode.expires_in,
                );

                // Save the token
                await setApiKey("copilot", token);
                setCopilotOAuthStatus("success");

                // Wait a bit then switch provider
                setTimeout(() => {
                  setProvider("copilot" as ProviderType);
                  setModel(DEFAULT_MODELS.copilot ?? "gpt-4o");
                  agentConfigRef.current = null;
                  setStatus("Provider: GitHub Copilot");
                  setActiveModal("none");
                }, 1500);
              } catch (error: any) {
                setCopilotOAuthStatus("error");
                setCopilotOAuthError(error?.message ?? String(error));
              }
            } else {
              // No API key - show API key modal
              setPendingProvider({
                id: selectedProvider.id,
                name: selectedProvider.name,
                envVar:
                  selectedProvider.envVar ??
                  `${selectedProvider.id.toUpperCase()}_API_KEY`,
              });
              setApiKeyInput("");
              setApiKeyCursorIndex(0);
              setActiveModal("apikey");
            }
          })();
        } else {
          setActiveModal("none");
        }
        break;
      }
      case "thinking": {
        const selectedLevel = THINKING_LEVELS[modalSelectionIndex];
        if (selectedLevel) {
          setThinking(selectedLevel);
          agentConfigRef.current = null;
          setStatus(`Thinking: ${selectedLevel}`);
        }
        setActiveModal("none");
        break;
      }
    }
    setModalSelectionIndex(0);
  }, [activeModal, dynamicModels, provider, modalSelectionIndex, sessions]);

  // Autocomplete effect
  useEffect(() => {
    if (activeModal !== "none") return;

    if (input === "/") {
      setAutocompleteMatches(SLASH_COMMANDS);
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
    } else if (input.startsWith("/") && input.length > 1) {
      const query = input.slice(1).toLowerCase();
      const matches = SLASH_COMMANDS.map((cmd) => {
        const name = cmd.name.toLowerCase();
        const aliases = (cmd.aliases ?? []).map((a) => a.toLowerCase());
        const namePrefix = name.startsWith(query);
        const aliasPrefix = aliases.some((a) => a.startsWith(query));
        const nameIncludes = name.includes(query);
        const aliasIncludes = aliases.some((a) => a.includes(query));
        const score =
          (namePrefix ? 3 : 0) +
          (aliasPrefix ? 2 : 0) +
          (nameIncludes ? 1 : 0) +
          (aliasIncludes ? 1 : 0);
        return { cmd, score };
      })
        .filter((x) => x.score > 0)
        .sort(
          (a, b) => b.score - a.score || a.cmd.name.localeCompare(b.cmd.name),
        )
        .map((x) => x.cmd);
      setAutocompleteMatches(matches);
      setShowAutocomplete(matches.length > 0);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
      setAutocompleteMatches([]);
    }
  }, [input, activeModal]);

  // Ref to track if we should process queue on next render
  const processQueueRef = useRef(false);

  // Keep scroll offset stable when new lines arrive (if user is scrolled up).
  useEffect(() => {
    const nextCount = activityLineCount;
    const prevCount = prevActivityLineCountRef.current;
    prevActivityLineCountRef.current = nextCount;

    activityLineCountRef.current = nextCount;
    viewportHeightRef.current = contentHeight;

    const maxScroll = Math.max(0, nextCount - contentHeight);
    setScrollOffset((cur) => {
      if (cur === 0) return 0;
      const delta = nextCount - prevCount;
      if (delta > 0) return clamp(cur + delta, 0, maxScroll);
      return clamp(cur, 0, maxScroll);
    });
  }, [activityLineCount, contentHeight, clamp]);

  // Enable raw mode for better input handling
  // Mouse wheel scrolling enabled, text selection still works
  useEffect(() => {
    if (!stdout) return;

    if (isRawModeSupported) {
      try {
        setRawMode(true);
      } catch {
        // ignore
      }
    }

    // Enable mouse wheel tracking (SGR extended mode for wheel events)
    // \x1b[?1000h - Enable mouse tracking
    // \x1b[?1006h - Enable SGR extended mode (for proper coordinates)
    stdout.write("\u001B[?1000h\u001B[?1006h");

    const onData = (data: Buffer) => {
      const str = data.toString("utf8");

      // Handle mouse wheel events (SGR extended mode)
      // Format: \x1b[<button;x;y(M|m)
      // button 64 = wheel up, button 65 = wheel down
      const mouseMatch = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (mouseMatch) {
        const button = parseInt(mouseMatch[1]!, 10);
        // Wheel up (64) or wheel down (65)
        if (button === 64 || button === 65) {
          const scrollAmount = 3;
          const maxScroll = Math.max(
            0,
            activityLineCountRef.current - viewportHeightRef.current,
          );
          if (button === 64) {
            // Wheel up = scroll up (increase offset to see older content)
            setScrollOffset((prev) => Math.min(maxScroll, prev + scrollAmount));
          } else {
            // Wheel down = scroll down (decrease offset to see newer content)
            setScrollOffset((prev) => Math.max(0, prev - scrollAmount));
          }
          return;
        }
        // Ignore other mouse events (clicks, drags) to allow text selection
        return;
      }

      // Handle backspace (0x7f or 0x08) directly from raw input
      for (const char of str) {
        const code = char.charCodeAt(0);
        if (code === 127 || code === 8) {
          // Backspace detected - trigger input update
          setInput((prev) => {
            const cur = cursorRef.current;
            if (cur <= 0) return prev;
            const next = prev.slice(0, cur - 1) + prev.slice(cur);
            const nextCursor = cur - 1;
            cursorRef.current = nextCursor;
            setCursorIndex(nextCursor);
            return next;
          });
          return;
        }
      }
    };

    stdin.on("data", onData);

    return () => {
      stdin.off("data", onData);
      // Disable mouse tracking on cleanup
      stdout.write("\u001B[?1000l\u001B[?1006l");
      if (isRawModeSupported) {
        try {
          setRawMode(false);
        } catch {
          // ignore
        }
      }
    };
  }, [stdin, stdout, isRawModeSupported, setRawMode]);

  // Preload dynamic models from models.dev at startup
  useEffect(() => {
    preloadDynamicModels().catch(() => {
      // Silently fail - static models will be used as fallback
    });
  }, []);

  // Load models
  useEffect(() => {
    if (stage !== "chat") return;
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await fetchProviderModels(provider);
        setDynamicModels(models);
      } catch {
        setDynamicModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };
    loadModels();
  }, [provider, stage]);

  // Agent initialization
  useEffect(() => {
    if (stage !== "chat") return;
    const configKey = `${provider}:${model}:${mode}:${thinking}`;
    if (
      agentConfigRef.current &&
      `${agentConfigRef.current.provider}:${agentConfigRef.current.model}:${agentConfigRef.current.mode}:${agentConfigRef.current.thinking}` ===
        configKey
    ) {
      return;
    }

    // Fetch the API key for the current provider and create the agent
    (async () => {
      const apiKey = await getApiKeyAsync(provider);
      agentRef.current = createAIAgent({
        ...baseConfig,
        apiKey: apiKey ?? baseConfig.apiKey, // Use provider-specific key if available
        workspaceRoot: workingDirectory,
        provider,
        model,
        mode,
        thinking: resolveThinkingConfig(thinking, supportsThinking),
      });
      agentConfigRef.current = { provider, model, mode, thinking };
    })();
  }, [
    stage,
    provider,
    model,
    mode,
    thinking,
    baseConfig,
    workingDirectory,
    supportsThinking,
  ]);

  // Todo callback
  useEffect(() => {
    setTodoUpdateCallback((newTodos) => setTodos(newTodos));
    setTodos(getTodos());
    return () => setTodoUpdateCallback(null);
  }, []);

  // Command handler
  const handleCommand = useCallback(
    (commandLine: string) => {
      const parts = commandLine.slice(1).trim().split(/\s+/);
      const cmdName = parts[0] ?? "";
      const args = parts.slice(1);

      const cmd = SLASH_COMMANDS.find(
        (c) => c.name === cmdName || c.aliases?.includes(cmdName),
      );

      if (!cmd) {
        setStatus(`Unknown: /${cmdName}`);
        return;
      }

      switch (cmd.name) {
        case "help":
          setActiveModal("help");
          break;
        case "models":
          setActiveModal("models");
          setModalSelectionIndex(0);
          break;
        case "theme":
          setActiveModal("theme");
          setModalSelectionIndex(
            Math.max(
              0,
              getAllThemes().findIndex((t) => t.id === themeId),
            ),
          );
          break;
        case "web": {
          (async () => {
            try {
              if (webUIRef.current) {
                openInBrowser(webUIRef.current.url);
                setStatus(`Web UI: ${webUIRef.current.url}`);
                return;
              }
              setStatus("Starting web UI...");
              const handle = await startWebUI({
                baseConfig: {
                  ...baseConfig,
                  provider,
                  model,
                  mode,
                  workspaceRoot: workingDirectory,
                },
                initialWorkspaceRoot: workingDirectory,
                provider,
                model,
                mode,
                uiMode: "web",
                openBrowser: true,
              });
              webUIRef.current = handle;
              setStatus(`Web UI: ${handle.url}`);
            } catch (e: any) {
              setStatus(`Web UI error: ${e?.message ?? String(e)}`);
            }
          })();
          break;
        }
        case "vibe": {
          (async () => {
            try {
              if (webUIRef.current) {
                await webUIRef.current.close();
                webUIRef.current = null;
              }
              setStatus("Starting Vibe mode...");
              const handle = await startWebUI({
                baseConfig: {
                  ...baseConfig,
                  provider,
                  model,
                  mode,
                  workspaceRoot: workingDirectory,
                },
                initialWorkspaceRoot: workingDirectory,
                provider,
                model,
                mode,
                uiMode: "vibe",
                openBrowser: true,
              });
              webUIRef.current = handle;
              setStatus(`Vibe: ${handle.url}`);
            } catch (e: any) {
              setStatus(`Vibe error: ${e?.message ?? String(e)}`);
            }
          })();
          break;
        }
        case "sessions":
          setActiveModal("sessions");
          setModalSelectionIndex(
            sessions.findIndex((s) => s.id === currentSessionId),
          );
          break;
        case "settings":
          setActiveModal("settings");
          break;
        case "provider":
          setActiveModal("provider");
          setModalSelectionIndex(PROVIDERS.findIndex((p) => p.id === provider));
          break;
        case "thinking":
          setActiveModal("thinking");
          setModalSelectionIndex(THINKING_LEVELS.indexOf(thinking));
          break;
        case "new": {
          const name = args.join(" ") || `Session ${sessionCounterRef.current}`;
          sessionCounterRef.current++;
          const newSession: SessionState = {
            id: generateId(),
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            workingDirectory,
            messages: [],
            provider,
            model,
          };
          setSessions((prev) => [...prev, newSession]);
          setCurrentSessionId(newSession.id);
          // Session messages managed via state
          setStatus(`Created: ${name}`);
          break;
        }
        case "reset":
          // Session reset - messages cleared via state
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId ? { ...s, messages: [] } : s,
            ),
          );
          setTodos([]);
          setActiveFiles(new Map());
          setStatus("Session reset");
          break;
        case "clear":
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId ? { ...s, messages: [] } : s,
            ),
          );
          setStatus("Cleared");
          break;
        case "save":
          saveCurrentConfig();
          setStatus("Saved!");
          break;
        case "exit":
          exit();
          onExit();
          break;
        case "image": {
          const imagePath = args.join(" ").trim();
          if (!imagePath) {
            setStatus("Usage: /image <path>");
            break;
          }

          // Check if model supports vision
          const supportsVision = modelSupports(provider, model, "vision");
          if (!supportsVision) {
            setStatus(`Model ${model} does not support images`);
            break;
          }

          // Check if file exists (use sync for simplicity in command handler)
          (async () => {
            const fs = await import("node:fs");
            const path = await import("node:path");
            const resolvedPath = path.resolve(workingDirectory, imagePath);

            if (!fs.existsSync(resolvedPath)) {
              setStatus(`File not found: ${imagePath}`);
              return;
            }

            // Check if it's an image file
            const ext = path.extname(resolvedPath).toLowerCase();
            const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
            if (!imageExtensions.includes(ext)) {
              setStatus(`Not an image file: ${ext}`);
              return;
            }

            // Add to attached images
            setAttachedImages((prev) => {
              if (prev.includes(resolvedPath)) {
                return prev; // Already attached
              }
              return [...prev, resolvedPath];
            });

            const fileName = path.basename(resolvedPath);
            setStatus(`Attached: ${fileName}`);
          })();
          break;
        }
        case "compact": {
          // Compact/summarize the conversation to reduce context usage
          const currentMessages = currentSession.messages;
          if (currentMessages.length < 3) {
            setStatus("Not enough messages to compact");
            break;
          }

          setStatus("Compacting conversation...");
          setIsThinking(true);

          (async () => {
            try {
              const apiKey = await getApiKeyAsync(provider);
              const messagesToCompact = currentMessages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  timestamp: m.timestamp,
                }));

              const result = await compactConversation(messagesToCompact, {
                provider,
                model,
                apiKey: apiKey ?? undefined,
              });

              if (result.success && result.summary) {
                // Create a summary message and replace the conversation
                const summaryMessage = createCompactedMessage(
                  result.summary,
                  result.originalMessageCount,
                );

                // Keep only the system summary as the first message
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === currentSessionId
                      ? {
                          ...s,
                          messages: [
                            {
                              id: generateId(),
                              role: "system" as const,
                              content: summaryMessage.content,
                              timestamp: Date.now(),
                            },
                          ],
                        }
                      : s,
                  ),
                );

                // Reset token counts since we compacted
                setSessionTokens(estimateTokens(summaryMessage.content));
                setStatus(formatCompactionResult(result));
              } else {
                setStatus(
                  `Compaction failed: ${result.error ?? "Unknown error"}`,
                );
              }
            } catch (e: any) {
              setStatus(`Compaction error: ${e?.message ?? String(e)}`);
            } finally {
              setIsThinking(false);
            }
          })();
          break;
        }

        case "bash": {
          (async () => {
            const sub = (args[0] ?? "status").toLowerCase();
            const rest = args.slice(1).join(" ").trim();
            const stripQuotes = (s: string) =>
              s.replace(/^['\"]/, "").replace(/['\"]$/, "").trim();

            try {
              if (sub === "status") {
                const st = await getBashApprovalStatus();
                const prefixes = st.allowPrefixes.length
                  ? st.allowPrefixes.join(", ")
                  : "(none)";
                setStatus(
                  `bash approvals: yolo=${st.yolo ? "on" : "off"}; allowPrefixes=${prefixes}`,
                );
                return;
              }

              if (sub === "pending") {
                const pending = getPendingBashApprovals();
                if (pending.length === 0) {
                  setStatus("bash approvals: no pending requests");
                  return;
                }
                const lines = pending
                  .slice(0, 3)
                  .map((p) => `${p.id}: ${p.command.slice(0, 60)}`)
                  .join(" | ");
                setStatus(
                  `bash approvals pending (${pending.length}): ${lines}${pending.length > 3 ? " ..." : ""}`,
                );
                return;
              }

              if (sub === "yolo") {
                const onOff = (args[1] ?? "").toLowerCase();
                if (onOff !== "on" && onOff !== "off") {
                  setStatus("Usage: /bash yolo on|off");
                  return;
                }
                await setBashYoloMode(onOff === "on");
                setStatus(`bash yolo: ${onOff}`);
                return;
              }

              if (sub === "allow") {
                const prefix = stripQuotes(rest);
                if (!prefix) {
                  setStatus('Usage: /bash allow "<prefix>"  (e.g. /bash allow "npx")');
                  return;
                }
                await addBashAllowPrefix(prefix);
                setStatus(`bash allow prefix added: ${prefix}`);
                return;
              }

              if (sub === "unallow" || sub === "deny" || sub === "remove") {
                const prefix = stripQuotes(rest);
                if (!prefix) {
                  setStatus('Usage: /bash unallow "<prefix>"');
                  return;
                }
                await removeBashAllowPrefix(prefix);
                setStatus(`bash allow prefix removed: ${prefix}`);
                return;
              }

              if (sub === "allow-once") {
                const approvalId = (args[1] ?? "").trim();
                if (!approvalId) {
                  setStatus("Usage: /bash allow-once <approvalId>");
                  return;
                }
                const res = await approveBashCommandOnce(approvalId);
                if (!res.ok) {
                  setStatus(`bash allow-once failed: ${res.reason ?? "unknown error"}`);
                  return;
                }
                setStatus("bash allow-once: approved");
                return;
              }

              setStatus(
                "Usage: /bash status | /bash pending | /bash yolo on|off | /bash allow <prefix> | /bash unallow <prefix> | /bash allow-once <approvalId>",
              );
            } catch (e: any) {
              setStatus(`bash approvals error: ${e?.message ?? String(e)}`);
            }
          })();
          break;
        }
      }
    },
    [
      currentSessionId,
      provider,
      model,
      sessions,
      workingDirectory,
      saveCurrentConfig,
      exit,
      onExit,
      themeId,
      baseConfig,
      mode,
    ],
  );

  // Message submission
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;

    const userInput = input.trim();
    const imagesToSend = [...attachedImages];

    // If currently thinking, queue the message
    if (isThinking) {
      setMessageQueue((prev) => [
        ...prev,
        { text: userInput, images: imagesToSend },
      ]);
      setInputAndCursor("");
      setAttachedImages([]);
      setStatus(`Queued (${messageQueue.length + 1} waiting)`);
      return;
    }

    setInputAndCursor("");
    setHistoryIndex(-1);
    setShowAutocomplete(false);

    setCommandHistory((prev) => [...prev, userInput].slice(-100));
    appendToCommandHistory(userInput).catch(() => {});

    if (userInput.startsWith("/")) {
      handleCommand(userInput);
      return;
    }

    // Build message content with images if attached
    setAttachedImages([]); // Clear attached images after sending

    // Add user message (display version)
    const userMsgId = generateId();
    const displayContent =
      imagesToSend.length > 0
        ? `${userInput}\n[${imagesToSend.length} image${imagesToSend.length > 1 ? "s" : ""} attached]`
        : userInput;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                {
                  id: userMsgId,
                  role: "user" as const,
                  content: displayContent,
                  timestamp: Date.now(),
                },
              ],
            }
          : s,
      ),
    );

    // Build message history from session
    const sessionMessages = currentSession.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Add the new user message
    sessionMessages.push({ role: "user" as const, content: userInput });

    // Build message content for API (with images if any)
    if (imagesToSend.length > 0) {
      const fs = await import("node:fs");
      const path = await import("node:path");

      const contentParts: Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            image: string;
            mimeType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          }
      > = [];

      // Add text part
      contentParts.push({ type: "text", text: userInput });

      // Add image parts
      for (const imagePath of imagesToSend) {
        try {
          const imageBuffer = fs.readFileSync(imagePath);
          const base64 = imageBuffer.toString("base64");
          const ext = path.extname(imagePath).toLowerCase();
          const mimeMap: Record<
            string,
            "image/jpeg" | "image/png" | "image/gif" | "image/webp"
          > = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
          };
          const mimeType = mimeMap[ext] ?? "image/png";
          contentParts.push({
            type: "image",
            image: `data:${mimeType};base64,${base64}`,
            mimeType,
          });
        } catch (e) {
          // Skip images that can't be read
          setStatus(`Failed to read image: ${path.basename(imagePath)}`);
        }
      }

      // Images handled via sessionMessages content
    } else {
      // Text-only message already added to sessionMessages above
    }

    // Start processing
    setIsThinking(true);
    setStatus("Thinking...");
    setElapsedTime(0);
    setRunningTools([]);
    setScrollOffset(0); // Reset scroll when new message
    setLastTaskInputTokens(0); // Reset last task tokens
    setLastTaskOutputTokens(0);
    abortControllerRef.current = new AbortController();

    const startTime = Date.now();
    elapsedTimerRef.current = setInterval(
      () => setElapsedTime(Date.now() - startTime),
      100,
    );

    // Add assistant message
    const assistantMsgId = generateId();
    const messageParts: MessagePart[] = [];
    let currentTextContent = "";

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                {
                  id: assistantMsgId,
                  role: "assistant" as const,
                  content: "",
                  timestamp: Date.now(),
                  isStreaming: true,
                  parts: [],
                },
              ],
            }
          : s,
      ),
    );

    const updateMessage = () => {
      const finalContent = messageParts
        .map((p) => {
          if (p.type === "text") return p.content;
          if (p.type === "thinking") return `*${p.content}*`;
          if (p.type === "tool") return `\`${p.name}\``;
          return "";
        })
        .join("\n");

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: finalContent, parts: [...messageParts] }
                    : m,
                ),
              }
            : s,
        ),
      );
    };

    try {
      const agent = agentRef.current;
      if (!agent) throw new Error("Agent not initialized");

      let currentThinkingContent = ""; // Accumulate thinking chunks

      for await (const event of agent.stream(sessionMessages)) {
        if (abortControllerRef.current?.signal.aborted) break;

        if (event.type === "reasoning") {
          const thinkingText = (event.data as any).text ?? "";
          if (thinkingText) {
            // Accumulate thinking content
            currentThinkingContent += thinkingText;
            // Update or create thinking part
            const lastPart = messageParts[messageParts.length - 1];
            if (lastPart?.type === "thinking") {
              lastPart.content = currentThinkingContent;
            } else {
              messageParts.push({
                type: "thinking",
                content: currentThinkingContent,
              });
            }
            setStatus("Thinking...");
            updateMessage();
          }
        } else if (event.type === "text-delta") {
          const chunk = (event.data as any).text ?? "";
          currentTextContent += chunk;

          const lastPart = messageParts[messageParts.length - 1];
          if (lastPart?.type === "text") {
            lastPart.content = currentTextContent;
          } else if (chunk) {
            messageParts.push({ type: "text", content: currentTextContent });
          }
          updateMessage();
        } else if (event.type === "step-start") {
          const iteration = (event.data as any).iteration ?? 1;
          if (iteration > 1) {
            setStatus(`Step ${iteration}...`);
          }
        } else if (event.type === "step-usage") {
          // Live token update during streaming
          //
          // IMPORTANT: Token tracking explanation:
          // - inputTokens: The context sent to the model (conversation history + system prompt)
          // - outputTokens: New tokens generated by the model
          // - sessionTokens: Current context window usage (should be the LATEST inputTokens, not cumulative)
          //
          // The inputTokens from each call already includes the full conversation history,
          // so we should NOT accumulate it. Instead, we track:
          // - Cumulative input/output for cost calculation
          // - Latest input as current context usage
          const usage = event.data as any;
          if (usage.inputTokens) {
            // For cost tracking: accumulate total input tokens sent across all calls
            setInputTokens((prev) => prev + usage.inputTokens);
            setLastTaskInputTokens((prev) => prev + usage.inputTokens);
            // For context usage: use the latest inputTokens as it represents current context size
            // This replaces (not accumulates) because each call sends the full history
            setSessionTokens(usage.inputTokens);
          }
          if (usage.outputTokens) {
            setOutputTokens((prev) => prev + usage.outputTokens);
            setLastTaskOutputTokens((prev) => prev + usage.outputTokens);
          }
          // Note: We no longer accumulate totalTokens for sessionTokens
        } else if (event.type === "rate-limit-wait") {
          const data = event.data as any;
          const waitSeconds = data.waitSeconds ?? 60;
          const retryNumber = data.retryNumber ?? 1;
          const maxRetries = data.maxRetries ?? 3;
          setStatus(
            `Rate limited. Waiting ${waitSeconds}s (retry ${retryNumber}/${maxRetries})...`,
          );
          // Add a message part to show in the chat
          messageParts.push({
            type: "text",
            content: `*Rate limited by provider. Waiting ${waitSeconds} seconds before retry ${retryNumber}/${maxRetries}...*`,
          });
          updateMessage();
        } else if (event.type === "error") {
          const errorText = (event.data as any).error ?? "Unknown error";
          messageParts.push({ type: "error", content: errorText });
          updateMessage();
          setStatus(`Error: ${errorText.slice(0, 40)}`);
        } else if (event.type === "tool-call") {
          const toolData = event.data as any;
          const toolName = toolData.toolName ?? "tool";
          const toolArgs = toolData.args;
          const toolCallId = toolData.toolCallId ?? generateId();

          setRunningTools((prev) => [
            ...prev,
            { id: toolCallId, name: toolName },
          ]);
          setStatus(`Running: ${toolName}`);

          const { name: displayName, detail } = getToolDisplayName(
            toolName,
            toolArgs,
          );
          messageParts.push({
            type: "tool",
            id: toolCallId,
            name: detail ? `${displayName} ${detail}` : displayName,
            args: toolArgs,
            status: "running",
          });
          updateMessage();

          const filePath = toolArgs?.path ?? toolArgs?.file_path;
          if (
            filePath &&
            ["read_file", "write_file", "edit_file"].includes(toolName)
          ) {
            const action =
              toolName === "read_file"
                ? "read"
                : toolName === "write_file"
                  ? "write"
                  : "edit";
            setActiveFiles((prev) =>
              new Map(prev).set(String(filePath), {
                path: String(filePath),
                action: action as any,
                timestamp: Date.now(),
              }),
            );
          }
        } else if (event.type === "tool-result") {
          const resultData = event.data as any;
          const toolResult = resultData.toolResult ?? resultData;
          const resultToolName = toolResult?.toolName ?? "tool";
          const resultToolCallId =
            toolResult?.toolCallId ?? resultData?.toolCallId;
          const isPreliminary = resultData?.preliminary ?? false;
          const resultOutputRaw = toolResult?.result;

          const outputText = (() => {
            if (resultOutputRaw === undefined) return undefined;

            if (
              resultToolName === "write_file" ||
              resultToolName === "write" ||
              resultToolName === "edit_file" ||
              resultToolName === "edit"
            ) {
              // Keep full JSON so we can render unified patch (diff) in the UI.
              if (typeof resultOutputRaw === "string") return resultOutputRaw;
              try {
                return JSON.stringify(resultOutputRaw);
              } catch {
                return String(resultOutputRaw);
              }
            }

            if (typeof resultOutputRaw === "string")
              return truncate(resultOutputRaw, 140);
            try {
              return truncate(JSON.stringify(resultOutputRaw), 140);
            } catch {
              return truncate(String(resultOutputRaw), 140);
            }
          })();

          if (
            resultToolName === "bash" &&
            typeof resultOutputRaw === "string" &&
            resultOutputRaw.includes("Bash command requires approval")
          ) {
            const approvalId =
              (resultOutputRaw.match(/Approval ID:\s*(\S+)/i)?.[1] ?? "").trim();
            const cmd =
              (resultOutputRaw.match(/Command:\s*(.*)$/im)?.[1] ?? "").trim();
            const wd =
              (resultOutputRaw.match(/Workdir:\s*(.*)$/im)?.[1] ?? "").trim();
            if (approvalId) {
              setBashApprovalIndex(0);
              setBashApprovalPrompt({
                approvalId,
                command: cmd || "(unknown)",
                workdir: wd || "(unknown)",
              });
            }
          }

          // For preliminary results, just update the status message but keep tool running
          if (isPreliminary) {
            // Update the tool's output with the preliminary status
            for (let i = messageParts.length - 1; i >= 0; i--) {
              const p = messageParts[i];
              if (p && p.type === "tool") {
                if (
                  (resultToolCallId && p.id === resultToolCallId) ||
                  p.status === "running"
                ) {
                  // Update with preliminary status message
                  const statusMsg =
                    resultOutputRaw?.status ?? resultOutputRaw?.message;
                  if (statusMsg) {
                    (p as ToolPart).output = truncate(String(statusMsg), 80);
                  } else if (outputText) {
                    (p as ToolPart).output = outputText;
                  }
                  break;
                }
              }
            }
            updateMessage();
            continue;
          }

          // Final result - mark tool as done
          setRunningTools((prev) => {
            if (prev.length === 0) return prev;
            if (resultToolCallId) {
              return prev.filter((t) => t.id !== resultToolCallId);
            }
            const idx = prev.findIndex((t) => t.name === resultToolName);
            if (idx === -1) return prev.slice(1);
            return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
          });

          // Mark tool as done
          for (let i = messageParts.length - 1; i >= 0; i--) {
            const p = messageParts[i];
            if (p && p.type === "tool") {
              if (
                (resultToolCallId && p.id === resultToolCallId) ||
                p.status === "running"
              ) {
                (p as ToolPart).status = "done";
                if (outputText && !(p as ToolPart).output) {
                  (p as ToolPart).output = outputText;
                }
                break;
              }
            }
          }
          updateMessage();
          currentTextContent = "";
        } else if (event.type === "finish") {
          // Token counting is now done live via step-usage events
          // This event just signals completion
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        // Extract full error details for better debugging
        let errorMessage = "";
        if (error?.message) {
          errorMessage = error.message;
        }
        if (error?.details) {
          errorMessage += `\n\nDetails: ${typeof error.details === "string" ? error.details : JSON.stringify(error.details, null, 2)}`;
        }
        if (error?.code) {
          errorMessage = `[${error.code}] ${errorMessage}`;
        }
        if (error?.cause) {
          const causeMsg = error.cause?.message ?? String(error.cause);
          errorMessage += `\n\nCause: ${causeMsg}`;
        }
        if (error?.stack && !errorMessage.includes("at ")) {
          // Include relevant stack trace info for debugging
          const stackLines = error.stack.split("\n").slice(0, 5).join("\n");
          errorMessage += `\n\nStack:\n${stackLines}`;
        }
        if (!errorMessage) {
          errorMessage = String(error);
        }

        messageParts.push({
          type: "error",
          content: errorMessage,
        });
        updateMessage();
        setStatus(`Error: ${(error.message ?? String(error)).slice(0, 80)}`);
      }
    }

    // Finalize
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

    const finalContent = messageParts
      .map((p) => {
        if (p.type === "text") return p.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: finalContent,
                      parts: messageParts,
                      isStreaming: false,
                    }
                  : m,
              ),
            }
          : s,
      ),
    );

    // Message already added to session state above

    setIsThinking(false);
    setRunningTools([]);
    if (!abortControllerRef.current?.signal.aborted) {
      // Check if context is getting full and suggest compaction
      const modelInfo = getModel(provider, model);
      const contextLimit = modelInfo?.contextWindow ?? 200000;
      if (shouldCompact(sessionTokens, contextLimit, 0.75)) {
        const percentUsed = Math.round((sessionTokens / contextLimit) * 100);
        setStatus(
          `Completed in ${formatTime(Date.now() - startTime)} | Context ${percentUsed}% full - consider /compact`,
        );
      } else {
        setStatus(`Completed in ${formatTime(Date.now() - startTime)}`);
      }
    }
    setCancelCountdown(null);
  }, [
    input,
    isThinking,
    currentSessionId,
    handleCommand,
    attachedImages,
    sessionTokens,
    provider,
    model,
  ]);

  // Process message queue when not thinking
  useEffect(() => {
    if (!isThinking && messageQueue.length > 0 && !processQueueRef.current) {
      processQueueRef.current = true;
      const nextMessage = messageQueue[0];
      if (nextMessage) {
        setMessageQueue((prev) => prev.slice(1));
        // Set the input and trigger submit after a brief delay
        setInput(nextMessage.text);
        setCursorIndex(nextMessage.text.length);
        setAttachedImages(nextMessage.images);
      }
    }
  }, [isThinking, messageQueue]);

  // Actually submit when processQueueRef is set and input is ready
  useEffect(() => {
    if (processQueueRef.current && input.trim() && !isThinking) {
      processQueueRef.current = false;
      // Trigger submit
      handleSubmit();
    }
  }, [input, isThinking, handleSubmit]);

  const themes = useMemo(() => getAllThemes(), []);

  // Render modal
  const renderModal = () => {
    if (activeModal === "none") return null;

    const modalLeft = Math.floor((terminalWidth - 65) / 2);

    if (activeModal === "help") {
      return (
        <Box position="absolute" marginLeft={modalLeft} marginTop={2}>
          <HelpModal themeColors={themeColors} />
        </Box>
      );
    }

    if (activeModal === "theme") {
      return (
        <Box position="absolute" marginLeft={modalLeft} marginTop={2}>
          <ThemeModal
            themes={themes}
            currentThemeId={themeId}
            selectedIndex={modalSelectionIndex}
            themeColors={themeColors}
          />
        </Box>
      );
    }

    if (activeModal === "models") {
      const allModels =
        dynamicModels.length > 0
          ? dynamicModels
          : (MODEL_CHOICES[provider] ?? []);
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 55) / 2)}
          marginTop={2}
        >
          <ModelsModal
            provider={provider}
            models={allModels}
            currentModel={model}
            selectedIndex={modalSelectionIndex}
            isLoading={isLoadingModels}
            themeColors={themeColors}
          />
        </Box>
      );
    }

    if (activeModal === "sessions") {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 50) / 2)}
          marginTop={2}
        >
          <SessionsModal
            sessions={sessions}
            currentSessionId={currentSessionId}
            selectedIndex={modalSelectionIndex}
          />
        </Box>
      );
    }

    if (activeModal === "provider") {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 45) / 2)}
          marginTop={2}
        >
          <ProviderModal
            providers={PROVIDERS}
            currentProvider={provider}
            selectedIndex={modalSelectionIndex}
          />
        </Box>
      );
    }

    if (activeModal === "settings") {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 50) / 2)}
          marginTop={2}
        >
          <SettingsModal
            provider={provider}
            model={model}
            mode={mode}
            workingDirectory={workingDirectory}
            sessionTokens={sessionTokens}
          />
        </Box>
      );
    }

    if (activeModal === "thinking") {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 55) / 2)}
          marginTop={2}
        >
          <ThinkingModal
            currentLevel={thinking}
            selectedIndex={modalSelectionIndex}
            supportsThinking={supportsThinking}
            themeColors={themeColors}
          />
        </Box>
      );
    }

    if (activeModal === "apikey" && pendingProvider) {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 55) / 2)}
          marginTop={2}
        >
          <ApiKeyModal
            provider={pendingProvider.id}
            providerName={pendingProvider.name}
            envVar={pendingProvider.envVar}
            apiKeyInput={apiKeyInput}
            cursorIndex={apiKeyCursorIndex}
          />
        </Box>
      );
    }

    if (activeModal === "copilot-oauth") {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 60) / 2)}
          marginTop={2}
        >
          <CopilotAuthModal
            userCode={copilotUserCode}
            verificationUri={copilotVerificationUri}
            status={copilotOAuthStatus}
            errorMessage={copilotOAuthError ?? undefined}
          />
        </Box>
      );
    }

    return null;
  };

  const renderBashApprovalPrompt = () => {
    if (!bashApprovalPrompt) return null;
    const modalWidth = Math.min(80, terminalWidth - 4);
    const modalLeft = Math.max(0, Math.floor((terminalWidth - modalWidth) / 2));
    const prefix =
      (bashApprovalPrompt.command.trim().split(/\s+/)[0] ?? "").trim() ||
      "(none)";
    const options = [
      "Allow once",
      `Allow prefix: ${prefix}`,
      "Enable YOLO mode",
      "Cancel",
    ];
    return (
      <Box position="absolute" marginLeft={modalLeft} marginTop={2}>
        <Box
          flexDirection="column"
          width={modalWidth}
          borderStyle="round"
          borderColor={themeColors.warning}
          paddingX={1}
        >
          <Text bold color={themeColors.warning}>
            Bash command requires approval
          </Text>
          <Text color={themeColors.textMuted} dimColor>
            {bashApprovalPrompt.command}
          </Text>
          <Text color={themeColors.textMuted} dimColor>
            {bashApprovalPrompt.workdir}
          </Text>
          <Text> </Text>
          {options.map((opt, idx) => (
            <Text
              key={opt}
              color={idx === bashApprovalIndex ? themeColors.primary : themeColors.text}
            >
              {idx === bashApprovalIndex ? figures.pointer : " "} {opt}
            </Text>
          ))}
          <Text> </Text>
          <Text color={themeColors.textMuted} dimColor>
            ↑↓ select • Enter confirm • Esc cancel
          </Text>
        </Box>
      </Box>
    );
  };

  // Welcome screen
  if (stage === "welcome") {
    return (
      <WelcomeScreen
        workingDirectory={workingDirectory}
        primaryColor={themeColors.primary}
      />
    );
  }

  // Main chat UI
  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header */}
      <Header workingDirectory={workingDirectory} />

      {/* Main Content */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Chat Feed */}
        <Box
          flexDirection="column"
          width={mainWidth}
          paddingX={1}
          height={contentHeight}
          overflow="hidden"
        >
          <ChatFeed
            messages={currentSession.messages}
            width={mainWidth}
            height={contentHeight}
            scrollOffset={scrollOffset}
            workingDirectory={workingDirectory}
            onLineCountChange={setActivityLineCount}
          />
          {renderBashApprovalPrompt()}
        </Box>

        {/* Sidebar */}
      <ContextSidebar
          provider={provider}
          model={model}
          mode={mode}
          themeId={themeId}
          status={status}
          isThinking={isThinking}
          sessionTokens={sessionTokens}
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          lastTaskInputTokens={lastTaskInputTokens}
          lastTaskOutputTokens={lastTaskOutputTokens}
          activeFiles={activeFiles}
          runningTools={runningTools}
          todos={todos}
          width={sidebarWidth}
          height={contentHeight}
          contextLimit={getModel(provider, model)?.contextWindow ?? 200000}
          pricing={getModel(provider, model)?.pricing}
          queueCount={messageQueue.length}
        />
      </Box>

      {/* Footer */}
      <Box flexDirection="column">
        <StatusBar
          status={status}
          isThinking={isThinking}
          elapsedTime={elapsedTime}
          cancelCountdown={cancelCountdown}
          maxWidth={Math.max(10, terminalWidth - 28)}
          thinkingLevel={thinking}
          supportsThinking={supportsThinking}
        />

        <InputBox
          value={input}
          cursorIndex={cursorIndex}
          mode={mode}
          isThinking={isThinking}
          elapsedTime={sessionElapsedTime}
          showAutocomplete={showAutocomplete}
          autocompleteMatches={autocompleteMatches}
          autocompleteIndex={autocompleteIndex}
          attachedImages={attachedImages}
        />
      </Box>

      {renderModal()}
    </Box>
  );
};

export async function runErzenCodeUI(options: {
  baseConfig: CodingAgentConfig;
  configPath: string;
  saveableConfig: ErzencodeConfig;
  showSetup: boolean;
}): Promise<void> {
  const { unmount } = render(<App {...options} onExit={() => unmount()} />);
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });
}
