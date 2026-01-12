/**
 * Custom hook for managing AI agent streaming in the Terminal UI.
 * Handles message submission, streaming responses, and tool execution.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import fs from "node:fs";
import path from "node:path";
import type { ProviderType } from "../../ai-provider.js";
import type { AgentMode as CodingAgentMode } from "../../ai-agent.js";
import type { ThinkingLevel, ChatMessage, MessagePart, ToolPart, FileInfo } from "../types/index.js";
import { createAIAgent } from "../../ai-agent.js";
import { resolveThinkingConfig, getApiKeyAsync } from "../../config.js";
import { getModel } from "../../models.js";
import { generateId, formatTime } from "../utils/index.js";
import {
  compactConversation,
  shouldCompact,
  estimateConversationTokens,
  createCompactedMessage,
} from "../../compaction.js";

export interface AgentStreamConfig {
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  thinking: ThinkingLevel;
  supportsThinking: boolean;
  workingDirectory: string;
  baseConfig: any;
}

export interface StreamState {
  isThinking: boolean;
  status: string;
  elapsedTime: number;
  runningTools: Array<{ id: string; name: string }>;
  sessionTokens: number;
  inputTokens: number;
  outputTokens: number;
  lastTaskInputTokens: number;
  lastTaskOutputTokens: number;
  cancelCountdown: number | null;
  isCompacting: boolean;
}

export interface UseAgentStreamReturn extends StreamState {
  /** Submit a message to the agent */
  submitMessage: (
    userInput: string,
    images: string[],
    sessionMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    onUserMessage: (msg: ChatMessage) => void,
    onAssistantMessage: (msg: ChatMessage) => void,
    onUpdateMessage: (id: string, updates: Partial<ChatMessage>) => void,
    onCompact: (summary: string, originalCount: number) => void,
    displayInput?: string
  ) => Promise<void>;
  /** Cancel the current operation */
  cancel: () => void;
  /** Set status message */
  setStatus: (status: string) => void;
  /** Pause UI updates that cause terminal repaints (e.g. elapsed timer) */
  setUiPaused: (paused: boolean) => void;
  /** Active files being worked on */
  activeFiles: Map<string, FileInfo>;
  /** Bash approval prompt state */
  bashApprovalPrompt: { approvalId: string; command: string; workdir: string } | null;
  /** Set bash approval prompt */
  setBashApprovalPrompt: (prompt: { approvalId: string; command: string; workdir: string } | null) => void;
}

/**
 * Hook for managing AI agent streaming.
 */
export function useAgentStream(config: AgentStreamConfig): UseAgentStreamReturn {
  const { provider, model, mode, thinking, supportsThinking, workingDirectory, baseConfig } = config;

  // State
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [runningTools, setRunningTools] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [lastTaskInputTokens, setLastTaskInputTokens] = useState(0);
  const [lastTaskOutputTokens, setLastTaskOutputTokens] = useState(0);
  const [cancelCountdown, setCancelCountdown] = useState<number | null>(null);
  const [isCompacting, setIsCompacting] = useState(false);
  const [activeFiles, setActiveFiles] = useState<Map<string, FileInfo>>(new Map());
  const [bashApprovalPrompt, setBashApprovalPrompt] = useState<{
    approvalId: string;
    command: string;
    workdir: string;
  } | null>(null);

  // Refs
  const agentRef = useRef<ReturnType<typeof createAIAgent> | null>(null);
  const agentConfigRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uiPausedRef = useRef(false);

  const setUiPaused = useCallback((paused: boolean) => {
    uiPausedRef.current = paused;
  }, []);

  // Initialize/update agent when config changes
  useEffect(() => {
    const configKey = `${provider}:${model}:${mode}:${thinking}`;
    if (agentConfigRef.current === configKey) return;

    (async () => {
      const apiKey = await getApiKeyAsync(provider);
      agentRef.current = createAIAgent({
        ...baseConfig,
        apiKey: apiKey ?? baseConfig.apiKey,
        workspaceRoot: workingDirectory,
        provider,
        model,
        mode,
        thinking: resolveThinkingConfig(thinking, supportsThinking),
      });
      agentConfigRef.current = configKey;
    })();
  }, [provider, model, mode, thinking, supportsThinking, workingDirectory, baseConfig]);

  const cancel = useCallback(() => {
    if (cancelCountdown !== null) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsThinking(false);
      setStatus("Cancelled");
      setCancelCountdown(null);
      if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    } else {
      setCancelCountdown(2);
      cancelTimeoutRef.current = setTimeout(() => setCancelCountdown(null), 2000);
    }
  }, [cancelCountdown]);

  const buildVisionContent = useCallback((text: string, images: string[]): any => {
    if (!images.length) return text;

    const parts: any[] = [{ type: "text", text }];

    for (const img of images) {
      // data URL support (e.g. clipboard provides data:image/png;base64,...)
      if (img.startsWith("data:image/")) {
        const match = img.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
        if (!match) continue;
        const mimeType = match[1]!;
        const base64 = match[2]!;
        try {
          const buf = Buffer.from(base64, "base64");
          parts.push({ type: "image", image: new Uint8Array(buf), mimeType });
        } catch {
          // Ignore invalid data URLs
        }
        continue;
      }

      // file path support
      try {
        const ext = path.extname(img).toLowerCase();
        const mimeType =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".gif"
                ? "image/gif"
                : ext === ".webp"
                  ? "image/webp"
                  : undefined;

        if (!mimeType) continue;
        if (!fs.existsSync(img)) continue;
        const buf = fs.readFileSync(img);
        parts.push({ type: "image", image: new Uint8Array(buf), mimeType });
      } catch {
        // Ignore unreadable files
      }
    }

    return parts.length > 1 ? parts : text;
  }, []);

  const contentToTextForEstimate = useCallback((content: any): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((p: any) => {
          if (!p) return "";
          if (p.type === "text") return String(p.text ?? "");
          if (p.type === "image") return "[image]";
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    try {
      return typeof content === "undefined" ? "" : String(content);
    } catch {
      return "";
    }
  }, []);

  const submitMessage = useCallback(
    async (
      userInput: string,
      images: string[],
      sessionMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
      onUserMessage: (msg: ChatMessage) => void,
      onAssistantMessage: (msg: ChatMessage) => void,
      onUpdateMessage: (id: string, updates: Partial<ChatMessage>) => void,
      onCompact: (summary: string, originalCount: number) => void,
      displayInput?: string
    ) => {
      // Add user message
      const userMsgId = generateId();
      let displayContent = displayInput ?? userInput;
      if (images.length > 0) {
        const labels = images.map((_, i) => `[Image ${i + 1}]`).join(" ");
        displayContent = `${displayContent}\n${labels}`;
      }

      onUserMessage({
        id: userMsgId,
        role: "user",
        content: displayContent,
        timestamp: Date.now(),
      });

      // Add the new user message to session (multimodal when images are attached)
      const userContentForApi = buildVisionContent(userInput, images);
      const messagesForApi: any[] = [
        ...sessionMessages,
        { role: "user" as const, content: userContentForApi },
      ];

      // Start processing
      setIsThinking(true);
      setStatus("Thinking...");
      setElapsedTime(0);
      setRunningTools([]);
      setLastTaskInputTokens(0);
      setLastTaskOutputTokens(0);
      abortControllerRef.current = new AbortController();
      // Update context usage immediately (heuristic) while we wait for provider usage.
      // This avoids displaying stale/zero context until the request finishes.
      const estimatedPromptTokens = estimateConversationTokens(
        messagesForApi.map((m) => ({
          role: m.role,
          content: contentToTextForEstimate(m.content),
        }))
      );
      setSessionTokens(estimatedPromptTokens);

      const startTime = Date.now();
      elapsedTimerRef.current = setInterval(
        () => {
          if (uiPausedRef.current) return;
          setElapsedTime(Date.now() - startTime);
        },
        250,
      );

      // Add assistant message
      const assistantMsgId = generateId();
      const messageParts: MessagePart[] = [];
      let currentTextContent = "";

      onAssistantMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
        parts: [],
      });

      // Throttle message updates to prevent flickering
      let lastUpdateTime = 0;
      const MIN_UPDATE_INTERVAL = 300; // ms - update at most every 300ms
      let pendingUpdate = false;
      let updateTimeoutId: NodeJS.Timeout | null = null;

      const updateMessage = (force = false) => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime;

        // IMPORTANT: Don't synthesize "tool" lines into message content.
        // Tools have their own UI (ToolGroup/ToolDisplay). Injecting tool names here
        // causes a second, mismatched tools UI during streaming.
        const finalContent = messageParts
          .filter((p) => p.type === "text")
          .map((p) => (p.type === "text" ? p.content : ""))
          .filter(Boolean)
          .join("\n");

        if (force || timeSinceLastUpdate >= MIN_UPDATE_INTERVAL) {
          onUpdateMessage(assistantMsgId, { content: finalContent, parts: [...messageParts] });
          lastUpdateTime = now;
          pendingUpdate = false;
          if (updateTimeoutId) {
            clearTimeout(updateTimeoutId);
            updateTimeoutId = null;
          }
        } else if (!pendingUpdate) {
          // Schedule an update for later
          pendingUpdate = true;
          updateTimeoutId = setTimeout(() => {
            onUpdateMessage(assistantMsgId, { content: finalContent, parts: [...messageParts] });
            lastUpdateTime = Date.now();
            pendingUpdate = false;
            updateTimeoutId = null;
          }, MIN_UPDATE_INTERVAL - timeSinceLastUpdate);
        }
      };

      // Track the prompt/context tokens for this call. We can't rely on React state
      // being updated synchronously inside this function.
      let latestPromptTokens = estimatedPromptTokens;

      try {
        const agent = agentRef.current;
        if (!agent) throw new Error("Agent not initialized");

        let currentThinkingContent = "";

        for await (const event of agent.stream(messagesForApi as any)) {
          if (abortControllerRef.current?.signal.aborted) break;

          if (event.type === "reasoning") {
            const thinkingText = (event.data as any).text ?? "";
            if (thinkingText) {
              currentThinkingContent += thinkingText;
              const lastPart = messageParts[messageParts.length - 1];
              if (lastPart?.type === "thinking") {
                lastPart.content = currentThinkingContent;
              } else {
                messageParts.push({ type: "thinking", content: currentThinkingContent });
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
            if (iteration > 1) setStatus(`Step ${iteration}...`);
          } else if (event.type === "step-usage") {
            const usage = event.data as any;
            if (usage.inputTokens) {
              setInputTokens((prev) => prev + usage.inputTokens);
              setLastTaskInputTokens((prev) => prev + usage.inputTokens);
              latestPromptTokens = usage.inputTokens;
              setSessionTokens(usage.inputTokens); // prompt tokens ~= context used this call
            }
            if (usage.outputTokens) {
              setOutputTokens((prev) => prev + usage.outputTokens);
              setLastTaskOutputTokens((prev) => prev + usage.outputTokens);
            }
          } else if (event.type === "rate-limit-wait") {
            const data = event.data as any;
            setStatus(`Rate limited. Waiting ${data.waitSeconds ?? 60}s...`);
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

            setRunningTools((prev) => [...prev, { id: toolCallId, name: toolName }]);
            setStatus(`Running: ${toolName}`);

            messageParts.push({
              type: "tool",
              id: toolCallId,
              // Keep the raw tool name here so ToolDisplay/tool-utils can format it consistently.
              name: toolName,
              args: toolArgs,
              status: "running",
            });
            updateMessage();

            // Track active files
            const filePath = toolArgs?.path ?? toolArgs?.file_path;
            if (filePath && ["read_file", "write_file", "edit_file"].includes(toolName)) {
              const action = toolName === "read_file" ? "read" : toolName === "write_file" ? "write" : "edit";
              setActiveFiles((prev) =>
                new Map(prev).set(String(filePath), {
                  path: String(filePath),
                  action: action as any,
                  timestamp: Date.now(),
                })
              );
            }
          } else if (event.type === "tool-result") {
            const resultData = event.data as any;
            const toolResult = resultData.toolResult ?? resultData;
            const resultToolName = toolResult?.toolName ?? "tool";
            const resultToolCallId = toolResult?.toolCallId ?? resultData?.toolCallId;
            const isPreliminary = resultData?.preliminary ?? false;
            const resultOutputRaw = toolResult?.result;

            const outputText = (() => {
              if (resultOutputRaw === undefined) return undefined;
              if (typeof resultOutputRaw === "string") return resultOutputRaw;
              try {
                return JSON.stringify(resultOutputRaw);
              } catch {
                return String(resultOutputRaw);
              }
            })();

            // Check for bash approval
            if (resultToolName === "bash" && typeof resultOutputRaw === "string" && resultOutputRaw.includes("Bash command requires approval")) {
              const approvalId = (resultOutputRaw.match(/Approval ID:\s*(\S+)/i)?.[1] ?? "").trim();
              const cmd = (resultOutputRaw.match(/Command:\s*(.*)$/im)?.[1] ?? "").trim();
              const wd = (resultOutputRaw.match(/Workdir:\s*(.*)$/im)?.[1] ?? "").trim();
              if (approvalId) {
                setBashApprovalPrompt({ approvalId, command: cmd || "(unknown)", workdir: wd || "(unknown)" });
              }
            }

            if (isPreliminary) {
              for (let i = messageParts.length - 1; i >= 0; i--) {
                const p = messageParts[i];
                if (p?.type === "tool" && ((resultToolCallId && p.id === resultToolCallId) || p.status === "running")) {
                  const statusMsg = resultOutputRaw?.status ?? resultOutputRaw?.message;
                  if (statusMsg) (p as ToolPart).output = String(statusMsg);
                  else if (outputText) (p as ToolPart).output = outputText;
                  break;
                }
              }
              updateMessage();
              continue;
            }

            // Final result
            setRunningTools((prev) => {
              if (prev.length === 0) return prev;
              if (resultToolCallId) return prev.filter((t) => t.id !== resultToolCallId);
              const idx = prev.findIndex((t) => t.name === resultToolName);
              if (idx === -1) return prev.slice(1);
              return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
            });

            // Create a new tool object to trigger React re-render (immutable update)
            for (let i = messageParts.length - 1; i >= 0; i--) {
              const p = messageParts[i];
              if (p?.type === "tool" && ((resultToolCallId && p.id === resultToolCallId) || p.status === "running")) {
                // Replace with new object to ensure React sees the change
                messageParts[i] = {
                  ...p,
                  status: "done",
                  output: outputText !== undefined ? outputText : p.output,
                };
                break;
              }
            }
            updateMessage(true); // Force update for tool status changes
            currentTextContent = "";
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          let errorMessage = error?.message ?? String(error);
          if (error?.details) errorMessage += `\n\nDetails: ${typeof error.details === "string" ? error.details : JSON.stringify(error.details, null, 2)}`;
          messageParts.push({ type: "error", content: errorMessage });
          updateMessage();
          setStatus(`Error: ${(error.message ?? String(error)).slice(0, 80)}`);
        }
      }

      // Finalize
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      
      // Force final update and cleanup any pending throttled updates
      if (updateTimeoutId) {
        clearTimeout(updateTimeoutId);
        updateTimeoutId = null;
      }
      updateMessage(true); // Force final update

      const finalContent = messageParts.filter((p) => p.type === "text").map((p) => p.content).filter(Boolean).join("\n");
      onUpdateMessage(assistantMsgId, { content: finalContent, parts: messageParts, isStreaming: false });

      setIsThinking(false);
      setRunningTools([]);

      if (!abortControllerRef.current?.signal.aborted) {
        // Check for auto-compaction
        const modelInfo = getModel(provider, model);
        const contextLimit = modelInfo?.contextWindow ?? 200000;
        const percentUsed = Math.round((latestPromptTokens / contextLimit) * 100);

        if (shouldCompact(latestPromptTokens, contextLimit, 0.80)) {
          setStatus(`Context ${percentUsed}% - auto-compacting...`);
          setIsCompacting(true);

          try {
            const apiKey = await getApiKeyAsync(provider);
            // Compact everything up through the assistant's latest answer.
            const messagesToCompact = [
              ...messagesForApi,
              ...(finalContent ? [{ role: "assistant" as const, content: finalContent }] : []),
            ].filter((m) => m.role === "user" || m.role === "assistant");

            const result = await compactConversation(
              messagesToCompact.map((m) => ({ ...m, timestamp: Date.now() })),
              { provider, model, apiKey: apiKey ?? undefined }
            );

            if (result.success && result.summary) {
              onCompact(result.summary, result.originalMessageCount);
              const compacted = createCompactedMessage(result.summary, result.originalMessageCount);
              setSessionTokens(estimateConversationTokens([compacted]));
              setStatus(`Completed in ${formatTime(Date.now() - startTime)} | Auto-compacted`);
            } else {
              setStatus(`Completed in ${formatTime(Date.now() - startTime)}`);
            }
          } catch {
            setStatus(`Completed in ${formatTime(Date.now() - startTime)}`);
          } finally {
            setIsCompacting(false);
          }
        } else if (percentUsed > 60) {
          setStatus(`Completed in ${formatTime(Date.now() - startTime)} | Context ${percentUsed}%`);
        } else {
          setStatus(`Completed in ${formatTime(Date.now() - startTime)}`);
        }
      }
      setCancelCountdown(null);
    },
    [provider, model, sessionTokens, buildVisionContent, contentToTextForEstimate]
  );

  return {
    isThinking,
    status,
    elapsedTime,
    runningTools,
    sessionTokens,
    inputTokens,
    outputTokens,
    lastTaskInputTokens,
    lastTaskOutputTokens,
    cancelCountdown,
    isCompacting,
    activeFiles,
    bashApprovalPrompt,
    setBashApprovalPrompt,
    submitMessage,
    cancel,
    setStatus,
    setUiPaused,
  };
}
