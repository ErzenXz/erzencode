/**
 * Main Terminal UI Application Component.
 * Orchestrates hooks and services for a clean, maintainable architecture.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";
import type { ProviderType } from "../ai-provider.js";
import type { AgentConfig as CodingAgentConfig, AgentMode as CodingAgentMode } from "../ai-agent.js";
import {
  setBashYoloMode, addBashAllowPrefix, removeBashAllowPrefix,
  approveBashCommandOnce, cancelBashApproval, getBashApprovalStatus, getPendingBashApprovals,
  getTodos, setTodoUpdateCallback, type TodoItem,
} from "../tools-standalone.js";
import { startWebUI, type WebUIHandle } from "../web-ui-new.js";
import { getAllThemes, getCurrentTheme, initTheme, setTheme } from "../themes.js";
import {
  PROVIDERS, type ErzencodeConfig, saveConfig, appendToCommandHistory,
  getApiKeyAsync, setApiKey,
} from "../config.js";
import { modelSupports, preloadDynamicModels, getModel } from "../models.js";
import { compactConversation, formatCompactionResult, createCompactedMessage } from "../compaction.js";
import {
  CodebaseIndexer,
  wasPromptShown,
  markPromptShown,
  getIndexStats,
  getIndexDir,
  loadProjectConfig,
  type IndexingProgress,
  type IndexResult,
  type IndexStats,
  type SearchResult,
} from "../indexer/index.js";
import figures from "figures";

import {
  type Stage, type SlashCommand,
  type ChatMessage,
  MODES, SLASH_COMMANDS, THINKING_LEVELS,
} from "./types.js";
import { generateId, truncate, formatTokens } from "./utils.js";
import {
  ChatFeed, InputBox, StatusBar, WelcomeScreen,
  HelpModal, SettingsModal, ApiKeyModal, CopilotAuthModal,
  IndexModal, SearchModal,
} from "./components/index.js";
import { InlineSelector, type SelectorItem } from "./components/input/InlineSelector.js";
import {
  useInputState, useModalState, useSessionState, useAgentConfig, useAgentStream,
} from "./hooks/index.js";
import { handleKeyboardInput, type InkKey } from "./services/keyboard-handler.js";
import { parseCommand, getCompletions, getCommand } from "./services/command-handler.js";
import {
  createFileSearch,
  expandAtFileMentions,
  getAtMentionAtCursor,
  loadWorkspaceFiles,
} from "./services/file-autocomplete.js";

function clearTerminal(): void {
  // Clear screen + scrollback (supported by most modern terminals)
  // 2J: clear screen, 3J: clear scrollback, H: cursor home, 0m: reset styles
  process.stdout.write("\x1b[0m\x1b[2J\x1b[3J\x1b[H");
}

function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try { spawn(cmd, [url], { stdio: "ignore", detached: true }).unref(); } catch {}
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function normalizePastedPath(raw: string, workingDirectory: string): string {
  let s = raw.trim();
  s = s.replace(/^['"]/, "").replace(/['"]$/, "");

  if (s.startsWith("file://")) {
    s = s.replace(/^file:\/\//, "");
    try { s = decodeURIComponent(s); } catch {}
  }

  // Finder drag/paste commonly uses shell escaping for spaces.
  s = s.replace(/\\ /g, " ");

  if (s.startsWith("~/")) {
    const home = process.env.HOME ?? "";
    if (home) s = path.join(home, s.slice(2));
  }

  return path.isAbsolute(s) ? s : path.resolve(workingDirectory, s);
}

function extractImageCandidates(text: string): string[] {
  const out: string[] = [];

  // data:image/...;base64,...
  const dataUrls =
    text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\n\r]+/g) ?? [];
  out.push(...dataUrls.map((s) => s.replace(/\s+/g, "")));

  // file:///... or path-like tokens
  const pathLike =
    text.match(
      /(file:\/\/\/[^\n\r'"]+\.(?:png|jpe?g|gif|webp))|((?:~\/|\/|\.\/|\.\.\/)[^\n\r'"]+\.(?:png|jpe?g|gif|webp))/gi
    ) ?? [];
  out.push(...pathLike);

  return [...new Set(out)];
}

interface AppProps {
  baseConfig: CodingAgentConfig;
  configPath: string;
  saveableConfig: ErzencodeConfig;
  showSetup: boolean;
  onExit: () => void;
}

export const App: React.FC<AppProps> = ({
  baseConfig, configPath, saveableConfig, showSetup, onExit,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 100;
  // Memoize workingDirectory to prevent new string reference on every render
const workingDirectory = useMemo(() => process.cwd(), []);

  useEffect(() => {
    // Preload model metadata (pricing, context window, etc.) for features like /cost.
    preloadDynamicModels().catch(() => {});
  }, []);

  // Stage
  const [stage, setStage] = useState<Stage>(showSetup ? "welcome" : "chat");

  // Theme
  const [themeId, setThemeId] = useState<string>(() => initTheme(saveableConfig.theme).id);
  // CRITICAL: Memoize themeColors to prevent new object reference on every render
  const themeColors = useMemo(() => getCurrentTheme().colors, [themeId]);

  // Hooks
  const inputState = useInputState();
  const modalState = useModalState();
  const sessionState = useSessionState(workingDirectory, baseConfig.provider as ProviderType, baseConfig.model ?? "gpt-4o");
  const agentConfig = useAgentConfig({
    provider: baseConfig.provider as ProviderType,
    model: baseConfig.model ?? "gpt-4o",
    mode: (baseConfig.mode as CodingAgentMode) ?? "agent",
    thinking: "off",
  });
  const agentStream = useAgentStream({
    provider: agentConfig.provider,
    model: agentConfig.model,
    mode: agentConfig.mode,
    thinking: agentConfig.thinking,
    supportsThinking: agentConfig.supportsThinking,
    workingDirectory,
    baseConfig,
  });

  // Local UI state
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [messageQueue, setMessageQueue] = useState<Array<{ text: string; images: string[] }>>([]);
  const [todos, setTodos] = useState<TodoItem[]>(() => getTodos());
  const [showTodosPanel, setShowTodosPanel] = useState(false);
  const [expandedTools, setExpandedTools] = useState(false);

  useEffect(() => {
    setTodoUpdateCallback((next) => setTodos(next));
    return () => setTodoUpdateCallback(null);
  }, []);

  // Context compaction state:
  // - We keep full chat history for display
  // - But for the *model context*, we can replace older history with a summary.
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [contextCutoffMessageId, setContextCutoffMessageId] = useState<string | null>(null);

  // Reset compaction state when switching sessions
  useEffect(() => {
    setContextSummary(null);
    setContextCutoffMessageId(null);
  }, [sessionState.currentSessionId]);

  // Collapse todo panel when switching sessions
  useEffect(() => {
    setShowTodosPanel(false);
  }, [sessionState.currentSessionId]);

  // Chat internal scrollback (PgUp/PgDn). 0 = follow latest.
  const [scrollOffset, setScrollOffset] = useState(0);

  const [frozenMessages, setFrozenMessages] = useState<ChatMessage[] | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const isScrollback = scrollOffset > 0 || !!frozenMessages;
  const isScrollbackRef = useRef(false);
  const [frozenStatusBar, setFrozenStatusBar] = useState<{
    status: string;
    isThinking: boolean;
    elapsedTime: number;
    cancelCountdown: number | null;
  } | null>(null);

  useEffect(() => {
    isScrollbackRef.current = isScrollback;
  }, [isScrollback]);

  useEffect(() => {
    if (isScrollback) {
      setFrozenStatusBar((prev) =>
        prev ?? {
          status: agentStream.status,
          isThinking: agentStream.isThinking,
          elapsedTime: agentStream.elapsedTime,
          cancelCountdown: agentStream.cancelCountdown,
        }
      );
    } else {
      setFrozenStatusBar(null);
      setStreamingMessage(streamingMessageRef.current);
    }
    // Only run when isScrollback changes, NOT when elapsedTime updates every 250ms
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrollback]);

  useEffect(() => {
    agentStream.setUiPaused(isScrollback);
  }, [agentStream, isScrollback]);
  const displayedMessages = frozenMessages ?? sessionState.currentSession.messages;

  const completedMessageCount = useMemo(() => {
    return sessionState.currentSession.messages.filter((m) => !m.isStreaming).length;
  }, [sessionState.currentSession.messages]);

  const prevCompletedMessageCountRef = useRef(completedMessageCount);

  useEffect(() => {
    const prevCount = prevCompletedMessageCountRef.current;
    const nextCount = completedMessageCount;
    prevCompletedMessageCountRef.current = nextCount;

    const delta = nextCount - prevCount;
    if (delta <= 0) return;

    setScrollOffset((prev) => (prev > 0 && !frozenMessages ? prev + delta : prev));
  }, [completedMessageCount, frozenMessages]);

  useEffect(() => {
    if (scrollOffset === 0 && frozenMessages) {
      setFrozenMessages(null);
    }
  }, [scrollOffset, frozenMessages]);

  // Autocomplete
  const [autocompleteKind, setAutocompleteKind] = useState<"none" | "slash" | "file">("none");
  const [autocompleteMatches, setAutocompleteMatches] = useState<SlashCommand[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Bash approval
  const [bashApprovalIndex, setBashApprovalIndex] = useState(0);

  // API Key Modal
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyCursorIndex, setApiKeyCursorIndex] = useState(0);
  const [pendingProvider, setPendingProvider] = useState<{ id: string; name: string; envVar: string } | null>(null);

  // Modal search
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // Provider status for welcome screen
  const [providerStatuses, setProviderStatuses] = useState<Array<{ id: string; name: string; configured: boolean }>>([]);
  const [isCheckingProviders, setIsCheckingProviders] = useState(true);

  // Copilot OAuth
  const [copilotOAuthStatus, setCopilotOAuthStatus] = useState<"waiting" | "polling" | "success" | "error">("waiting");
  const [copilotUserCode, setCopilotUserCode] = useState<string | null>(null);
  const [copilotVerificationUri, setCopilotVerificationUri] = useState<string | null>(null);
  const [copilotOAuthError, setCopilotOAuthError] = useState<string | null>(null);

  // Indexer state
  const [indexProgress, setIndexProgress] = useState<IndexingProgress | null>(null);
  const [indexLastResult, setIndexLastResult] = useState<IndexResult | null>(null);
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);
  const [indexNeedsApiKey, setIndexNeedsApiKey] = useState(false);
  const [indexApiKeyInput, setIndexApiKeyInput] = useState("");
  const [indexError, setIndexError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasCodebaseIndex, setHasCodebaseIndex] = useState(false);
  const [showIndexPrompt, setShowIndexPrompt] = useState(false);
  const [isFirstRunIndexPrompt, setIsFirstRunIndexPrompt] = useState(false);

  // Refs
  const webUIRef = useRef<WebUIHandle | null>(null);
  const hasSavedConfigRef = useRef(false);
  const processQueueRef = useRef(false);
  const fileSearchRef = useRef<((query: string, limit?: number) => string[]) | null>(null);
  const [isFileIndexReady, setIsFileIndexReady] = useState(false);

  // Memoize dimensions to prevent recalculation on every render
  const mainWidth = useMemo(() => Math.max(30, terminalWidth - 2), [terminalWidth]);

  // Build file index for @file autocomplete
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const files = await loadWorkspaceFiles(workingDirectory);
      if (cancelled) return;
      fileSearchRef.current = createFileSearch(files);
      setIsFileIndexReady(true);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workingDirectory]);

  // Check provider configuration status on mount
  useEffect(() => {
    const checkProviders = async () => {
      setIsCheckingProviders(true);
      const statuses = await Promise.all(
        PROVIDERS.map(async (p) => {
          const apiKey = await getApiKeyAsync(p.id);
          return {
            id: p.id,
            name: p.name,
            configured: !!apiKey || p.id === "ollama",
          };
        })
      );
      setProviderStatuses(statuses);
      setIsCheckingProviders(false);
    };
    checkProviders();
  }, []);

  // Check for first-run indexing prompt
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shown = await wasPromptShown(workingDirectory);
        if (cancelled) return;
        const stats = await getIndexStats(workingDirectory);
        if (cancelled) return;
        setHasCodebaseIndex(stats.exists);
        setIndexStats(stats);
        if (!shown) {
          // Migration-friendly:
          // - If an index already exists, don't prompt; just mark the prompt as "handled".
          // - If no index exists, show the prompt once for this project.
          if (stats.exists) {
            markPromptShown(workingDirectory).catch(() => {});
          } else {
            setShowIndexPrompt(true);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [workingDirectory]);

  // Show first-run index modal prompt (once, when in chat)
  useEffect(() => {
    if (!showIndexPrompt) return;
    if (stage !== "chat") return;

    setShowIndexPrompt(false);
    setIsFirstRunIndexPrompt(true);

    (async () => {
      try {
        const voyageKey = await getApiKeyAsync("voyage");
        setIndexNeedsApiKey(!voyageKey);
        if (!voyageKey) setIndexApiKeyInput("");

        const stats = await getIndexStats(workingDirectory);
        setIndexStats(stats);
        setHasCodebaseIndex(stats.exists);
      } catch {}
      modalState.openModal("index");
    })();
  }, [showIndexPrompt, stage, modalState, workingDirectory]);

  // Save config on changes
  const saveCurrentConfig = useCallback(async () => {
    const nextConfig: ErzencodeConfig = {
      ...saveableConfig, provider: agentConfig.provider, model: agentConfig.model,
      mode: agentConfig.mode, theme: themeId, setupComplete: true,
    };
    await saveConfig(configPath, nextConfig);
  }, [saveableConfig, agentConfig.provider, agentConfig.model, agentConfig.mode, themeId, configPath]);

  useEffect(() => {
    if (!hasSavedConfigRef.current) { hasSavedConfigRef.current = true; return; }
    saveCurrentConfig().catch(() => {});
  }, [agentConfig.provider, agentConfig.model, agentConfig.mode, themeId, saveCurrentConfig]);

  useEffect(() => { setTheme(themeId); }, [themeId]);

  const showAutocomplete = autocompleteKind !== "none";
  const autocompletePrefix = autocompleteKind === "file" ? "@" : "/";

  // Autocomplete effect
  useEffect(() => {
    if (modalState.activeModal !== "none") {
      setAutocompleteKind("none");
      setAutocompleteMatches([]);
      return;
    }

    const atContext = getAtMentionAtCursor(inputState.value, inputState.cursorIndex);
    if (atContext) {
      const search = fileSearchRef.current;
      if (!isFileIndexReady || !search) {
        setAutocompleteKind("none");
        setAutocompleteMatches([]);
        return;
      }

      const paths = search(atContext.query, 12);
      const fileMatches: SlashCommand[] = paths.map((p) => ({ name: p, description: "" }));
      if (fileMatches.length === 0) {
        setAutocompleteKind("none");
        setAutocompleteMatches([]);
        return;
      }

      setAutocompleteMatches(fileMatches);
      setAutocompleteKind("file");
      setAutocompleteIndex(0);
      return;
    }

    const matches = getCompletions(inputState.value);
    if (inputState.value === "/" || (inputState.value.startsWith("/") && matches.length > 0)) {
      setAutocompleteMatches(matches.length > 0 ? matches : SLASH_COMMANDS);
      setAutocompleteKind("slash");
      setAutocompleteIndex(0);
    } else {
      setAutocompleteKind("none");
      setAutocompleteMatches([]);
    }
  }, [inputState.value, inputState.cursorIndex, modalState.activeModal, isFileIndexReady]);

  // Modal item count helper
  const getModalItemCount = useCallback(() => {
    // For searchable modals, filter by search query
    const filterBySearch = (items: string[]) => {
      if (!modalSearchQuery.trim()) return items.length;
      const query = modalSearchQuery.toLowerCase();
      return items.filter((item) => item.toLowerCase().includes(query)).length;
    };

    switch (modalState.activeModal) {
      case "models": return filterBySearch(agentConfig.availableModels);
      case "sessions": return sessionState.sessions.length;
      case "theme": return getAllThemes().length;
      case "provider": {
        if (!modalSearchQuery.trim()) return PROVIDERS.length;
        const query = modalSearchQuery.toLowerCase();
        return PROVIDERS.filter(
          (p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
        ).length;
      }
      case "thinking": return THINKING_LEVELS.length;
      default: return 0;
    }
  }, [modalState.activeModal, agentConfig.availableModels.length, sessionState.sessions.length, modalSearchQuery]);

  // Command handler
  const handleCommand = useCallback((commandLine: string) => {
    const parsed = parseCommand(commandLine);
    if (!parsed) { agentStream.setStatus(`Unknown command`); return; }
    const cmd = getCommand(parsed.command);
    if (!cmd) { agentStream.setStatus(`Unknown: /${parsed.command}`); return; }
    const args = parsed.args;

    switch (cmd.name) {
      case "help": modalState.openModal("help"); break;
      case "models": modalState.openModal("models"); modalState.setSelectionIndex(0); break;
      case "theme":
        modalState.openModal("theme");
        modalState.setSelectionIndex(Math.max(0, getAllThemes().findIndex((t) => t.id === themeId)));
        break;
      case "web":
        (async () => {
          try {
            if (webUIRef.current) { openInBrowser(webUIRef.current.url); agentStream.setStatus(`Web UI: ${webUIRef.current.url}`); return; }
            agentStream.setStatus("Starting web UI...");
            const handle = await startWebUI({
              baseConfig: { ...baseConfig, provider: agentConfig.provider, model: agentConfig.model, mode: agentConfig.mode, workspaceRoot: workingDirectory },
              initialWorkspaceRoot: workingDirectory, provider: agentConfig.provider, model: agentConfig.model, mode: agentConfig.mode, uiMode: "web", openBrowser: true,
            });
            webUIRef.current = handle;
            agentStream.setStatus(`Web UI: ${handle.url}`);
          } catch (e: any) { agentStream.setStatus(`Web UI error: ${e?.message ?? String(e)}`); }
        })();
        break;
      case "vibe":
        (async () => {
          try {
            if (webUIRef.current) { await webUIRef.current.close(); webUIRef.current = null; }
            agentStream.setStatus("Starting Vibe mode...");
            const handle = await startWebUI({
              baseConfig: { ...baseConfig, provider: agentConfig.provider, model: agentConfig.model, mode: agentConfig.mode, workspaceRoot: workingDirectory },
              initialWorkspaceRoot: workingDirectory, provider: agentConfig.provider, model: agentConfig.model, mode: agentConfig.mode, uiMode: "vibe", openBrowser: true,
            });
            webUIRef.current = handle;
            agentStream.setStatus(`Vibe: ${handle.url}`);
          } catch (e: any) { agentStream.setStatus(`Vibe error: ${e?.message ?? String(e)}`); }
        })();
        break;
      case "sessions":
        modalState.openModal("sessions");
        modalState.setSelectionIndex(sessionState.sessions.findIndex((s) => s.id === sessionState.currentSessionId));
        break;
      case "settings": modalState.openModal("settings"); break;
      case "provider":
        modalState.openModal("provider");
        modalState.setSelectionIndex(PROVIDERS.findIndex((p) => p.id === agentConfig.provider));
        break;
      case "thinking":
        modalState.openModal("thinking");
        modalState.setSelectionIndex(THINKING_LEVELS.indexOf(agentConfig.thinking));
        break;
      case "new": {
        const name = args.join(" ") || undefined;
        clearTerminal();
        sessionState.createNewSession(name);
        agentStream.setStatus(`Created: ${name ?? "New session"}`);
        break;
      }
      case "reset":
        sessionState.clearMessages();
        setContextSummary(null);
        setContextCutoffMessageId(null);
        agentStream.setStatus("Session reset");
        break;
      case "clear":
        clearTerminal();
        sessionState.clearMessages();
        setContextSummary(null);
        setContextCutoffMessageId(null);
        setScrollOffset(0);
        agentStream.setStatus("Cleared");
        break;
      case "cost": {
        const modelInfo = getModel(agentConfig.provider, agentConfig.model);
        const pricing = modelInfo?.pricing;
        if (!pricing) {
          sessionState.addMessage({
            id: generateId(),
            role: "system",
            content: `Pricing not available for ${agentConfig.provider}/${agentConfig.model}.\n\nTip: open /models once to load model metadata, or try again in a few seconds.`,
            timestamp: Date.now(),
          });
          agentStream.setStatus("Cost: pricing unavailable");
          break;
        }

        const toUsd = (v: number) => `$${v.toFixed(v < 0.01 ? 4 : 2)}`;
        const inCost = (agentStream.inputTokens / 1_000_000) * pricing.input;
        const outCost = (agentStream.outputTokens / 1_000_000) * pricing.output;
        const total = inCost + outCost;

        const lastIn = (agentStream.lastTaskInputTokens / 1_000_000) * pricing.input;
        const lastOut = (agentStream.lastTaskOutputTokens / 1_000_000) * pricing.output;
        const lastTotal = lastIn + lastOut;

        sessionState.addMessage({
          id: generateId(),
          role: "system",
          content:
            `# Cost\n\n` +
            `**Model:** ${agentConfig.provider}/${agentConfig.model}\n` +
            `**Prices:** input $${pricing.input}/M • output $${pricing.output}/M\n\n` +
            `## Total (this session)\n` +
            `- Input: ${agentStream.inputTokens.toLocaleString()} tokens (${toUsd(inCost)})\n` +
            `- Output: ${agentStream.outputTokens.toLocaleString()} tokens (${toUsd(outCost)})\n` +
            `- **Total:** ${toUsd(total)}\n\n` +
            `## Last task\n` +
            `- Input: ${agentStream.lastTaskInputTokens.toLocaleString()} tokens (${toUsd(lastIn)})\n` +
            `- Output: ${agentStream.lastTaskOutputTokens.toLocaleString()} tokens (${toUsd(lastOut)})\n` +
            `- **Total:** ${toUsd(lastTotal)}`,
          timestamp: Date.now(),
        });
        agentStream.setStatus(`Cost: ${toUsd(total)} total`);
        break;
      }
      case "save": saveCurrentConfig(); agentStream.setStatus("Saved!"); break;
      case "exit": exit(); onExit(); break;
      case "image": {
        const imagePath = args.join(" ").trim();
        if (!imagePath) { agentStream.setStatus("Usage: /image <path>"); break; }
        const supportsVision = modelSupports(agentConfig.provider, agentConfig.model, "vision");
        if (!supportsVision) { agentStream.setStatus(`Model ${agentConfig.model} does not support images`); break; }
        (async () => {
          const fs = await import("node:fs");
          const path = await import("node:path");
          const resolvedPath = path.resolve(workingDirectory, imagePath);
          if (!fs.existsSync(resolvedPath)) { agentStream.setStatus(`File not found: ${imagePath}`); return; }
          const ext = path.extname(resolvedPath).toLowerCase();
          if (![".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) { agentStream.setStatus(`Not an image file: ${ext}`); return; }
          setAttachedImages((prev) => prev.includes(resolvedPath) ? prev : [...prev, resolvedPath]);
          agentStream.setStatus(`Attached: ${path.basename(resolvedPath)}`);
        })();
        break;
      }
      case "compact": {
        const currentMessages = sessionState.currentSession.messages;
        if (currentMessages.length < 3) { agentStream.setStatus("Not enough messages to compact"); break; }
        agentStream.setStatus("Compacting conversation...");
        (async () => {
          try {
            const apiKey = await getApiKeyAsync(agentConfig.provider);
            const messagesToCompact = currentMessages.filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role as "user" | "assistant", content: m.content, timestamp: m.timestamp }));
            const result = await compactConversation(messagesToCompact, { provider: agentConfig.provider, model: agentConfig.model, apiKey: apiKey ?? undefined });
            if (result.success && result.summary) {
              const summaryMessage = createCompactedMessage(result.summary, result.originalMessageCount);
              const markerId = generateId();
              sessionState.addMessage({
                id: markerId,
                role: "system",
                content:
                  `──────────────────────── Context Compacted ────────────────────────\n` +
                  `${summaryMessage.content}\n` +
                  `────────────────────────────────────────────────────────────────────`,
                timestamp: Date.now(),
              });
              setContextSummary(summaryMessage.content);
              setContextCutoffMessageId(markerId);
              agentStream.setStatus(formatCompactionResult(result));
            } else { agentStream.setStatus(`Compaction failed: ${result.error ?? "Unknown error"}`); }
          } catch (e: any) { agentStream.setStatus(`Compaction error: ${e?.message ?? String(e)}`); }
        })();
        break;
      }
      case "bash": {
        (async () => {
          const sub = (args[0] ?? "status").toLowerCase();
          const rest = args.slice(1).join(" ").trim();
          const stripQuotes = (s: string) => s.replace(/^['\"]/, "").replace(/['\"]$/, "").trim();
          try {
            if (sub === "status") {
              const st = await getBashApprovalStatus();
              const prefixes = st.allowPrefixes.length ? st.allowPrefixes.join(", ") : "(none)";
              agentStream.setStatus(`bash approvals: yolo=${st.yolo ? "on" : "off"}; allowPrefixes=${prefixes}`);
            } else if (sub === "pending") {
              const pending = getPendingBashApprovals();
              if (pending.length === 0) { agentStream.setStatus("bash approvals: no pending requests"); return; }
              const lines = pending.slice(0, 3).map((p) => `${p.id}: ${p.command.slice(0, 60)}`).join(" | ");
              agentStream.setStatus(`bash approvals pending (${pending.length}): ${lines}${pending.length > 3 ? " ..." : ""}`);
            } else if (sub === "yolo") {
              const onOff = (args[1] ?? "").toLowerCase();
              if (onOff !== "on" && onOff !== "off") { agentStream.setStatus("Usage: /bash yolo on|off"); return; }
              await setBashYoloMode(onOff === "on");
              agentStream.setStatus(`bash yolo: ${onOff}`);
            } else if (sub === "allow") {
              const prefix = stripQuotes(rest);
              if (!prefix) { agentStream.setStatus('Usage: /bash allow "<prefix>"'); return; }
              await addBashAllowPrefix(prefix);
              agentStream.setStatus(`bash allow prefix added: ${prefix}`);
            } else if (sub === "unallow" || sub === "deny" || sub === "remove") {
              const prefix = stripQuotes(rest);
              if (!prefix) { agentStream.setStatus('Usage: /bash unallow "<prefix>"'); return; }
              await removeBashAllowPrefix(prefix);
              agentStream.setStatus(`bash allow prefix removed: ${prefix}`);
            } else if (sub === "allow-once") {
              const approvalId = (args[1] ?? "").trim();
              if (!approvalId) { agentStream.setStatus("Usage: /bash allow-once <approvalId>"); return; }
              const res = await approveBashCommandOnce(approvalId);
              if (!res.ok) { agentStream.setStatus(`bash allow-once failed: ${res.reason ?? "unknown error"}`); return; }
              agentStream.setStatus("bash allow-once: approved");
            } else {
              agentStream.setStatus("Usage: /bash status | pending | yolo on|off | allow <prefix> | unallow <prefix> | allow-once <id>");
            }
          } catch (e: any) { agentStream.setStatus(`bash approvals error: ${e?.message ?? String(e)}`); }
        })();
        break;
      }
      case "index": {
        // Open index modal
        (async () => {
          try {
            setIsFirstRunIndexPrompt(false);
            const voyageKey = await getApiKeyAsync("voyage");
            setIndexNeedsApiKey(!voyageKey);
            if (!voyageKey) setIndexApiKeyInput("");
            // Load stats
            const stats = await getIndexStats(workingDirectory);
            setIndexStats(stats);
            setHasCodebaseIndex(stats.exists);
            modalState.openModal("index");
          } catch (e: any) {
            setIndexError(e?.message ?? String(e));
            modalState.openModal("index");
          }
        })();
        break;
      }
      case "indexstatus": {
        (async () => {
          try {
            const stats = await getIndexStats(workingDirectory);
            const cfg = await loadProjectConfig(workingDirectory);
            const voyageKeySet = !!(await getApiKeyAsync("voyage"));
            const indexDir = getIndexDir(workingDirectory);

            const existsLine = stats.exists
              ? `✅ Indexed (${stats.totalFiles} files, ${stats.totalChunks} chunks)`
              : "⚠️ Not indexed";

            const lastUpdated =
              stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : "—";
            const size =
              stats.sizeBytes !== undefined
                ? stats.sizeBytes > 1024 * 1024
                  ? `${(stats.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                  : `${(stats.sizeBytes / 1024).toFixed(1)} KB`
                : "—";

            sessionState.addMessage({
              id: generateId(),
              role: "system",
              content:
                `# Index status\n\n` +
                `**Project:** \`${workingDirectory}\`\n\n` +
                `**Status:** ${existsLine}\n\n` +
                `## Details\n` +
                `- **Index dir:** \`${indexDir}\`\n` +
                `- **Voyage key:** ${voyageKeySet ? "set" : "missing"}\n` +
                `- **Embedding model:** ${stats.voyageModel ?? "—"}\n` +
                `- **Last updated:** ${lastUpdated}\n` +
                `- **Size:** ${size}\n\n` +
                `## Project config\n` +
                `- **promptShown:** ${cfg.promptShown ? "yes" : "no"}\n` +
                `- **enabled:** ${cfg.enabled ? "yes" : "no"}\n` +
                `- **autoIndex:** ${cfg.autoIndex ? "yes" : "no"}\n\n` +
                `**Tips:** Run \`/index\` to (re)build. Use \`/search\` once indexed.`,
              timestamp: Date.now(),
            });

            agentStream.setStatus(stats.exists ? "Index: ready" : "Index: not built");
            setHasCodebaseIndex(stats.exists);
            setIndexStats(stats);
          } catch (e: any) {
            agentStream.setStatus(`Index status error: ${e?.message ?? String(e)}`);
          }
        })();
        break;
      }
      case "search": {
        const searchArg = args.join(" ").trim();
        if (searchArg) {
          // Direct search
          (async () => {
            try {
              const voyageKey = await getApiKeyAsync("voyage");
              if (!voyageKey) {
                agentStream.setStatus("Voyage API key required for semantic search. Run /index first.");
                return;
              }
              const stats = await getIndexStats(workingDirectory);
              if (!stats.exists) {
                agentStream.setStatus("No index exists. Run /index first.");
                return;
              }
              agentStream.setStatus("Searching...");
              const indexer = new CodebaseIndexer({
                projectPath: workingDirectory,
                voyageApiKey: voyageKey,
              });
              const results = await indexer.search(searchArg, { limit: 10 });
              if (results.length === 0) {
                agentStream.setStatus(`No results for "${searchArg}"`);
              } else {
                // Show top result in status
                const top = results[0];
                agentStream.setStatus(`Found ${results.length} results. Top: ${top.chunk.file_path}:${top.chunk.start_line}`);
                // Store results for modal
                setSearchResults(results);
                setSearchQuery(searchArg);
                setSearchSelectedIndex(0);
                modalState.openModal("search");
              }
            } catch (e: any) {
              agentStream.setStatus(`Search error: ${e?.message ?? String(e)}`);
            }
          })();
        } else {
          // Open search modal
          (async () => {
            try {
              const stats = await getIndexStats(workingDirectory);
              setHasCodebaseIndex(stats.exists);
              setSearchQuery("");
              setSearchResults([]);
              setSearchSelectedIndex(0);
              modalState.openModal("search");
            } catch {
              modalState.openModal("search");
            }
          })();
        }
        break;
      }
    }
  }, [sessionState, agentConfig, agentStream, themeId, baseConfig, workingDirectory, saveCurrentConfig, exit, onExit, modalState]);

  // Modal selection handler
  const handleModalSelect = useCallback(() => {
    const idx = modalState.selectionIndex;
    switch (modalState.activeModal) {
      case "models": {
        // Filter models by search query
        let filteredModels = agentConfig.availableModels;
        if (modalSearchQuery.trim()) {
          const query = modalSearchQuery.toLowerCase();
          filteredModels = agentConfig.availableModels.filter((m) => m.toLowerCase().includes(query));
        }
        const selectedModel = filteredModels[idx];
        if (selectedModel) { agentConfig.setModel(selectedModel); agentStream.setStatus(`Model: ${selectedModel}`); }
        modalState.closeModal();
        setModalSearchQuery("");
        break;
      }
      case "theme": {
        const themes = getAllThemes();
        const selectedTheme = themes[idx];
        if (selectedTheme) { setTheme(selectedTheme.id); setThemeId(selectedTheme.id); agentStream.setStatus(`Theme: ${selectedTheme.name}`); }
        modalState.closeModal();
        break;
      }
      case "sessions": {
        const selectedSession = sessionState.sessions[idx];
        if (selectedSession) { sessionState.switchSession(selectedSession.id); agentStream.setStatus(`Session: ${selectedSession.name}`); }
        modalState.closeModal();
        break;
      }
      case "provider": {
        // Filter providers by search query
        let filteredProviders = PROVIDERS;
        if (modalSearchQuery.trim()) {
          const query = modalSearchQuery.toLowerCase();
          filteredProviders = PROVIDERS.filter(
            (p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
          );
        }
        const selectedProvider = filteredProviders[idx];
        if (selectedProvider) {
          (async () => {
            const apiKey = await getApiKeyAsync(selectedProvider.id);
            if (apiKey || selectedProvider.id === "ollama") {
              agentConfig.setProvider(selectedProvider.id as ProviderType);
              agentStream.setStatus(`Provider: ${selectedProvider.name}`);
              modalState.closeModal();
              setModalSearchQuery("");
            } else if (selectedProvider.id === "copilot") {
              setCopilotOAuthStatus("waiting"); setCopilotUserCode(null); setCopilotVerificationUri(null); setCopilotOAuthError(null);
              modalState.openModal("copilot-oauth");
              setModalSearchQuery("");
              try {
                const { startDeviceFlow, pollForToken } = await import("../copilot-auth.js");
                const deviceCode = await startDeviceFlow();
                setCopilotUserCode(deviceCode.user_code); setCopilotVerificationUri(deviceCode.verification_uri); setCopilotOAuthStatus("polling");
                const token = await pollForToken(deviceCode.device_code, deviceCode.interval, deviceCode.expires_in);
                await setApiKey("copilot", token);
                setCopilotOAuthStatus("success");
                setTimeout(() => { agentConfig.setProvider("copilot" as ProviderType); agentStream.setStatus("Provider: GitHub Copilot"); modalState.closeModal(); }, 1500);
              } catch (error: any) { setCopilotOAuthStatus("error"); setCopilotOAuthError(error?.message ?? String(error)); }
            } else {
              setPendingProvider({ id: selectedProvider.id, name: selectedProvider.name, envVar: selectedProvider.envVar ?? `${selectedProvider.id.toUpperCase()}_API_KEY` });
              setApiKeyInput(""); setApiKeyCursorIndex(0);
              modalState.openModal("apikey");
              setModalSearchQuery("");
            }
          })();
        } else { modalState.closeModal(); setModalSearchQuery(""); }
        break;
      }
      case "thinking": {
        const selectedLevel = THINKING_LEVELS[idx];
        if (selectedLevel) { agentConfig.setThinking(selectedLevel); agentStream.setStatus(`Thinking: ${selectedLevel}`); }
        modalState.closeModal();
        break;
      }
    }
  }, [modalState, agentConfig, agentStream, sessionState, modalSearchQuery]);

  // Message submission
  const handleSubmit = useCallback(async () => {
    if (!inputState.value.trim()) return;
    const userInput = inputState.value.trim();
    const imagesToSend = [...attachedImages];

    if (imagesToSend.length > 0 && !modelSupports(agentConfig.provider, agentConfig.model, "vision")) {
      agentStream.setStatus(`Model ${agentConfig.model} does not support images`);
      setAttachedImages([]);
      return;
    }

    // Always jump to bottom when you send a new message.
    setScrollOffset(0);

    if (agentStream.isThinking) {
      setMessageQueue((prev) => [...prev, { text: userInput, images: imagesToSend }]);
      inputState.clear();
      setAttachedImages([]);
      agentStream.setStatus(`Queued (${messageQueue.length + 1} waiting)`);
      return;
    }

    inputState.clear();
    inputState.addToHistory(userInput);
    setAutocompleteKind("none");
    setAutocompleteMatches([]);
    appendToCommandHistory(userInput).catch(() => {});

    if (userInput.startsWith("/")) { handleCommand(userInput); return; }

    setAttachedImages([]);

    const allMessages = sessionState.currentSession.messages;
    const cutoffIdx = contextCutoffMessageId
      ? allMessages.findIndex((m) => m.id === contextCutoffMessageId)
      : -1;
    const afterCutoff = (cutoffIdx >= 0 ? allMessages.slice(cutoffIdx + 1) : allMessages).filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    // Build the message history that is actually sent to the model.
    // If we have a compaction summary, we send that as a system message and only include
    // user/assistant messages after the compaction marker.
    const sessionMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      ...(contextSummary ? [{ role: "system" as const, content: contextSummary }] : []),
      ...afterCutoff.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const { expandedInput, displayInput } = await expandAtFileMentions(userInput, workingDirectory);

    setStreamingMessage(null);
    streamingMessageRef.current = null;

    await agentStream.submitMessage(
      expandedInput, imagesToSend, sessionMessages,
      (msg) => sessionState.addMessage(msg),
      (msg) => {
        streamingMessageRef.current = msg;
        if (!isScrollbackRef.current) setStreamingMessage(msg);
      },
      (id, updates) => {
        const prev = streamingMessageRef.current;
        if (!prev || prev.id !== id) return;
        const next = { ...prev, ...updates };
        if (updates.isStreaming === false) {
          streamingMessageRef.current = null;
          if (!isScrollbackRef.current) setStreamingMessage(null);
          sessionState.addMessage(next);
          return;
        }
        streamingMessageRef.current = next;
        if (!isScrollbackRef.current) setStreamingMessage(next);
      },
      (summary, originalCount) => {
        setStreamingMessage(null);
        streamingMessageRef.current = null;
        const summaryMessage = createCompactedMessage(summary, originalCount);
        const markerId = generateId();
        sessionState.addMessage({
          id: markerId,
          role: "system",
          content:
            `──────────────────────── Context Compacted ────────────────────────\n` +
            `${summaryMessage.content}\n` +
            `────────────────────────────────────────────────────────────────────`,
          timestamp: Date.now(),
        });
        setContextSummary(summaryMessage.content);
        setContextCutoffMessageId(markerId);
      },
      displayInput
    );
  }, [
    inputState,
    attachedImages,
    agentStream,
    sessionState,
    handleCommand,
    messageQueue.length,
    contextSummary,
    contextCutoffMessageId,
  ]);

  // Process message queue
  useEffect(() => {
    if (!agentStream.isThinking && messageQueue.length > 0 && !processQueueRef.current) {
      processQueueRef.current = true;
      const nextMessage = messageQueue[0];
      if (nextMessage) {
        setMessageQueue((prev) => prev.slice(1));
        inputState.setValueAndCursor(nextMessage.text);
        setAttachedImages(nextMessage.images);
      }
    }
  }, [agentStream.isThinking, messageQueue, inputState]);

  useEffect(() => {
    if (processQueueRef.current && inputState.value.trim() && !agentStream.isThinking) {
      processQueueRef.current = false;
      handleSubmit();
    }
  }, [inputState.value, agentStream.isThinking, handleSubmit]);

  // Keyboard input handler
  useInput((inputKey, key) => {
    const normalizedInputKey = inputKey ?? "";
    const inkKey: InkKey = {
      return: key.return, escape: key.escape, tab: key.tab, backspace: key.backspace,
      delete: key.delete, upArrow: key.upArrow, downArrow: key.downArrow,
      leftArrow: key.leftArrow, rightArrow: key.rightArrow, pageUp: key.pageUp,
      pageDown: key.pageDown, ctrl: key.ctrl, meta: key.meta, shift: key.shift,
    };

    const action = handleKeyboardInput(normalizedInputKey, inkKey, {
      stage,
      activeModal: modalState.activeModal,
      isThinking: agentStream.isThinking,
      autocompleteKind,
      hasBashApprovalPrompt: !!agentStream.bashApprovalPrompt,
    });

    // Handle bash approval
    if (agentStream.bashApprovalPrompt) {
      if (action.action === "bash-cancel") {
        const { approvalId } = agentStream.bashApprovalPrompt;
        (async () => { try { await cancelBashApproval(approvalId, "user cancelled"); } catch {} finally { agentStream.setBashApprovalPrompt(null); agentStream.setStatus("bash approval: cancelled"); } })();
        return;
      }
      if (action.action === "bash-prev") { setBashApprovalIndex((i) => (i + 4 - 1) % 4); return; }
      if (action.action === "bash-next") { setBashApprovalIndex((i) => (i + 1) % 4); return; }
      if (action.action === "bash-select") {
        const { approvalId, command } = agentStream.bashApprovalPrompt;
        const prefix = command.trim().split(/\s+/)[0] ?? "";
        (async () => {
          try {
            if (bashApprovalIndex === 0) { const res = await approveBashCommandOnce(approvalId); agentStream.setStatus(res.ok ? "bash allow-once: approved" : `bash allow-once failed: ${res.reason ?? "unknown error"}`); }
            else if (bashApprovalIndex === 1) { if (!prefix) { agentStream.setStatus("bash allow prefix failed: empty prefix"); } else { await addBashAllowPrefix(prefix); agentStream.setStatus(`bash allow prefix added: ${prefix}`); } }
            else if (bashApprovalIndex === 2) { await setBashYoloMode(true); agentStream.setStatus("bash yolo: on"); }
            else { await cancelBashApproval(approvalId, "user cancelled"); agentStream.setStatus("bash approval: cancelled"); }
          } catch (e: any) { agentStream.setStatus(`bash approval error: ${e?.message ?? String(e)}`); }
          finally { agentStream.setBashApprovalPrompt(null); }
        })();
        return;
      }
      return;
    }

    // Handle actions
    switch (action.type) {
      case "exit": exit(); onExit(); break;
      case "navigation":
        if (action.action === "start-chat") setStage("chat");
        break;
      case "scroll": {
        // Internal chat scrollback: larger offset = further back in history.
        const pageStep = 5;
        const halfPageStep = 10;
        if (action.action === "page-up") {
          setFrozenMessages((prev) => {
            if (prev) return prev;
            const snapshot = [...sessionState.currentSession.messages];
            if (streamingMessage) snapshot.push({ ...streamingMessage, isStreaming: false });
            return snapshot;
          });
          // Let ChatFeed clamp based on actual message count; clamping here can race
          // with max offset calculation and make scrolling feel "stuck".
          setScrollOffset((prev) => prev + pageStep);
        } else if (action.action === "page-down") {
          setScrollOffset((prev) => Math.max(0, prev - pageStep));
        } else if (action.action === "half-page-up") {
          setFrozenMessages((prev) => {
            if (prev) return prev;
            const snapshot = [...sessionState.currentSession.messages];
            if (streamingMessage) snapshot.push({ ...streamingMessage, isStreaming: false });
            return snapshot;
          });
          setScrollOffset((prev) => prev + halfPageStep);
        } else if (action.action === "half-page-down") {
          setScrollOffset((prev) => Math.max(0, prev - halfPageStep));
        }
        break;
      }
      case "modal":
        if (action.action === "close") {
          const wasIndexModal = modalState.activeModal === "index";
          const shouldMarkPrompt = wasIndexModal && isFirstRunIndexPrompt;
          modalState.closeModal();
          setPendingProvider(null);
          setApiKeyInput("");
          setApiKeyCursorIndex(0);
          setModalSearchQuery("");
          if (shouldMarkPrompt) {
            setIsFirstRunIndexPrompt(false);
            markPromptShown(workingDirectory).catch(() => {});
          }
        }
        else if (action.action === "navigate-up") modalState.navigateSelection("up", getModalItemCount());
        else if (action.action === "navigate-down") modalState.navigateSelection("down", getModalItemCount());
        else if (action.action === "select") handleModalSelect();
        else if (action.action === "submit" && modalState.activeModal === "apikey" && apiKeyInput.trim() && pendingProvider) {
          (async () => {
            try { await setApiKey(pendingProvider.id, apiKeyInput.trim()); agentConfig.setProvider(pendingProvider.id as ProviderType); agentStream.setStatus(`Provider: ${pendingProvider.name} (key saved)`); }
            catch { agentStream.setStatus("Failed to save API key"); }
            modalState.closeModal(); setPendingProvider(null); setApiKeyInput(""); setApiKeyCursorIndex(0); setModalSearchQuery("");
          })();
        }
        else if (action.action === "submit" && modalState.activeModal === "index") {
          (async () => {
            try {
              setIndexError(null);

              // Ensure Voyage key exists (prompt allows entering it)
              let voyageKey = await getApiKeyAsync("voyage");
              if (!voyageKey) {
                const nextKey = indexApiKeyInput.trim();
                if (!nextKey) {
                  setIndexNeedsApiKey(true);
                  agentStream.setStatus("Paste Voyage API key");
                  return;
                }
                await setApiKey("voyage", nextKey);
                setIndexApiKeyInput("");
                setIndexNeedsApiKey(false);
                voyageKey = nextKey;
              }

              agentStream.setStatus("Indexing...");
              const indexer = new CodebaseIndexer({
                projectPath: workingDirectory,
                voyageApiKey: voyageKey,
                onProgress: (p) => setIndexProgress(p),
              });

              const result = await indexer.index();
              setIndexLastResult(result);
              const stats = await getIndexStats(workingDirectory);
              setIndexStats(stats);
              setHasCodebaseIndex(stats.exists);
              setIndexProgress({ phase: "done", current: result.filesIndexed, total: result.filesIndexed, message: "Done" } as any);
              await markPromptShown(workingDirectory);
              setIsFirstRunIndexPrompt(false);
              agentStream.setStatus("Indexed");
            } catch (e: any) {
              setIndexError(e?.message ?? String(e));
              agentStream.setStatus("Index error");
            }
          })();
        }
        else if (action.action === "continue" && modalState.activeModal === "copilot-oauth" && copilotOAuthStatus === "success") { modalState.closeModal(); setModalSearchQuery(""); }
        break;
      case "input":
        if (modalState.activeModal === "apikey") {
          if (action.action === "backspace" && apiKeyCursorIndex > 0) { setApiKeyInput((prev) => prev.slice(0, apiKeyCursorIndex - 1) + prev.slice(apiKeyCursorIndex)); setApiKeyCursorIndex((prev) => prev - 1); }
          else if (action.action === "cursor-left") setApiKeyCursorIndex((prev) => Math.max(0, prev - 1));
          else if (action.action === "cursor-right") setApiKeyCursorIndex((prev) => Math.min(apiKeyInput.length, prev + 1));
          else if (action.action === "insert" && action.payload) { setApiKeyInput((prev) => prev.slice(0, apiKeyCursorIndex) + String(action.payload) + prev.slice(apiKeyCursorIndex)); setApiKeyCursorIndex((prev) => prev + String(action.payload).length); }
        } else if (modalState.activeModal === "index") {
          // Handle index modal API key input
          if (action.action === "backspace") { setIndexApiKeyInput((prev) => prev.slice(0, -1)); }
          else if (action.action === "insert" && action.payload) { setIndexApiKeyInput((prev) => prev + String(action.payload)); }
        } else if (["models", "provider", "theme", "sessions", "thinking"].includes(modalState.activeModal)) {
          // Handle search input for searchable modals / selectors
          if (action.action === "backspace") { setModalSearchQuery((prev) => prev.slice(0, -1)); modalState.setSelectionIndex(0); }
          else if (action.action === "insert" && action.payload) { setModalSearchQuery((prev) => prev + String(action.payload)); modalState.setSelectionIndex(0); }
        } else {
          if (action.action === "backspace") inputState.deleteChar("backward");
          else if (action.action === "delete") inputState.deleteChar("forward");
          else if (action.action === "cursor-left") inputState.moveCursor("left");
          else if (action.action === "cursor-right") inputState.moveCursor("right");
          else if (action.action === "cursor-start") inputState.moveCursor("start");
          else if (action.action === "cursor-end") inputState.moveCursor("end");
          else if (action.action === "newline") inputState.insertText("\n");
          else if (action.action === "insert" && action.payload) {
            const payloadText = String(action.payload);
            const candidates = extractImageCandidates(payloadText);

            if (candidates.length === 0) {
              inputState.insertText(payloadText);
              break;
            }

            const supportsVision = modelSupports(agentConfig.provider, agentConfig.model, "vision");
            if (!supportsVision) {
              agentStream.setStatus(`Model ${agentConfig.model} does not support images`);
              inputState.insertText(payloadText);
              break;
            }

            let nextAttached = [...attachedImages];
            let insertText = payloadText;
            let added = 0;

            for (const rawCandidate of candidates) {
              const isDataUrl = rawCandidate.startsWith("data:image/");
              const normalized = isDataUrl
                ? rawCandidate.replace(/\s+/g, "")
                : normalizePastedPath(rawCandidate, workingDirectory);

              if (!isDataUrl) {
                const ext = path.extname(normalized).toLowerCase();
                if (!IMAGE_EXTS.has(ext)) continue;
                try {
                  const st = fs.statSync(normalized);
                  if (!st.isFile()) continue;
                  if (st.size > 8 * 1024 * 1024) {
                    agentStream.setStatus(`Image too large (>8MB): ${path.basename(normalized)}`);
                    continue;
                  }
                } catch {
                  continue;
                }
              }

              if (!nextAttached.includes(normalized)) {
                nextAttached.push(normalized);
                added++;
              }

              const idx = nextAttached.indexOf(normalized);
              const label = `[Image ${idx + 1}]`;
              insertText = insertText.split(rawCandidate).join(label);
            }

            if (added > 0) {
              if (nextAttached.length > 8) {
                nextAttached = nextAttached.slice(0, 8);
                agentStream.setStatus("Max 8 images attached");
              } else {
                agentStream.setStatus(`Attached ${added} image${added > 1 ? "s" : ""}`);
              }
              setAttachedImages(nextAttached);
            }

            if (insertText.trim()) {
              inputState.insertText(insertText);
            }
          }
        }
        break;
      case "autocomplete":
        if (action.action === "navigate-up") setAutocompleteIndex((prev) => prev > 0 ? prev - 1 : autocompleteMatches.length - 1);
        else if (action.action === "navigate-down") setAutocompleteIndex((prev) => prev < autocompleteMatches.length - 1 ? prev + 1 : 0);
        else if (action.action === "close") {
          setAutocompleteKind("none");
          setAutocompleteMatches([]);
          setAutocompleteIndex(0);
        }
        else if (action.action === "complete" || action.action === "select") {
          const selected = autocompleteMatches[autocompleteIndex];
          if (selected) {
            if (autocompleteKind === "slash") {
              // Execute on Enter for commands that don't require args.
              // (Fixes needing Enter twice when autocomplete is open.)
              const requiresArgs = new Set(["bash", "image"]);
              if (action.action === "select" && !requiresArgs.has(selected.name)) {
                inputState.clear();
                handleCommand(`/${selected.name}`);
              } else {
                inputState.setValueAndCursor(`/${selected.name} `);
              }
              setAutocompleteKind("none");
              setAutocompleteMatches([]);
              setAutocompleteIndex(0);
            } else if (autocompleteKind === "file") {
              const mention = getAtMentionAtCursor(inputState.value, inputState.cursorIndex);
              if (mention) {
                const before = inputState.value.slice(0, mention.start);
                const after = inputState.value.slice(mention.end);
                const insertion = `@${selected.name} `;
                const next = `${before}${insertion}${after}`;
                const nextCursor = (before + insertion).length;
                inputState.setValueAndCursor(next, nextCursor);
              } else {
                inputState.insertText(`@${selected.name} `);
              }
              setAutocompleteKind("none");
              setAutocompleteMatches([]);
              setAutocompleteIndex(0);
            }
          }
        }
        break;
      case "history":
        if (isScrollback) {
          if (action.action === "navigate-up") {
            setFrozenMessages((prev) => {
              if (prev) return prev;
              const snapshot = [...sessionState.currentSession.messages];
              if (streamingMessageRef.current) snapshot.push({ ...streamingMessageRef.current, isStreaming: false });
              return snapshot;
            });
            setScrollOffset((prev) => prev + 1);
          } else if (action.action === "navigate-down") {
            setScrollOffset((prev) => Math.max(0, prev - 1));
          }
        } else {
          if (action.action === "navigate-up") inputState.navigateHistory("up");
          else if (action.action === "navigate-down") inputState.navigateHistory("down");
        }
        break;
      case "cancel": agentStream.cancel(); break;
      case "command":
        if (action.action === "submit") handleSubmit();
        else if (action.action === "switch-mode") {
          const currentIndex = MODES.indexOf(agentConfig.mode);
          const nextMode = MODES[(currentIndex + 1) % MODES.length]!;
          agentConfig.setMode(nextMode);
          // Don't spam status with mode; the ModeSelector already shows it.
          // Keep status stable so it doesn't read like "Mode: Agent".
          if (agentStream.status.startsWith("Mode:")) agentStream.setStatus("Ready");
        } else if (action.action === "toggle-todos") {
          setShowTodosPanel((prev) => !prev);
        } else if (action.action === "toggle-tool-expand") {
          setExpandedTools((prev) => !prev);
        }
        break;
    }
  });

  const modelInfo = useMemo(() => getModel(agentConfig.provider, agentConfig.model), [agentConfig.provider, agentConfig.model]);
  const contextLimit = modelInfo?.contextWindow ?? 200000;
  const contextLeft = Math.max(0, contextLimit - agentStream.sessionTokens);
  const contextLeftPct = contextLimit > 0 ? Math.max(0, Math.round((contextLeft / contextLimit) * 100)) : 0;

  const inProgressTodo = useMemo(() => {
    return todos.find((t) => t.status === "in_progress");
  }, [todos]);

  const todoSummaryLine = useMemo(() => {
    if (!inProgressTodo) return "";
    const prefix = "[>] ";
    const max = Math.max(10, terminalWidth - 20);
    return prefix + truncate(`${inProgressTodo.id}: ${inProgressTodo.content}`, max);
  }, [inProgressTodo, terminalWidth]);

  const themes = useMemo(() => getAllThemes(), []);

  // Memoize StatusBar props to prevent unnecessary re-renders
  // IMPORTANT: These props are used in React.memo comparison, so they must be stable
  const statusBarProps = useMemo(() => ({
    status: frozenStatusBar?.status ?? agentStream.status,
    isThinking: frozenStatusBar?.isThinking ?? agentStream.isThinking,
    elapsedTime: frozenStatusBar?.elapsedTime ?? agentStream.elapsedTime,
    cancelCountdown: frozenStatusBar?.cancelCountdown ?? agentStream.cancelCountdown,
    maxWidth: Math.max(10, terminalWidth - 28),
    thinkingLevel: agentConfig.thinking,
    supportsThinking: agentConfig.supportsThinking,
    themeColors,
  }), [
    frozenStatusBar,
    agentStream.status,
    agentStream.isThinking,
    agentStream.elapsedTime,
    agentStream.cancelCountdown,
    terminalWidth,
    agentConfig.thinking,
    agentConfig.supportsThinking,
    themeColors,
  ]);

  // Build selector items for inline selection
  const configuredProviderIds = useMemo(
    () => providerStatuses.filter((p) => p.configured).map((p) => p.id),
    [providerStatuses]
  );

  const modelItems: SelectorItem[] = useMemo(() => {
    const filtered = modalSearchQuery.trim()
      ? agentConfig.availableModels.filter((m) => m.toLowerCase().includes(modalSearchQuery.toLowerCase()))
      : agentConfig.availableModels;
    return filtered.map((m) => ({
      id: m,
      label: m,
      status: m === agentConfig.model ? "current" : "none",
      extra: getModel(agentConfig.provider, m)?.pricing 
        ? `$${getModel(agentConfig.provider, m)?.pricing?.input?.toFixed(2) ?? '-'}/M in`
        : undefined,
    }));
  }, [agentConfig.availableModels, agentConfig.model, agentConfig.provider, modalSearchQuery]);

  const providerItems: SelectorItem[] = useMemo(() => {
    const filtered = modalSearchQuery.trim()
      ? PROVIDERS.filter((p) => 
          p.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(modalSearchQuery.toLowerCase())
        )
      : PROVIDERS;
    return filtered.map((p) => ({
      id: p.id,
      label: p.name,
      description: p.description,
      status: p.id === agentConfig.provider 
        ? "current" 
        : configuredProviderIds.includes(p.id) || p.id === "ollama"
          ? "configured"
          : "needs-key",
    }));
  }, [agentConfig.provider, configuredProviderIds, modalSearchQuery]);

  const themeItems: SelectorItem[] = useMemo(() => 
    themes.map((t) => ({
      id: t.id,
      label: t.name,
      status: t.id === themeId ? "current" : "none",
    })),
    [themes, themeId]
  );

  const sessionItems: SelectorItem[] = useMemo(() =>
    sessionState.sessions.map((s) => ({
      id: s.id,
      label: s.name,
      status: s.id === sessionState.currentSessionId ? "current" : "none",
      extra: `${s.messages.length} messages`,
    })),
    [sessionState.sessions, sessionState.currentSessionId]
  );

  const thinkingItems: SelectorItem[] = useMemo(() =>
    THINKING_LEVELS.map((level) => ({
      id: level,
      label: level.charAt(0).toUpperCase() + level.slice(1),
      status: level === agentConfig.thinking ? "current" : "none",
      description: level === "off" ? "Disabled" : level === "low" ? "~1K tokens" : level === "medium" ? "~4K tokens" : "~16K tokens",
    })),
    [agentConfig.thinking]
  );

  // Render inline selector or modal
  const renderInlineSelector = () => {
    if (modalState.activeModal === "none") return null;

    // Use InlineSelector for simple selection lists
    if (modalState.activeModal === "models") {
      if (agentConfig.isLoadingModels) {
        return (
          <Box borderStyle="round" borderColor={themeColors.primary} paddingX={1} marginX={1} marginBottom={1}>
            <Text color={themeColors.warning}>Loading models...</Text>
          </Box>
        );
      }
      return (
        <InlineSelector
          title={`Models (${agentConfig.provider})`}
          items={modelItems}
          selectedIndex={modalState.selectionIndex}
          searchQuery={modalSearchQuery}
          themeColors={themeColors}
          showSearch={true}
        />
      );
    }

    if (modalState.activeModal === "provider") {
      return (
        <InlineSelector
          title="Providers"
          items={providerItems}
          selectedIndex={modalState.selectionIndex}
          searchQuery={modalSearchQuery}
          themeColors={themeColors}
          showSearch={true}
        />
      );
    }

    if (modalState.activeModal === "theme") {
      return (
        <InlineSelector
          title="Themes"
          items={themeItems}
          selectedIndex={modalState.selectionIndex}
          themeColors={themeColors}
          showSearch={false}
        />
      );
    }

    if (modalState.activeModal === "sessions") {
      return (
        <InlineSelector
          title="Sessions"
          items={sessionItems}
          selectedIndex={modalState.selectionIndex}
          themeColors={themeColors}
          showSearch={false}
        />
      );
    }

    if (modalState.activeModal === "thinking") {
      return (
        <InlineSelector
          title="Thinking Level"
          items={thinkingItems}
          selectedIndex={modalState.selectionIndex}
          themeColors={themeColors}
          showSearch={false}
          maxItems={4}
        />
      );
    }

    // Complex modals that need more UI
    if (modalState.activeModal === "help") return <HelpModal themeColors={themeColors} />;
    if (modalState.activeModal === "settings") return <SettingsModal provider={agentConfig.provider} model={agentConfig.model} mode={agentConfig.mode} workingDirectory={workingDirectory} sessionTokens={agentStream.sessionTokens} themeColors={themeColors} />;
    if (modalState.activeModal === "apikey" && pendingProvider) return <ApiKeyModal provider={pendingProvider.id} providerName={pendingProvider.name} envVar={pendingProvider.envVar} apiKeyInput={apiKeyInput} cursorIndex={apiKeyCursorIndex} themeColors={themeColors} />;
    if (modalState.activeModal === "copilot-oauth") return <CopilotAuthModal userCode={copilotUserCode} verificationUri={copilotVerificationUri} status={copilotOAuthStatus} errorMessage={copilotOAuthError ?? undefined} themeColors={themeColors} />;
    if (modalState.activeModal === "index") return <IndexModal progress={indexProgress} lastResult={indexLastResult} stats={indexStats} needsApiKey={indexNeedsApiKey} apiKeyInput={indexApiKeyInput} error={indexError} isFirstRunPrompt={isFirstRunIndexPrompt} themeColors={themeColors} />;
    if (modalState.activeModal === "search") return <SearchModal query={searchQuery} results={searchResults} selectedIndex={searchSelectedIndex} isSearching={isSearching} hasIndex={hasCodebaseIndex} error={null} borderColor={themeColors.primary} />;
    return null;
  };

  const renderBashApprovalPrompt = () => {
    if (!agentStream.bashApprovalPrompt) return null;
    const modalWidth = Math.min(80, terminalWidth - 4);
    const modalLeft = Math.max(0, Math.floor((terminalWidth - modalWidth) / 2));
    const prefix = (agentStream.bashApprovalPrompt.command.trim().split(/\s+/)[0] ?? "").trim() || "(none)";
    const options = ["Allow once", `Allow prefix: ${prefix}`, "Enable YOLO mode", "Cancel"];
    return (
      <Box position="absolute" marginLeft={modalLeft} marginTop={2}>
        <Box flexDirection="column" width={modalWidth} borderStyle="round" borderColor={themeColors.warning} paddingX={1}>
          <Text bold color={themeColors.warning}>Bash command requires approval</Text>
          <Text color={themeColors.textMuted} dimColor>{agentStream.bashApprovalPrompt.command}</Text>
          <Text color={themeColors.textMuted} dimColor>{agentStream.bashApprovalPrompt.workdir}</Text>
          <Text> </Text>
          {options.map((opt, idx) => <Text key={opt} color={idx === bashApprovalIndex ? themeColors.primary : themeColors.text}>{idx === bashApprovalIndex ? figures.pointer : " "} {opt}</Text>)}
          <Text> </Text>
          <Text color={themeColors.textMuted} dimColor>↑↓ select • Enter confirm • Esc cancel</Text>
        </Box>
      </Box>
    );
  };

  // Welcome screen
  if (stage === "welcome") return (
    <WelcomeScreen 
      workingDirectory={workingDirectory} 
      primaryColor={themeColors.primary}
      themeColors={themeColors}
      version="0.2.0"
      provider={agentConfig.provider}
      model={agentConfig.model}
      providerStatuses={providerStatuses}
      isCheckingProviders={isCheckingProviders}
    />
  );

  // Main chat UI - Simple layout with header at top
  return (
    <Box flexDirection="column">
      {/* Chat content - flexGrow to take available space */}
      <Box flexDirection="column" width={mainWidth} paddingX={1} flexGrow={1}>
        <ChatFeed
          messages={displayedMessages}
          streamingMessage={
            scrollOffset === 0 && !frozenMessages
              ? streamingMessage?.isStreaming
                ? streamingMessage
                : undefined
              : undefined
          }
          width={mainWidth}
          workingDirectory={workingDirectory}
          themeColors={themeColors}
          scrollOffset={scrollOffset}
          expandedTools={expandedTools}
          provider={agentConfig.provider}
          model={agentConfig.model}
        />
        {renderBashApprovalPrompt()}
      </Box>

      {/* Bottom area - inline selectors, status, input */}
      <Box flexDirection="column">
        {modalState.activeModal !== "none" && renderInlineSelector()}
        
        {/* Status and context info */}
        <Box paddingX={1} justifyContent="space-between">
          <StatusBar {...statusBarProps} />
          <Box gap={2}>
            <Text color={themeColors.textDim}>
              {contextLeftPct}% ctx
            </Text>
            {expandedTools && (
              <Text color={themeColors.info}>expanded</Text>
            )}
            <Text color={themeColors.textDim}>
              {inProgressTodo ? `[>] ${inProgressTodo.id}` : ""}
            </Text>
          </Box>
        </Box>

        {/* Expanded todo panel */}
        {showTodosPanel && (
          <Box
            borderStyle="round"
            borderColor={themeColors.border}
            marginX={1}
            paddingX={1}
            flexDirection="column"
          >
            <Box justifyContent="space-between">
              <Text color={themeColors.primary} bold>Todos</Text>
              <Text color={themeColors.textMuted} dimColor>Ctrl+T to close</Text>
            </Box>
            {todos.length === 0 ? (
              <Text color={themeColors.textMuted} dimColor>No todos yet.</Text>
            ) : (
              todos.map((t) => {
                const icon =
                  t.status === "completed"
                    ? "[x]"
                    : t.status === "in_progress"
                      ? "[>]"
                      : t.status === "cancelled"
                        ? "[-]"
                        : "[ ]";
                const color =
                  t.status === "in_progress"
                    ? themeColors.warning
                    : t.status === "completed"
                      ? themeColors.success
                      : t.status === "cancelled"
                        ? themeColors.textMuted
                        : themeColors.text;
                return (
                  <Text key={t.id} color={color}>
                    {icon} {t.id}: {t.content}
                  </Text>
                );
              })
            )}
          </Box>
        )}

        <InputBox
          value={inputState.value}
          cursorIndex={inputState.cursorIndex}
          mode={agentConfig.mode}
          isThinking={agentStream.isThinking}
          showAutocomplete={showAutocomplete}
          autocompleteMatches={autocompleteMatches}
          autocompleteIndex={autocompleteIndex}
          autocompletePrefix={autocompletePrefix}
          attachedImages={attachedImages}
          themeColors={themeColors}
          hideComposer={["models", "provider", "theme", "sessions", "thinking"].includes(modalState.activeModal)}
        />
      </Box>
    </Box>
  );
};

export async function runErzenCodeUI(options: {
  baseConfig: CodingAgentConfig;
  configPath: string;
  saveableConfig: ErzencodeConfig;
  showSetup: boolean;
}): Promise<void> {
  // Prevent SDK warnings / raw error objects from corrupting the Ink UI.
  // We still surface real errors inside the chat UI.
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (...args: any[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith("AI SDK Warning")) return;
    if (typeof first === "string" && first.startsWith("AI SDK Warning System")) return;
    if (typeof first === "string" && first.includes("temperature") && first.includes("not supported")) return;
    origWarn(...args);
  };
  console.error = (...args: any[]) => {
    const first = args[0];
    // Filter raw OpenAI rate limit error objects that sometimes get printed by dependencies.
    if (first && typeof first === "object") {
      const code = (first as any)?.error?.code ?? (first as any)?.code;
      if (code === "rate_limit_exceeded") return;
    }
    if (typeof first === "string" && first.startsWith("AI SDK Warning")) return;
    origError(...args);
  };

  clearTerminal();
  const { unmount } = render(<App {...options} onExit={() => unmount()} />);
  process.on("SIGINT", () => { unmount(); process.exit(0); });
}
