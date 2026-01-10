import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Text, render, useApp, useInput, useStdin, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import {
  createAIAgent,
  type AgentConfig,
  type AgentMode,
  type StreamEvent,
} from "./ai-agent.js";
import { renderMarkdown, renderMarkdownWithWidth } from "./markdown.js";
import {
  setTodoUpdateCallback,
  getTodos,
  type TodoItem,
  setBashYoloMode,
  addBashAllowPrefix,
  cancelBashApproval,
  approveBashCommandOnce,
  getBashApprovalStatus,
  getPendingBashApprovals,
  removeBashAllowPrefix,
} from "./tools-standalone.js";
import { startWebUI, type WebUIHandle } from "./web-ui.js";
import {
  getAllThemes,
  getCurrentTheme,
  initTheme,
  setTheme,
} from "./themes.js";
import {
  DEFAULT_MODELS,
  MODEL_CHOICES,
  PROVIDERS,
  resolveThinkingConfig,
  fetchProviderModels,
  modelSupportsThinking,
  type ThinkingLevel,
  type ErzencodeConfig,
  type SessionMessage,
  saveConfig,
  appendToCommandHistory,
} from "./config.js";
import { preloadDynamicModels } from "./models.js";
import type { ProviderType } from "./ai-provider.js";
import figures from "figures";

// ============================================================================
// Types
// ============================================================================

type Stage = "welcome" | "chat";
type ModalType =
  | "none"
  | "models"
  | "sessions"
  | "settings"
  | "help"
  | "provider"
  | "theme";

interface UIProps {
  baseConfig: AgentConfig;
  configPath: string;
  saveableConfig: ErzencodeConfig;
  showSetup: boolean;
  onExit: () => void;
}

// Message part types for structured rendering
interface ThinkingPart {
  type: "thinking";
  content: string;
}
interface ActionPart {
  type: "action";
  content: string;
}
interface ToolPart {
  type: "tool";
  id?: string;
  name: string;
  input?: string;
  output?: string;
  status: "running" | "done";
}
interface TextPart {
  type: "text";
  content: string;
}
type MessagePart = ThinkingPart | ActionPart | ToolPart | TextPart;

interface ChatMessage extends SessionMessage {
  isStreaming?: boolean;
  parts?: MessagePart[];
}

interface FileInfo {
  path: string;
  action: "read" | "write" | "edit";
  timestamp: number;
}

interface SessionState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  messages: ChatMessage[];
  provider: ProviderType;
  model: string;
}

interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_COLORS: Record<AgentMode, string> = {
  plan: "yellow",
  agent: "blue",
  ask: "green",
};

const MODES: AgentMode[] = ["plan", "agent", "ask"];

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "help", aliases: ["h", "?"], description: "Show help and shortcuts" },
  { name: "models", aliases: ["m"], description: "Select AI model" },
  { name: "sessions", aliases: ["s"], description: "Manage sessions" },
  { name: "settings", description: "View/change settings" },
  { name: "theme", description: "Select theme" },
  { name: "web", description: "Open web UI" },
  { name: "provider", aliases: ["p"], description: "Switch provider" },
  { name: "bash", description: "Manage bash tool approvals (yolo/allow/allow-once)" },
  { name: "new", aliases: ["n"], description: "Create new session" },
  { name: "reset", aliases: ["r"], description: "Reset current session" },
  { name: "clear", aliases: ["c"], description: "Clear messages" },
  { name: "save", description: "Save configuration" },
  { name: "exit", aliases: ["quit", "q"], description: "Exit erzencode" },
];

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + "...";
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function wrapText(input: string, width: number): string[] {
  const w = Math.max(10, width);
  const lines: string[] = [];

  for (const rawLine of (input ?? "").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      lines.push("");
      continue;
    }

    const words = line.split(/\s+/g);
    let current = "";

    const pushCurrent = () => {
      if (current) lines.push(current);
      current = "";
    };

    for (const word of words) {
      if (!word) continue;

      if (!current) {
        if (word.length <= w) {
          current = word;
        } else {
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
        }
        continue;
      }

      if (current.length + 1 + word.length <= w) {
        current = `${current} ${word}`;
      } else {
        pushCurrent();
        if (word.length <= w) {
          current = word;
        } else {
          for (let i = 0; i < word.length; i += w) {
            lines.push(word.slice(i, i + w));
          }
        }
      }
    }

    pushCurrent();
  }

  return lines;
}

type AnsiState = {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  fg: string | null;
  bg: string | null;
};

function ansiStateToPrefix(s: AnsiState): string {
  const parts: string[] = [];
  if (s.bold) parts.push("1");
  if (s.dim) parts.push("2");
  if (s.italic) parts.push("3");
  if (s.underline) parts.push("4");
  if (s.inverse) parts.push("7");
  if (s.fg) parts.push(s.fg);
  if (s.bg) parts.push(s.bg);
  if (parts.length === 0) return "";
  return `\u001b[${parts.join(";")}m`;
}

function applySgrParams(state: AnsiState, params: number[]): void {
  if (params.length === 0) params = [0];

  for (let i = 0; i < params.length; i++) {
    const p = params[i] ?? 0;
    if (p === 0) {
      state.bold = false;
      state.dim = false;
      state.italic = false;
      state.underline = false;
      state.inverse = false;
      state.fg = null;
      state.bg = null;
      continue;
    }
    if (p === 1) {
      state.bold = true;
      continue;
    }
    if (p === 2) {
      state.dim = true;
      continue;
    }
    if (p === 22) {
      state.bold = false;
      state.dim = false;
      continue;
    }
    if (p === 3) {
      state.italic = true;
      continue;
    }
    if (p === 23) {
      state.italic = false;
      continue;
    }
    if (p === 4) {
      state.underline = true;
      continue;
    }
    if (p === 24) {
      state.underline = false;
      continue;
    }
    if (p === 7) {
      state.inverse = true;
      continue;
    }
    if (p === 27) {
      state.inverse = false;
      continue;
    }
    if (p === 39) {
      state.fg = null;
      continue;
    }
    if (p === 49) {
      state.bg = null;
      continue;
    }

    // Basic foreground/background
    if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) {
      state.fg = String(p);
      continue;
    }
    if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) {
      state.bg = String(p);
      continue;
    }

    // 256-color/truecolor
    if (p === 38 || p === 48) {
      const isFg = p === 38;
      const mode = params[i + 1];
      if (mode === 5) {
        const n = params[i + 2];
        if (typeof n === "number") {
          const code = `${p};5;${n}`;
          if (isFg) state.fg = code;
          else state.bg = code;
        }
        i += 2;
        continue;
      }
      if (mode === 2) {
        const r = params[i + 2];
        const g = params[i + 3];
        const b = params[i + 4];
        if (
          typeof r === "number" &&
          typeof g === "number" &&
          typeof b === "number"
        ) {
          const code = `${p};2;${r};${g};${b}`;
          if (isFg) state.fg = code;
          else state.bg = code;
        }
        i += 4;
        continue;
      }
    }
  }
}

function wrapAnsiText(input: string, width: number): string[] {
  const w = Math.max(10, width);
  const out: string[] = [];
  const state: AnsiState = {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
    fg: null,
    bg: null,
  };

  const pushLine = (line: string) => {
    out.push(line);
  };

  const chunks = input.split("\n");
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci] ?? "";
    let line = ansiStateToPrefix(state);
    let visible = 0;

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i] ?? "";
      if (ch === "\u001b" && chunk[i + 1] === "[") {
        const m = /\u001b\[([0-9;]*)m/y;
        m.lastIndex = i;
        const mm = m.exec(chunk);
        if (mm) {
          line += mm[0];
          const rawParams = (mm[1] ?? "").trim();
          const params =
            rawParams.length === 0
              ? []
              : rawParams.split(";").map((p) => Number(p));
          applySgrParams(state, params);
          i = m.lastIndex - 1;
          continue;
        }
      }

      if (visible >= w) {
        // Close style so Ink doesn't bleed formatting across Text nodes
        pushLine(line + "\u001b[0m");
        line = ansiStateToPrefix(state);
        visible = 0;
      }
      line += ch;
      visible += 1;
    }

    pushLine(line + "\u001b[0m");
    if (ci < chunks.length - 1) {
      out.push(ansiStateToPrefix(state) + "\u001b[0m");
    }
  }

  return out;
}

function getToolDisplayName(toolName: string, args?: any): string {
  if (!args) return toolName;

  // Extract meaningful info from tool args
  if (
    toolName === "read_file" ||
    toolName === "write_file" ||
    toolName === "edit_file"
  ) {
    const path = args.path || args.file_path || "";
    const fileName = path.split("/").pop() || path;
    return `${toolName.replace("_", " ")} → ${fileName}`;
  }
  if (toolName === "read_files") {
    const paths = args.paths || [];
    return `read ${paths.length} files`;
  }
  if (toolName === "file_tree") {
    return `file_tree → ${args.path || "."}`;
  }
  if (toolName === "execute_command") {
    return `exec → ${truncate(args.command || "", 30)}`;
  }
  if (toolName === "grep" || toolName === "search_files") {
    return `search → "${truncate(args.pattern || args.query || "", 20)}"`;
  }
  return toolName;
}

// ============================================================================
// Modal Component
// ============================================================================

interface ModalProps {
  title: string;
  children: React.ReactNode;
  footer?: string;
  width?: number;
  borderColor?: string;
}

const Modal: React.FC<ModalProps> = ({
  title,
  children,
  footer,
  width = 60,
  borderColor = "cyan",
}) => (
  <Box
    flexDirection="column"
    borderStyle="double"
    borderColor={borderColor}
    paddingX={2}
    paddingY={1}
    width={width}
  >
    <Box marginBottom={1}>
      <Text bold color={borderColor}>
        {figures.pointer} {title}
      </Text>
    </Box>
    {children}
    {footer && (
      <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
        <Text color="gray" dimColor>
          {footer}
        </Text>
      </Box>
    )}
  </Box>
);

// ============================================================================
// Main UI Component
// ============================================================================

const ErzencodeUI: React.FC<UIProps> = ({
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

  // IMPORTANT: Always use process.cwd() for working directory
  const workingDirectory = process.cwd();

  // ==========================================================================
  // State Management
  // ==========================================================================

  const [stage, setStage] = useState<Stage>(showSetup ? "welcome" : "chat");
  const [activeModal, setActiveModal] = useState<ModalType>("none");

  const [themeId, setThemeId] = useState<string>(
    () => initTheme(saveableConfig.theme).id,
  );
  const theme = useMemo(() => getCurrentTheme(), [themeId]);
  const themeColors = theme.colors;

  // Model & Provider State
  const [provider, setProvider] = useState<ProviderType>(
    baseConfig.provider as ProviderType,
  );
  const [model, setModel] = useState<string>(baseConfig.model ?? "gpt-4o");
  const [mode, setMode] = useState<AgentMode>(
    (baseConfig.mode as AgentMode) ?? "agent",
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

  // Modal Selection State
  const [modalSelectionIndex, setModalSelectionIndex] = useState(0);

  // Session State - ALWAYS use process.cwd() for working directory
  const [sessions, setSessions] = useState<SessionState[]>(() => [
    {
      id: generateId(),
      name: "Session 1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDirectory: workingDirectory,
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
  const [status, setStatus] = useState("Ready");
  const [isThinking, setIsThinking] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeFiles, setActiveFiles] = useState<Map<string, FileInfo>>(
    new Map(),
  );
  const [sessionTokens, setSessionTokens] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [sidebarScrollTop, setSidebarScrollTop] = useState(0);
  const [scrollFocus, setScrollFocus] = useState<"main" | "sidebar">("main");
  const [runningTools, setRunningTools] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionStartTimeRef = useRef(Date.now());
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0);
  const inputSnapshotRef = useRef<string>("");
  const suppressNextInputChangeRef = useRef(false);

  // Command Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteMatches, setAutocompleteMatches] = useState<
    SlashCommand[]
  >([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Cancel State
  const [cancelCountdown, setCancelCountdown] = useState<number | null>(null);
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Command History
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [bashApprovalPrompt, setBashApprovalPrompt] = useState<{
    approvalId: string;
    command: string;
    workdir: string;
  } | null>(null);
  const [bashApprovalIndex, setBashApprovalIndex] = useState(0);

  // Refs
  const agentRef = useRef<ReturnType<typeof createAIAgent> | null>(null);
  const agentConfigRef = useRef<{
    provider: string;
    model: string;
    mode: AgentMode;
    thinking: ThinkingLevel;
  } | null>(null);
  const conversationMapRef = useRef<Map<string, any>>(new Map());
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const webUIRef = useRef<WebUIHandle | null>(null);
  const hasSavedConfigRef = useRef(false);
  const activityLineCountRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const prevActivityLineCountRef = useRef(0);
  const sidebarLineCountRef = useRef(0);
  const sidebarViewportHeightRef = useRef(0);

  useEffect(() => {
    const t = setInterval(
      () => setSessionElapsedTime(Date.now() - sessionStartTimeRef.current),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const handleInputChange = useCallback((next: string) => {
    if (suppressNextInputChangeRef.current) {
      suppressNextInputChangeRef.current = false;
      setInput(inputSnapshotRef.current);
      return;
    }
    setInput(next);
  }, []);

  const markInputUnchangedForShortcut = useCallback(() => {
    inputSnapshotRef.current = input;
    suppressNextInputChangeRef.current = true;
  }, [input]);

  useEffect(() => {
    if (!stdout) return;

    if (isRawModeSupported) {
      try {
        setRawMode(true);
      } catch {
        // ignore
      }
    }

    // Enable mouse reporting (xterm). This is required for touchpad/mouse wheel events.
    // 1000 = basic mouse reporting, 1006 = SGR extended mode
    stdout.write("\u001B[?1000h\u001B[?1006h");

    const onData = (data: Buffer) => {
      const str = data.toString("utf8");
      // SGR mouse: ESC [ < b ; x ; y M/m
      const re = /\u001B\[<(?<btn>\d+);(?<x>\d+);(?<y>\d+)(?<type>[mM])/g;
      for (const match of str.matchAll(re)) {
        const btn = Number(match.groups?.btn);
        if (Number.isNaN(btn)) continue;

        // Wheel up/down are 64/65 in SGR mode.
        if (btn !== 64 && btn !== 65) continue;

        const step = 3;
        const isWheelUp = btn === 64;

        if (scrollFocus === "sidebar") {
          const viewportHeight = Math.max(
            3,
            sidebarViewportHeightRef.current || 3,
          );
          const totalLines = sidebarLineCountRef.current;
          const maxScroll = Math.max(0, totalLines - viewportHeight);
          setSidebarScrollTop((prev) =>
            clamp(prev + (isWheelUp ? -step : step), 0, maxScroll),
          );
          continue;
        }

        const viewportHeight = Math.max(3, viewportHeightRef.current || 3);
        const totalLines = activityLineCountRef.current;
        const maxScroll = Math.max(0, totalLines - viewportHeight);
        // scrollOffset is distance from bottom
        setScrollOffset((prev) =>
          clamp(prev + (isWheelUp ? step : -step), 0, maxScroll),
        );
      }
    };

    stdin.on("data", onData);

    return () => {
      stdin.off("data", onData);
      stdout.write("\u001B[?1000l\u001B[?1006l");
      if (isRawModeSupported) {
        try {
          setRawMode(false);
        } catch {
          // ignore
        }
      }
    };
  }, [stdin, stdout, isRawModeSupported, scrollFocus, setRawMode]);

  // ============================================================================
  // Keyboard Input Handler
  // ============================================================================

  useInput((inputKey, key) => {
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

    if (key.ctrl && inputKey === "w") {
      markInputUnchangedForShortcut();
      setScrollFocus((prev) => (prev === "main" ? "sidebar" : "main"));
      return;
    }

    // Ctrl+C to exit
    if (key.ctrl && inputKey === "c") {
      exit();
      onExit();
      return;
    }

    // Handle modal navigation
    if (activeModal !== "none") {
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

    // Tab to switch modes
    if (key.tab && !isThinking && stage === "chat") {
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

    // Arrow keys for autocomplete
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
      // Enter on autocomplete selects the command
      if (key.return && autocompleteMatches[autocompleteIndex]) {
        const selectedCmd = autocompleteMatches[autocompleteIndex];
        handleCommand(`/${selectedCmd.name}`);
        setInput("");
        setShowAutocomplete(false);
        return;
      }
    }

    // Arrow keys for history (when not in autocomplete)
    if (!showAutocomplete) {
      if (key.upArrow && commandHistory.length > 0) {
        if (historyIndex === -1) {
          setHistoryIndex(commandHistory.length - 1);
          setInput(commandHistory[commandHistory.length - 1] ?? "");
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInput(commandHistory[historyIndex - 1] ?? "");
        }
        return;
      }
      if (key.downArrow && historyIndex !== -1) {
        if (historyIndex < commandHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInput(commandHistory[historyIndex + 1] ?? "");
        } else {
          setHistoryIndex(-1);
          setInput("");
        }
        return;
      }
    }

    // Page Up/Down for scrolling
    if (key.pageUp) {
      markInputUnchangedForShortcut();
      if (scrollFocus === "sidebar") {
        const viewportHeight = Math.max(
          3,
          sidebarViewportHeightRef.current || 3,
        );
        const totalLines = sidebarLineCountRef.current;
        setSidebarScrollTop((prev) =>
          clamp(prev - 5, 0, Math.max(0, totalLines - viewportHeight)),
        );
        return;
      }

      const viewportHeight = Math.max(3, viewportHeightRef.current || 3);
      const totalLines = activityLineCountRef.current;
      setScrollOffset((prev) =>
        clamp(prev + 5, 0, Math.max(0, totalLines - viewportHeight)),
      );
      return;
    }
    if (key.pageDown) {
      markInputUnchangedForShortcut();
      if (scrollFocus === "sidebar") {
        const viewportHeight = Math.max(
          3,
          sidebarViewportHeightRef.current || 3,
        );
        const totalLines = sidebarLineCountRef.current;
        setSidebarScrollTop((prev) =>
          clamp(prev + 5, 0, Math.max(0, totalLines - viewportHeight)),
        );
        return;
      }

      setScrollOffset((prev) => Math.max(prev - 5, 0));
      return;
    }

    if (key.ctrl && (inputKey === "u" || inputKey === "d")) {
      markInputUnchangedForShortcut();
      const isUp = inputKey === "u";
      if (scrollFocus === "sidebar") {
        const viewportHeight = Math.max(
          3,
          sidebarViewportHeightRef.current || 3,
        );
        const totalLines = sidebarLineCountRef.current;
        const page = Math.max(3, Math.floor(viewportHeight / 2));
        setSidebarScrollTop((prev) =>
          clamp(
            prev + (isUp ? -page : page),
            0,
            Math.max(0, totalLines - viewportHeight),
          ),
        );
        return;
      }

      const viewportHeight = Math.max(3, viewportHeightRef.current || 3);
      const totalLines = activityLineCountRef.current;
      const page = Math.max(3, Math.floor(viewportHeight / 2));
      setScrollOffset((prev) =>
        clamp(
          prev + (isUp ? page : -page),
          0,
          Math.max(0, totalLines - viewportHeight),
        ),
      );
      return;
    }

    if (key.ctrl && (key.upArrow || key.downArrow)) {
      markInputUnchangedForShortcut();
      const isUp = Boolean(key.upArrow);
      if (scrollFocus === "sidebar") {
        const viewportHeight = Math.max(
          3,
          sidebarViewportHeightRef.current || 3,
        );
        const totalLines = sidebarLineCountRef.current;
        setSidebarScrollTop((prev) =>
          clamp(
            prev + (isUp ? -1 : 1),
            0,
            Math.max(0, totalLines - viewportHeight),
          ),
        );
        return;
      }

      const viewportHeight = Math.max(3, viewportHeightRef.current || 3);
      const totalLines = activityLineCountRef.current;
      setScrollOffset((prev) =>
        clamp(
          prev + (isUp ? 1 : -1),
          0,
          Math.max(0, totalLines - viewportHeight),
        ),
      );
      return;
    }
  });

  // ============================================================================
  // Modal Helpers
  // ============================================================================

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
      default:
        return 0;
    }
  }, [activeModal, dynamicModels, provider, sessions.length]);

  // ============================================================================
  // Save Config Helper
  // ============================================================================

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
          saveCurrentConfig();
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
          setProvider(selectedProvider.id as ProviderType);
          setModel(
            DEFAULT_MODELS[selectedProvider.id as ProviderType] ?? "gpt-4o",
          );
          agentConfigRef.current = null;
          setStatus(`Provider: ${selectedProvider.name}`);
        }
        setActiveModal("none");
        break;
      }
    }
    setModalSelectionIndex(0);
  }, [
    activeModal,
    dynamicModels,
    provider,
    modalSelectionIndex,
    sessions,
    saveCurrentConfig,
  ]);

  // ============================================================================
  // Autocomplete Effect
  // ============================================================================

  useEffect(() => {
    if (activeModal !== "none") return;

    if (input === "/") {
      setAutocompleteMatches(SLASH_COMMANDS);
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
    } else if (input.startsWith("/") && input.length > 1) {
      const query = input.slice(1).toLowerCase();
      const matches = SLASH_COMMANDS.filter(
        (cmd) =>
          cmd.name.toLowerCase().startsWith(query) ||
          cmd.aliases?.some((a) => a.toLowerCase().startsWith(query)),
      );
      setAutocompleteMatches(matches);
      setShowAutocomplete(matches.length > 0);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
      setAutocompleteMatches([]);
    }
  }, [input, activeModal]);

  // ============================================================================
  // Dynamic Model Loading
  // ============================================================================
  // Preload Dynamic Models
  // ============================================================================

  useEffect(() => {
    preloadDynamicModels().catch(() => {
      // Silently fail - static models will be used as fallback
    });
  }, []);

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

  // ============================================================================
  // Agent Initialization
  // ============================================================================

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
    agentRef.current = createAIAgent({
      ...baseConfig,
      workspaceRoot: workingDirectory, // Use current directory!
      provider,
      model,
      mode,
      thinking: resolveThinkingConfig(thinking, supportsThinking),
    });
    agentConfigRef.current = { provider, model, mode, thinking };
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

  // ============================================================================
  // Todo Callback
  // ============================================================================

  useEffect(() => {
    setTodoUpdateCallback((newTodos) => setTodos(newTodos));
    setTodos(getTodos());
    return () => setTodoUpdateCallback(null);
  }, []);

  // ============================================================================
  // Command Handler
  // ============================================================================

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
        case "new": {
          const name = args.join(" ") || `Session ${sessionCounterRef.current}`;
          sessionCounterRef.current++;
          const newSession: SessionState = {
            id: generateId(),
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            workingDirectory: workingDirectory,
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
                  setStatus(
                    `bash allow-once failed: ${res.reason ?? "unknown error"}`,
                  );
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

  // ============================================================================
  // Message Submission with Structured Parts
  // ============================================================================

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isThinking) return;

    const userInput = input.trim();
    setInput("");
    setHistoryIndex(-1);
    setShowAutocomplete(false);

    // Save to history
    setCommandHistory((prev) => [...prev, userInput].slice(-100));
    appendToCommandHistory(userInput).catch(() => {});

    // Handle slash commands
    if (userInput.startsWith("/")) {
      handleCommand(userInput);
      return;
    }

    // Add user message
    const userMsgId = generateId();
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
                  content: userInput,
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

    // Start processing
    setIsThinking(true);
    setStatus("Thinking...");
    setElapsedTime(0);
    setRunningTools([]);
    abortControllerRef.current = new AbortController();

    const startTime = Date.now();
    elapsedTimerRef.current = setInterval(
      () => setElapsedTime(Date.now() - startTime),
      100,
    );

    // Add assistant message with parts tracking
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

      for await (const event of agent.stream(sessionMessages)) {
        if (abortControllerRef.current?.signal.aborted) break;

        if (event.type === "reasoning") {
          // Thinking/reasoning from AI
          const thinkingText = (event.data as any).text ?? "";
          if (thinkingText) {
            // Append to existing thinking part or create new one
            const lastPart = messageParts[messageParts.length - 1];
            if (lastPart?.type === "thinking") {
              lastPart.content += thinkingText;
            } else {
              messageParts.push({ type: "thinking", content: thinkingText });
            }
            updateMessage();
          }
        } else if (event.type === "text-delta") {
          // Streaming text from AI
          const chunk = (event.data as any).text ?? "";
          currentTextContent += chunk;

          // Update or add text part
          const lastPart = messageParts[messageParts.length - 1];
          if (lastPart?.type === "text") {
            lastPart.content = currentTextContent;
          } else if (chunk) {
            messageParts.push({ type: "text", content: currentTextContent });
          }
          updateMessage();
        } else if (event.type === "step-start") {
          // New iteration starting
          const iteration = (event.data as any).iteration ?? 1;
          if (iteration > 1) {
            setStatus(`Step ${iteration}...`);
          }
        } else if (event.type === "error") {
          // Error from AI
          const errorText = (event.data as any).error ?? "Unknown error";
          messageParts.push({
            type: "text",
            content: `**Error:** ${errorText}`,
          });
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

          messageParts.push({
            type: "tool",
            id: toolCallId,
            name: getToolDisplayName(toolName, toolArgs),
            input: toolArgs
              ? JSON.stringify(toolArgs).slice(0, 100)
              : undefined,
            status: "running",
          });
          updateMessage();

          // Track file operations
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
              new Map(prev).set(filePath, {
                path: filePath,
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
              return typeof resultOutputRaw === "string"
                ? resultOutputRaw
                : (() => {
                    try {
                      return JSON.stringify(resultOutputRaw);
                    } catch {
                      return String(resultOutputRaw);
                    }
                  })();
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

          if (isPreliminary) {
            for (let i = messageParts.length - 1; i >= 0; i--) {
              const p = messageParts[i];
              if (p && p.type === "tool") {
                if (
                  (resultToolCallId && p.id === resultToolCallId) ||
                  p.status === "running"
                ) {
                  if (outputText) (p as ToolPart).output = outputText;
                  break;
                }
              }
            }
            updateMessage();
            continue;
          }

          setRunningTools((prev) => {
            if (prev.length === 0) return prev;
            if (resultToolCallId) {
              const next = prev.filter((t) => t.id !== resultToolCallId);
              if (next.length !== prev.length) return next;
              const idx = prev.findIndex((t) => t.name === resultToolName);
              if (idx === -1) return prev.slice(1);
              return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
            }
            const idx = prev.findIndex((t) => t.name === resultToolName);
            if (idx === -1) return prev.slice(1);
            return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
          });

          // Mark tool as done
          let toolIdx = -1;
          if (resultToolCallId) {
            for (let i = messageParts.length - 1; i >= 0; i--) {
              const p = messageParts[i];
              if (p && p.type === "tool" && p.id === resultToolCallId) {
                toolIdx = i;
                break;
              }
            }
          }
          if (toolIdx === -1) {
            for (let i = messageParts.length - 1; i >= 0; i--) {
              const p = messageParts[i];
              if (p && p.type === "tool" && p.status === "running") {
                toolIdx = i;
                break;
              }
            }
          }
          if (toolIdx !== -1) {
            const part = messageParts[toolIdx] as ToolPart;
            part.status = "done";
            if (!part.output && outputText) part.output = outputText;
          }
          updateMessage();

          // Reset text content for new text after tool
          currentTextContent = "";
        } else if (event.type === "finish") {
          const run = event.data as any;
          if (run?.usage?.totalTokens)
            setSessionTokens((prev) => prev + run.usage.totalTokens);
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        messageParts.push({
          type: "text",
          content: `Error: ${error.message ?? String(error)}`,
        });
        updateMessage();
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
      setStatus(`Worked for ${formatTime(Date.now() - startTime)}`);
    }
    setCancelCountdown(null);
  }, [input, isThinking, currentSessionId, handleCommand]);

  // ============================================================================
  // Render Welcome Screen
  // ============================================================================

  const themes = useMemo(() => getAllThemes(), []);

  // ============================================================================
  // Calculate Dimensions
  // ============================================================================

  const headerHeight = 3;
  const statusRowHeight = 1;
  const inputBoxHeight = 3;
  const modeRowHeight = 1;
  const autocompleteHeight = showAutocomplete
    ? Math.min(6, autocompleteMatches.length) + 3
    : 0;
  const footerHeight =
    statusRowHeight + autocompleteHeight + inputBoxHeight + modeRowHeight;
  const contentHeight = Math.max(
    3,
    terminalHeight - headerHeight - footerHeight,
  );

  const sidebarWidth =
    terminalWidth >= 90 ? 28 : Math.max(20, Math.floor(terminalWidth * 0.3));
  const mainWidth = Math.max(20, terminalWidth - sidebarWidth - 2);
  const feedWidth = Math.max(20, mainWidth - 2);

  const statusMaxWidth = Math.max(10, terminalWidth - 28);
  const statusShort = truncate(stripAnsi(status), statusMaxWidth);

  // ============================================================================
  // Render Message with Parts
  // ============================================================================

  const renderAssistantMessage = (msg: ChatMessage) => {
    const parts = msg.parts ?? [];

    if (parts.length === 0) {
      // Fallback to content
      return <Text wrap="wrap">{renderMarkdown(msg.content || "...")}</Text>;
    }

    return (
      <Box flexDirection="column">
        {parts.map((part, idx) => {
          if (part.type === "thinking") {
            // Enhanced thinking display with collapsible preview
            const lines = part.content.split("\n");
            const preview =
              lines.length > 3
                ? lines.slice(0, 2).join("\n") +
                  `\n... (+${lines.length - 2} more)`
                : part.content;
            return (
              <Box key={idx} flexDirection="column" marginY={0}>
                <Box paddingLeft={1} gap={1}>
                  <Text color="magenta" bold>
                    {figures.info}
                  </Text>
                  <Text color="magenta" dimColor bold>
                    Thinking
                  </Text>
                </Box>
                <Box
                  paddingLeft={3}
                  borderStyle="round"
                  borderColor="magenta"
                  marginLeft={1}
                  marginRight={2}
                >
                  <Text color="gray" dimColor wrap="wrap">
                    {truncate(preview, mainWidth - 12)}
                  </Text>
                </Box>
              </Box>
            );
          }
          if (part.type === "tool") {
            // Enhanced tool display with input/output preview
            const renderPatch = (() => {
              if (!part.output) return null;
              if (
                !part.name.includes("write") &&
                !part.name.includes("edit")
              ) {
                return null;
              }
              try {
                const parsed = JSON.parse(part.output);
                const patch = typeof parsed?.patch === "string" ? parsed.patch : "";
                if (!patch) return null;
                const md = `\n\n\`\`\`diff\n${patch}\n\`\`\`\n`;
                const rendered = renderMarkdownWithWidth(
                  md,
                  Math.max(40, mainWidth - 6),
                );
                const wrapped = wrapAnsiText(rendered, Math.max(10, mainWidth - 8));
                return (
                  <Box
                    flexDirection="column"
                    paddingLeft={4}
                    borderStyle="round"
                    borderColor={themeColors.border}
                    marginLeft={1}
                    marginRight={2}
                  >
                    {wrapped.slice(0, 120).map((l, j) => (
                      <Text key={j}>{l}</Text>
                    ))}
                  </Box>
                );
              } catch {
                return null;
              }
            })();
            return (
              <Box key={idx} flexDirection="column" marginY={0}>
                <Box paddingLeft={1} gap={1}>
                  <Text
                    color={part.status === "running" ? "yellow" : "green"}
                    bold
                  >
                    {part.status === "running" ? figures.pointer : figures.tick}
                  </Text>
                  <Text color="cyan" bold>
                    {part.name}
                  </Text>
                  {part.status === "running" && (
                    <Text color="yellow" dimColor>
                      (running...)
                    </Text>
                  )}
                </Box>
                {part.input && (
                  <Box paddingLeft={4}>
                    <Text color="gray" dimColor>
                      {figures.arrowRight}{" "}
                      {truncate(part.input, mainWidth - 15)}
                    </Text>
                  </Box>
                )}
                {part.output && part.status === "done" && (
                  <Box paddingLeft={4}>
                    <Text color="gray" dimColor>
                      {figures.arrowLeft}{" "}
                      {truncate(part.output, mainWidth - 15)}
                    </Text>
                  </Box>
                )}
                {renderPatch}
              </Box>
            );
          }
          if (part.type === "text" && part.content.trim()) {
            return (
              <Box key={idx} paddingLeft={1} flexDirection="column">
                <Text wrap="wrap">{renderMarkdown(part.content)}</Text>
              </Box>
            );
          }
          return null;
        })}
        {msg.isStreaming && (
          <Box paddingLeft={1}>
            <Spinner type="dots" />
          </Box>
        )}
      </Box>
    );
  };

  // ============================================================================
  // Visible Messages
  // ============================================================================

  const activityLines = useMemo(() => {
    const lines: Array<{ key: string; node: React.ReactNode }> = [];

    for (const msg of currentSession.messages) {
      if (msg.role === "user") {
        const wrapped = wrapText(msg.content ?? "", feedWidth - 4);
        wrapped.forEach((l, idx) => {
          if (idx === 0) {
            lines.push({
              key: `${msg.id}:user:${idx}`,
              node: (
                <Text>
                  <Text color={themeColors.user} bold>
                    {figures.circleFilled}{" "}
                  </Text>
                  <Text color={themeColors.text}>{l}</Text>
                </Text>
              ),
            });
          } else {
            lines.push({
              key: `${msg.id}:user:${idx}`,
              node: <Text color={themeColors.text}>{`  ${l}`}</Text>,
            });
          }
        });
        lines.push({ key: `${msg.id}:spacer`, node: <Text> </Text> });
        continue;
      }

      lines.push({
        key: `${msg.id}:assistant:header`,
        node: (
          <Text color={themeColors.assistant} bold>
            {figures.star}{" "}
          </Text>
        ),
      });

      const parts = msg.parts ?? [];
      if (parts.length === 0) {
        const md = renderMarkdown(msg.content ?? "");
        const wrapped = wrapAnsiText(md, feedWidth - 2);
        wrapped.forEach((l, idx) => {
          lines.push({
            key: `${msg.id}:assistant:fallback:${idx}`,
            node: <Text>{` ${l}`}</Text>,
          });
        });
        if (msg.isStreaming) {
          lines.push({
            key: `${msg.id}:assistant:streaming`,
            node: (
              <Text
                color={themeColors.assistant}
              >{` ${figures.ellipsis}`}</Text>
            ),
          });
        }
        lines.push({ key: `${msg.id}:assistant:spacer`, node: <Text> </Text> });
        continue;
      }

      parts.forEach((part, idx) => {
        if (part.type === "action") {
          const wrapped = wrapText(part.content, feedWidth - 6);
          wrapped.forEach((l, widx) => {
            lines.push({
              key: `${msg.id}:action:${idx}:${widx}`,
              node: (
                <Text
                  color={themeColors.warning}
                >{`  ${figures.bullet} ${l}`}</Text>
              ),
            });
          });
          return;
        }
        if (part.type === "thinking") {
          const wrapped = wrapText(part.content, feedWidth - 6);
          wrapped.forEach((l, widx) => {
            lines.push({
              key: `${msg.id}:thinking:${idx}:${widx}`,
              node: (
                <Text color={themeColors.textDim} dimColor>{`  ${l}`}</Text>
              ),
            });
          });
          return;
        }

        if (part.type === "tool") {
          const icon =
            part.status === "running" ? figures.pointer : figures.tick;
          lines.push({
            key: `${msg.id}:tool:${idx}`,
            node: (
              <Text>
                <Text
                  color={
                    part.status === "running"
                      ? themeColors.tool
                      : themeColors.success
                  }
                >{`  ${icon} `}</Text>
                <Text color={themeColors.tool} bold>
                  {part.name}
                </Text>
              </Text>
            ),
          });

          if (part.input) {
            wrapText(`args: ${part.input}`, feedWidth - 8)
              .slice(0, 2)
              .forEach((l, aidx) => {
                lines.push({
                  key: `${msg.id}:tool:${idx}:args:${aidx}`,
                  node: (
                    <Text
                      color={themeColors.textMuted}
                      dimColor
                    >{`      ${l}`}</Text>
                  ),
                });
              });
          }

          if (part.output) {
            wrapText(part.output, feedWidth - 8)
              .slice(0, 2)
              .forEach((l, oidx) => {
                lines.push({
                  key: `${msg.id}:tool:${idx}:out:${oidx}`,
                  node: (
                    <Text
                      color={themeColors.textMuted}
                      dimColor
                    >{`      ${l}`}</Text>
                  ),
                });
              });
          }
          return;
        }

        if (part.type === "text") {
          const md = renderMarkdown(part.content);
          const wrapped = wrapAnsiText(md, feedWidth - 2);
          wrapped.forEach((l, widx) => {
            lines.push({
              key: `${msg.id}:text:${idx}:${widx}`,
              node: <Text>{` ${l}`}</Text>,
            });
          });
        }
      });

      if (msg.isStreaming) {
        lines.push({
          key: `${msg.id}:assistant:streaming`,
          node: (
            <Text color={themeColors.assistant}>{` ${figures.ellipsis}`}</Text>
          ),
        });
      }

      lines.push({ key: `${msg.id}:assistant:spacer`, node: <Text> </Text> });
    }

    return lines;
  }, [currentSession.messages, feedWidth, themeColors]);

  useEffect(() => {
    activityLineCountRef.current = activityLines.length;
  }, [activityLines.length]);

  const visibleActivityLines = useMemo(() => {
    const maxScroll = Math.max(0, activityLines.length - contentHeight);
    const effectiveOffset = clamp(scrollOffset, 0, maxScroll);
    const end = activityLines.length - effectiveOffset;
    const start = Math.max(0, end - contentHeight);
    return activityLines.slice(start, end);
  }, [activityLines, contentHeight, scrollOffset]);

  const sidebarLines = useMemo(() => {
    const lines: Array<{ key: string; node: React.ReactNode }> = [];

    lines.push({
      key: "ctx:title",
      node: (
        <Text bold color={themeColors.primary}>
          {figures.info} Context{scrollFocus === "sidebar" ? " (focus)" : ""}
        </Text>
      ),
    });
    lines.push({
      key: "ctx:provider",
      node: (
        <Text color={themeColors.textMuted}>
          Provider: <Text color={themeColors.warning}>{provider}</Text>
        </Text>
      ),
    });
    lines.push({
      key: "ctx:model",
      node: (
        <Text color={themeColors.textMuted}>
          Model: <Text color={themeColors.success}>{truncate(model, 14)}</Text>
        </Text>
      ),
    });
    lines.push({
      key: "ctx:mode",
      node: (
        <Text color={themeColors.textMuted}>
          Mode: <Text color={MODE_COLORS[mode]}>{mode}</Text>
        </Text>
      ),
    });
    lines.push({
      key: "ctx:theme",
      node: (
        <Text color={themeColors.textMuted}>
          Theme:{" "}
          <Text color={themeColors.primary}>{truncate(themeId, 14)}</Text>
        </Text>
      ),
    });
    if (isThinking) {
      lines.push({
        key: "ctx:status",
        node: (
          <Text color={themeColors.textMuted}>
            Status: <Text color={themeColors.info}>{truncate(status, 18)}</Text>
          </Text>
        ),
      });
    }
    if (sessionTokens > 0) {
      lines.push({
        key: "ctx:tokens",
        node: (
          <Text color={themeColors.textMuted}>
            Tokens:{" "}
            <Text color={themeColors.info}>{formatTokens(sessionTokens)}</Text>
          </Text>
        ),
      });
    }
    lines.push({ key: "ctx:spacer", node: <Text> </Text> });

    if (activeFiles.size > 0) {
      lines.push({
        key: "files:title",
        node: (
          <Text bold color="green">
            {figures.tick} Files ({activeFiles.size})
          </Text>
        ),
      });
      Array.from(activeFiles.values()).forEach((f, idx) => {
        const name = truncate(f.path.split("/").pop() ?? "", 18);
        lines.push({
          key: `files:${idx}:${f.path}`,
          node: (
            <Text color="gray" dimColor>
              {name}
            </Text>
          ),
        });
      });
      lines.push({ key: "files:spacer", node: <Text> </Text> });
    }

    if (runningTools.length > 0) {
      lines.push({
        key: "tools:title",
        node: (
          <Text bold color="yellow">
            <Spinner type="dots" /> Running
          </Text>
        ),
      });
      runningTools.forEach((t, idx) => {
        lines.push({
          key: `tools:${idx}:${t.id}`,
          node: <Text color="yellow">{truncate(t.name, 18)}</Text>,
        });
      });
      lines.push({ key: "tools:spacer", node: <Text> </Text> });
    }

    if (todos.length > 0) {
      lines.push({
        key: "todos:title",
        node: (
          <Text bold color="yellow">
            {figures.bullet} Tasks
          </Text>
        ),
      });
      const inProgress = todos.filter((t) => t.status === "in_progress");
      const pending = todos.filter((t) => t.status === "pending");
      const completed = todos.filter((t) => t.status === "completed");
      const ordered = [...inProgress, ...pending, ...completed];
      ordered.forEach((t, idx) => {
        const icon =
          t.status === "completed"
            ? figures.tick
            : t.status === "in_progress"
              ? figures.pointer
              : figures.circle;
        const color =
          t.status === "completed"
            ? "green"
            : t.status === "in_progress"
              ? "yellow"
              : "gray";
        const wrapped = wrapText(t.content, Math.max(10, sidebarWidth - 4));
        wrapped.forEach((line, widx) => {
          lines.push({
            key: `todos:${idx}:${t.id}:${widx}`,
            node: (
              <Text color={color}>
                {widx === 0 ? `${icon} ${line}` : `  ${line}`}
              </Text>
            ),
          });
        });
      });
      lines.push({ key: "todos:spacer", node: <Text> </Text> });
    }

    lines.push({
      key: "help:sep",
      node: (
        <Text color={themeColors.textMuted} dimColor>
          ─────────────
        </Text>
      ),
    });
    lines.push({
      key: "help:help",
      node: (
        <Text color={themeColors.textMuted} dimColor>
          /help commands
        </Text>
      ),
    });
    lines.push({
      key: "help:theme",
      node: (
        <Text color={themeColors.textMuted} dimColor>
          /theme
        </Text>
      ),
    });
    lines.push({
      key: "help:scroll",
      node: (
        <Text color={themeColors.textMuted} dimColor>
          Ctrl+U/D scroll
        </Text>
      ),
    });
    lines.push({
      key: "help:focus",
      node: (
        <Text color={themeColors.textMuted} dimColor>
          Ctrl+W focus
        </Text>
      ),
    });

    return lines;
  }, [
    activeFiles,
    isThinking,
    mode,
    model,
    provider,
    runningTools,
    scrollFocus,
    sessionTokens,
    sidebarWidth,
    status,
    themeColors,
    themeId,
    todos,
  ]);

  useEffect(() => {
    sidebarLineCountRef.current = sidebarLines.length;
  }, [sidebarLines.length]);

  const visibleSidebarLines = useMemo(() => {
    const maxScroll = Math.max(0, sidebarLines.length - contentHeight);
    const top = clamp(sidebarScrollTop, 0, maxScroll);
    return sidebarLines.slice(top, top + contentHeight);
  }, [sidebarLines, contentHeight, sidebarScrollTop]);

  useEffect(() => {
    const maxScroll = Math.max(0, sidebarLines.length - contentHeight);
    setSidebarScrollTop((cur) => clamp(cur, 0, maxScroll));
  }, [sidebarLines.length, contentHeight]);

  useEffect(() => {
    const nextCount = activityLines.length;
    const prevCount = prevActivityLineCountRef.current;
    prevActivityLineCountRef.current = nextCount;

    const maxScroll = Math.max(0, nextCount - contentHeight);

    setScrollOffset((cur) => {
      if (cur === 0) return 0;

      const delta = nextCount - prevCount;
      if (delta > 0) return clamp(cur + delta, 0, maxScroll);
      return clamp(cur, 0, maxScroll);
    });
  }, [activityLines.length, contentHeight]);

  useEffect(() => {
    viewportHeightRef.current = contentHeight;
  }, [contentHeight]);

  useEffect(() => {
    sidebarViewportHeightRef.current = contentHeight;
  }, [contentHeight]);

  // ============================================================================
  // Render Modals
  // ============================================================================

  const renderModal = () => {
    if (activeModal === "none") return null;

    if (activeModal === "help") {
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 65) / 2)}
          marginTop={2}
        >
          <Modal
            title="Help & Shortcuts"
            width={65}
            footer="ESC to close"
            borderColor={themeColors.primary}
          >
            <Box flexDirection="column">
              <Text bold color={themeColors.warning}>
                Commands:
              </Text>
              {SLASH_COMMANDS.map((cmd) => (
                <Box key={cmd.name} gap={1}>
                  <Text color={themeColors.primary}>/{cmd.name}</Text>
                  {cmd.aliases && (
                    <Text color="gray">({cmd.aliases.join(", ")})</Text>
                  )}
                  <Text color="gray">- {cmd.description}</Text>
                </Box>
              ))}
              <Box marginTop={1}>
                <Text bold color={themeColors.warning}>
                  Shortcuts:
                </Text>
              </Box>
              <Text>
                <Text color={themeColors.primary}>Tab</Text> - Switch mode
              </Text>
              <Text>
                <Text color="cyan">ESC ESC</Text> - Cancel AI
              </Text>
              <Text>
                <Text color="cyan">↑/↓</Text> - History / Navigate
              </Text>
              <Text>
                <Text color="cyan">Ctrl+C</Text> - Exit
              </Text>
            </Box>
          </Modal>
        </Box>
      );
    }

    if (activeModal === "theme") {
      const maxVisible = 12;
      const windowStart = clamp(
        modalSelectionIndex - Math.floor(maxVisible / 2),
        0,
        Math.max(0, themes.length - maxVisible),
      );
      const visibleThemes = themes.slice(windowStart, windowStart + maxVisible);
      return (
        <Box
          position="absolute"
          marginLeft={Math.floor((terminalWidth - 65) / 2)}
          marginTop={2}
        >
          <Modal
            title="Select Theme"
            width={65}
            footer="↑↓ Navigate • Enter Select • ESC Cancel"
            borderColor={themeColors.primary}
          >
            <Box
              flexDirection="column"
              height={Math.min(maxVisible + 1, themes.length + 1)}
            >
              {visibleThemes.map((t, idx) => {
                const actualIdx = windowStart + idx;
                return (
                  <Box key={t.id}>
                    <Text
                      color={
                        actualIdx === modalSelectionIndex
                          ? themeColors.primary
                          : t.id === themeId
                            ? themeColors.success
                            : themeColors.text
                      }
                      bold={actualIdx === modalSelectionIndex}
                    >
                      {actualIdx === modalSelectionIndex
                        ? figures.pointer
                        : " "}{" "}
                      {t.name}{" "}
                      <Text color={themeColors.textMuted} dimColor>
                        - {t.id}
                      </Text>{" "}
                      {t.id === themeId && (
                        <Text color={themeColors.success}>✓</Text>
                      )}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Modal>
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
          <Modal
            title={`Select Model (${provider})`}
            width={55}
            footer="↑↓ Navigate • Enter Select • ESC Cancel"
            borderColor={themeColors.primary}
          >
            <Box
              flexDirection="column"
              height={Math.min(12, allModels.length + 1)}
            >
              {isLoadingModels ? (
                <Box gap={1}>
                  <Spinner type="dots" />
                  <Text>Loading...</Text>
                </Box>
              ) : (
                allModels.slice(0, 12).map((m, idx) => (
                  <Box key={m}>
                    <Text
                      color={
                        idx === modalSelectionIndex
                          ? "cyan"
                          : m === model
                            ? "green"
                            : "white"
                      }
                      bold={idx === modalSelectionIndex}
                    >
                      {idx === modalSelectionIndex ? figures.pointer : " "} {m}{" "}
                      {m === model && <Text color="green">✓</Text>}
                    </Text>
                  </Box>
                ))
              )}
            </Box>
          </Modal>
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
          <Modal
            title="Sessions"
            width={50}
            footer="↑↓ Navigate • Enter Select • ESC Cancel"
          >
            <Box flexDirection="column">
              {sessions.map((s, idx) => (
                <Box key={s.id} gap={1}>
                  <Text
                    color={
                      idx === modalSelectionIndex
                        ? "cyan"
                        : s.id === currentSessionId
                          ? "green"
                          : "white"
                    }
                    bold={idx === modalSelectionIndex}
                  >
                    {idx === modalSelectionIndex ? figures.pointer : " "}{" "}
                    {s.name}{" "}
                    <Text color="gray">
                      (<Text>{s.messages.length}</Text>)
                    </Text>
                    {s.id === currentSessionId && <Text color="green">✓</Text>}
                  </Text>
                </Box>
              ))}
            </Box>
          </Modal>
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
          <Modal
            title="Select Provider"
            width={45}
            footer="↑↓ Navigate • Enter Select • ESC Cancel"
          >
            <Box flexDirection="column">
              {PROVIDERS.map((p, idx) => (
                <Box key={p.id}>
                  <Text
                    color={
                      idx === modalSelectionIndex
                        ? "cyan"
                        : p.id === provider
                          ? "green"
                          : "white"
                    }
                    bold={idx === modalSelectionIndex}
                  >
                    {idx === modalSelectionIndex ? figures.pointer : " "}{" "}
                    {p.name} {p.id === provider && <Text color="green">✓</Text>}
                  </Text>
                </Box>
              ))}
            </Box>
          </Modal>
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
          <Modal
            title="Settings"
            width={50}
            borderColor="yellow"
            footer="ESC to close"
          >
            <Box flexDirection="column" gap={1}>
              <Text>
                <Text color="gray">Provider:</Text>{" "}
                <Text color="yellow">{provider}</Text>
              </Text>
              <Text>
                <Text color="gray">Model:</Text>{" "}
                <Text color="green">{model}</Text>
              </Text>
              <Text>
                <Text color="gray">Mode:</Text>{" "}
                <Text color={MODE_COLORS[mode]}>{mode}</Text>
              </Text>
              <Text>
                <Text color="gray">Directory:</Text>{" "}
                <Text color="cyan">{truncate(workingDirectory, 30)}</Text>
              </Text>
              <Text>
                <Text color="gray">Tokens:</Text>{" "}
                <Text>{formatTokens(sessionTokens)}</Text>
              </Text>
            </Box>
          </Modal>
        </Box>
      );
    }

    return null;
  };

  const renderBashApprovalPrompt = () => {
    if (!bashApprovalPrompt) return null;
    const modalWidth = Math.min(80, terminalWidth - 4);
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
      <Box
        position="absolute"
        marginLeft={Math.floor((terminalWidth - modalWidth) / 2)}
        marginTop={2}
      >
        <Modal
          title="Bash command requires approval"
          width={modalWidth}
          footer="↑↓ select • Enter confirm • ESC cancel"
          borderColor={themeColors.warning}
        >
          <Box flexDirection="column">
            <Text color={themeColors.textMuted} dimColor>
              {bashApprovalPrompt.command}
            </Text>
            <Text color={themeColors.textMuted} dimColor>
              {bashApprovalPrompt.workdir}
            </Text>
            <Box marginTop={1} flexDirection="column">
              {options.map((opt, idx) => (
                <Text
                  key={opt}
                  color={
                    idx === bashApprovalIndex
                      ? themeColors.primary
                      : themeColors.text
                  }
                  bold={idx === bashApprovalIndex}
                >
                  {idx === bashApprovalIndex ? figures.pointer : " "} {opt}
                </Text>
              ))}
            </Box>
          </Box>
        </Modal>
      </Box>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return stage === "welcome" ? (
    <Box flexDirection="column" padding={2}>
      <Text bold color={themeColors.primary}>
        {`
  _____ ____  __________ _   ____________  ____  ______
 / __  / __ \/_  __/ __// | / / ___/ __ \/ __ \/ ____/
/ /_/ / /_/ / / / / _/ /  |/ / /__/ /_/ / / / / __/   
\\____/\\____/ /_/ /___/_/|___/\\___/\\____/_/_/_/____/   
        `.trim()}
      </Text>
      <Text color={themeColors.textMuted}>AI-Powered Coding Assistant</Text>
      <Box marginTop={1}>
        <Text color={themeColors.textMuted}>
          Working in:{" "}
          <Text color={themeColors.primary}>{workingDirectory}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          Press{" "}
          <Text color={themeColors.primary} bold>
            Enter
          </Text>{" "}
          to start
        </Text>
      </Box>
    </Box>
  ) : (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor={themeColors.border}
        paddingX={1}
        justifyContent="space-between"
      >
        <Box gap={1}>
          <Text bold color={themeColors.primary}>
            erzencode
          </Text>
          <Text color={themeColors.textMuted}>│</Text>
          <Text color={themeColors.warning}>{provider}</Text>
          <Text color={themeColors.success}>{truncate(model, 20)}</Text>
          <Text color={MODE_COLORS[mode]} bold>
            [{mode.toUpperCase()}]
          </Text>
        </Box>
        <Text color={themeColors.textMuted}>
          {currentSession.name} •{" "}
          {truncate(workingDirectory.split("/").pop() ?? "", 15)}
        </Text>
      </Box>

      {/* Main Content */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Messages */}
        <Box
          flexDirection="column"
          width={mainWidth}
          paddingX={1}
          height={contentHeight}
          overflow="hidden"
        >
          {visibleActivityLines.length === 0 ? (
            <Box flexDirection="column" paddingY={1}>
              <Text color={themeColors.textMuted}>
                Ready to assist in:{" "}
                <Text color={themeColors.primary}>{workingDirectory}</Text>
              </Text>
              <Text color={themeColors.textMuted} dimColor>
                Type a message or /help for commands
              </Text>
              <Text color={themeColors.textMuted} dimColor>
                PgUp/PgDn, Ctrl+U/D, mouse wheel
              </Text>
            </Box>
          ) : (
            visibleActivityLines.map((l) => <Box key={l.key}>{l.node}</Box>)
          )}
        </Box>

        {/* Sidebar */}
        <Box
          flexDirection="column"
          width={sidebarWidth}
          height={contentHeight}
          borderLeft
          borderColor={themeColors.border}
          paddingLeft={1}
          overflow="hidden"
        >
          {visibleSidebarLines.map((l) => (
            <Box key={l.key}>{l.node}</Box>
          ))}
        </Box>
      </Box>

      {/* Footer */}
      <Box flexDirection="column">
        <Box paddingX={1} gap={2} flexWrap="nowrap">
          {isThinking ? (
            <Box gap={1} flexWrap="nowrap">
              <Spinner type="dots" />
              <Text color={themeColors.assistant} wrap="truncate">
                {statusShort}
              </Text>
              <Text color={themeColors.textMuted}>
                {formatTime(elapsedTime)}
              </Text>
            </Box>
          ) : (
            <Text color={themeColors.textMuted} wrap="truncate">
              {figures.bullet} {statusShort}
            </Text>
          )}
          {cancelCountdown !== null && (
            <Text color="red" bold>
              ESC again to cancel
            </Text>
          )}
        </Box>

        {showAutocomplete && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            marginX={1}
          >
            {autocompleteMatches.slice(0, 6).map((cmd, idx) => (
              <Text
                key={cmd.name}
                color={idx === autocompleteIndex ? "cyan" : "white"}
                bold={idx === autocompleteIndex}
              >
                {idx === autocompleteIndex ? figures.pointer : " "} /{cmd.name}{" "}
                <Text color="gray">- {cmd.description}</Text>
              </Text>
            ))}
            <Text color="gray" dimColor>
              Enter to select
            </Text>
          </Box>
        )}

        <Box
          borderStyle="round"
          borderColor={isThinking ? themeColors.tool : MODE_COLORS[mode]}
          paddingX={1}
          marginX={1}
          flexWrap="nowrap"
        >
          <Text color={MODE_COLORS[mode]}>{figures.pointer} </Text>
          <Box flexGrow={1}>
            <TextInput
              value={input}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder={isThinking ? "Processing..." : `Ask (${mode})...`}
            />
          </Box>
          <Text color={themeColors.textMuted} dimColor>
            {isThinking
              ? formatTime(elapsedTime)
              : formatTime(sessionElapsedTime)}
          </Text>
        </Box>

        <Box paddingX={1} gap={2} flexWrap="nowrap">
          {MODES.map((m) => (
            <Text
              key={m}
              color={m === mode ? MODE_COLORS[m] : "gray"}
              bold={m === mode}
              wrap="truncate"
            >
              [{m === mode ? figures.circleFilled : figures.circle}] {m}
            </Text>
          ))}
          <Text color="gray" dimColor>
            Tab
          </Text>
        </Box>
      </Box>

      {renderModal()}
      {renderBashApprovalPrompt()}
    </Box>
  );
};

// ============================================================================
// Export
// ============================================================================

export async function runInkUI(options: {
  baseConfig: AgentConfig;
  configPath: string;
  saveableConfig: ErzencodeConfig;
  showSetup: boolean;
}): Promise<void> {
  const { unmount } = render(
    <ErzencodeUI {...options} onExit={() => unmount()} />,
  );
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });
}
