import React, { useEffect, useRef, useState, useCallback } from "react";

import type { ChatStatus, ToolUIPart } from "ai";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

import { Header } from "@/components/layout/Header";
import { ResizableLayout } from "@/components/layout/ResizableLayout";
import { FileTree } from "@/components/files/FileTree";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainView } from "@/components/layout/MainView";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { EditorTabs, OpenFile, Breadcrumbs } from "@/components/editor/EditorTabs";
import { EditorPreviewSplit } from "@/components/preview/PreviewPanel";
import { TerminalPanel } from "@/components/terminal/Terminal";
import { SettingsModal } from "@/components/settings/SettingsModal";

import { fileSystemAPI } from "@/lib/file-system";
import { useConfig } from "@/hooks/useConfig";
import { CommandInput } from "@/components/CommandInput";

type UIConfig = {
  workspaceRoot: string;
  provider: string;
  model: string;
  mode: string;
  uiMode: "web" | "vibe";
  currentSessionId: string;
  sessions: Array<{ id: string; name: string; workspaceRoot: string; createdAt: number }>;
};

type SSEEvent =
  | { type: "text-delta"; data: { text?: string } }
  | { type: "thinking"; data: { text?: string } }
  | { type: "tool-call"; data: { toolCallId?: string; toolName?: string; args?: any } }
  | { type: "tool-result"; data: { toolCallId?: string; result?: any; isError?: boolean } }
  | { type: "complete"; data: {} }
  | { type: "aborted"; data: {} }
  | { type: "error"; data: { message?: string } };

type ChatPart =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string; isStreaming: boolean }
  | { kind: "tool"; tool: ToolUIPart };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function safeToolType(toolName?: string): ToolUIPart["type"] {
  const suffix = (toolName || "tool").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `tool-${suffix}` as ToolUIPart["type"];
}

export function App() {
  const { config, switchSession, createSession } = useConfig();
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // File/Editor state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>();
  const [activeFileContent, setActiveFileContent] = useState<string>("");

  const currentAssistantIdRef = useRef<string | null>(null);
  const pendingToolsRef = useRef<Map<string, ToolUIPart>>(new Map());

  const isVibe = config?.uiMode === "vibe";

  // Load messages when session changes
  useEffect(() => {
    if (!config?.currentSessionId) return;
    
    // Clear messages first to avoid showing old session data
    setMessages([]);

    fetch(`/api/messages?sessionId=${config.currentSessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages && Array.isArray(data.messages)) {
           // Convert backend messages to frontend format
           const loadedMessages: ChatMessage[] = data.messages.map((m: any) => ({
             id: generateId(), // Backend doesn't store IDs per message apparently
             role: m.role,
             parts: [{ kind: "text", text: m.content }]
           }));
           setMessages(loadedMessages);
        }
      })
      .catch(e => console.error("Failed to load messages", e));
  }, [config?.currentSessionId]);

  // SSE for streaming events
  useEffect(() => {
    if (!config?.currentSessionId) return;

    currentAssistantIdRef.current = null;
    pendingToolsRef.current.clear();

    const es = new EventSource(`/api/events?sessionId=${encodeURIComponent(config.currentSessionId)}`);

    const ensureAssistantMessage = () => {
      if (currentAssistantIdRef.current) return currentAssistantIdRef.current;

      const id = generateId();
      currentAssistantIdRef.current = id;
      setMessages((prev) =>
        prev.concat([
          {
            id,
            role: "assistant",
            parts: [{ kind: "text", text: "" }],
          },
        ])
      );
      return id;
    };

    const updateAssistantText = (id: string, updater: (text: string) => string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const idx = m.parts.findIndex((p) => p.kind === "text");
          const parts = [...m.parts];
          if (idx === -1) {
            parts.push({ kind: "text", text: updater("") });
          } else {
            const current = parts[idx] as Extract<ChatPart, { kind: "text" }>;
            parts[idx] = { kind: "text", text: updater(current.text) };
          }
          return { ...m, parts };
        })
      );
    };

    const setAssistantReasoning = (id: string, text: string, isStreaming: boolean) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const parts = m.parts.filter((p) => p.kind !== "reasoning") as ChatPart[];
          parts.push({ kind: "reasoning", text, isStreaming });
          return { ...m, parts };
        })
      );
    };

    const upsertToolPart = (id: string, tool: ToolUIPart) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const existing = m.parts.find((p) => p.kind === "tool" && (p.tool as any).toolCallId === (tool as any).toolCallId);
          const parts: ChatPart[] = existing
            ? m.parts.map((p): ChatPart =>
                p.kind === "tool" && (p.tool as any).toolCallId === (tool as any).toolCallId
                  ? ({ kind: "tool", tool } as ChatPart)
                  : p
              )
            : m.parts.concat([{ kind: "tool", tool }]);
          return { ...m, parts };
        })
      );
    };

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as SSEEvent;

        if (parsed.type === "text-delta") {
          setStatus("streaming");
          setError(null);
          const id = ensureAssistantMessage();
          const delta = parsed.data?.text ?? "";
          updateAssistantText(id, (t) => t + delta);
          return;
        }

        if (parsed.type === "thinking") {
          setStatus("streaming");
          setError(null);
          const id = ensureAssistantMessage();
          setAssistantReasoning(id, parsed.data?.text ?? "Thinking...", true);
          return;
        }

        if (parsed.type === "tool-call") {
          setStatus("streaming");
          setError(null);
          const id = ensureAssistantMessage();
          const toolCallId = parsed.data?.toolCallId ?? generateId();

          const tool: ToolUIPart = {
            type: safeToolType(parsed.data?.toolName),
            state: "input-available" as ToolUIPart["state"],
            input: parsed.data?.args ?? {},
            output: undefined,
            errorText: undefined,
            ...( { toolCallId } as any ),
          };

          pendingToolsRef.current.set(toolCallId, tool);
          upsertToolPart(id, tool);
          return;
        }

        if (parsed.type === "tool-result") {
          setStatus("streaming");
          setError(null);
          const id = ensureAssistantMessage();
          const toolCallId = parsed.data?.toolCallId;
          if (!toolCallId) return;

          const prevTool = pendingToolsRef.current.get(toolCallId);
          if (!prevTool) return;

          const nextTool: ToolUIPart = {
            ...prevTool,
            state: (parsed.data?.isError ? "output-error" : "output-available") as ToolUIPart["state"],
            output: parsed.data?.isError ? undefined : parsed.data?.result,
            errorText: parsed.data?.isError ? JSON.stringify(parsed.data?.result ?? "Error") : undefined,
            ...( { toolCallId } as any ),
          };
          pendingToolsRef.current.set(toolCallId, nextTool);
          upsertToolPart(id, nextTool);
          return;
        }

        if (parsed.type === "complete" || parsed.type === "aborted") {
          setStatus("ready");
          currentAssistantIdRef.current = null;
          pendingToolsRef.current.clear();
          setMessages((prev) =>
            prev.map((m) => {
              if (m.role !== "assistant") return m;
              const parts = m.parts.map((p) =>
                p.kind === "reasoning" ? { ...p, isStreaming: false } : p
              );
              return { ...m, parts };
            })
          );
          return;
        }

        if (parsed.type === "error") {
          setStatus("error");
          setError((parsed.data as any)?.message ?? (parsed.data as any)?.error ?? "Unknown error");
          currentAssistantIdRef.current = null;
          pendingToolsRef.current.clear();
          return;
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setError("Event stream disconnected");
    };

    return () => {
      es.close();
    };
  }, [config?.currentSessionId]);

  const handleSubmit = async (msg: PromptInputMessage) => {
    const text = (msg.text ?? "").trim();
    if (!text || status === "submitted" || status === "streaming") return;

    setError(null);

    const userId = generateId();
    setMessages((prev) =>
      prev.concat([
        {
          id: userId,
          role: "user",
          parts: [{ kind: "text", text }],
        },
      ])
    );

    setStatus("submitted");

    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: config?.currentSessionId }),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          msg = data?.error ?? data?.message ?? msg;
        } catch {
          // ignore
        }
        setStatus("error");
        setError(msg);
      }
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? String(e));
    }
  };

  const handleStop = async () => {
    try {
      await fetch("/api/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: config?.currentSessionId }),
      });
    } catch {
      // ignore
    }
  };

  // Handle slash commands
  const handleCommand = async (command: string, args: string[]) => {
    setError(null);

    switch (command) {
      case "help":
        // TODO: Show help modal
        setError("Help: /help, /models, /sessions, /theme, /thinking, /provider, /bash, /cost, /index, /search, /new, /reset, /clear");
        break;
      case "new":
        await createSession();
        break;
      case "clear":
        setMessages([]);
        break;
      case "reset":
        setMessages([]);
        break;
      case "models":
      case "sessions":
      case "theme":
      case "thinking":
      case "provider":
      case "settings":
        setSettingsOpen(true);
        break;
      default:
        setError(`Command /${command} not implemented yet`);
    }
  };

  // File selection handler
  const handleFileSelect = useCallback(async (path: string, content: string) => {
    // Check if file is already open
    const existingFile = openFiles.find((f) => f.path === path);
    if (!existingFile) {
      setOpenFiles((prev) => [...prev, { path, content, modified: false }]);
    }
    setActiveFilePath(path);
    setActiveFileContent(content);
  }, [openFiles]);

  const handleFileClose = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const newFiles = prev.filter((f) => f.path !== path);
      if (activeFilePath === path && newFiles.length > 0) {
        setActiveFilePath(newFiles[0].path);
        setActiveFileContent(newFiles[0].content);
      } else if (newFiles.length === 0) {
        setActiveFilePath(undefined);
        setActiveFileContent("");
      }
      return newFiles;
    });
  }, [activeFilePath]);

  const handleFileChange = useCallback((content: string | undefined) => {
    const next = content ?? "";
    setActiveFileContent(next);
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === activeFilePath ? { ...f, content: next, modified: true } : f
      )
    );
  }, [activeFilePath]);

  const handleTabSelect = useCallback((path: string) => {
    const file = openFiles.find((f) => f.path === path);
    if (file) {
      setActiveFilePath(path);
      setActiveFileContent(file.content);
    }
  }, [openFiles]);


  // Chat panel component
  const chatMessages = (
    <Conversation>
      <ConversationContent>
        {messages.length === 0 ? (
          null // Handled by MainView empty state
        ) : (
          messages.map((m) => (
            <Message from={m.role} key={m.id}>
              <MessageContent>
                {m.parts.map((p, idx) => {
                  if (p.kind === "text") {
                    return <MessageResponse key={`${m.id}:text:${idx}`}>{p.text}</MessageResponse>;
                  }
                  if (p.kind === "reasoning") {
                    return (
                      <Reasoning key={`${m.id}:reasoning:${idx}`} isStreaming={p.isStreaming}>
                        <ReasoningTrigger />
                        <ReasoningContent>{p.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }
                  if (p.kind === "tool") {
                    const toolCallId = (p.tool as any).toolCallId as string | undefined;
                    return (
                      <Tool key={`${m.id}:tool:${toolCallId ?? idx}`} defaultOpen={false}>
                        <ToolHeader
                          state={p.tool.state}
                          type={p.tool.type}
                        />
                        <ToolContent>
                          <ToolInput input={p.tool.input} />
                          <ToolOutput toolType={p.tool.type} errorText={p.tool.errorText} output={p.tool.output} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
                {m.role === "assistant" && status === "submitted" && m.id === currentAssistantIdRef.current && (
                  <Loader />
                )}
              </MessageContent>
            </Message>
          ))
        )}
      </ConversationContent>
      {messages.length > 0 && <ConversationScrollButton />}
    </Conversation>
  );

  const chatPanel = (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Chat</span>
      </div>

      {/* Chat Content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {chatMessages}
        {messages.length === 0 && (
            <ConversationEmptyState
            title="Start Building"
            description="Describe what you want to create, and I'll help you build it."
            />
        )}

        {/* Input */}
        <div className="border-t border-border bg-background p-3 relative">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <CommandInput
                sessionId={config?.currentSessionId}
                onSubmit={handleSubmit}
                onCommand={handleCommand}
                disabled={status === "submitted" || status === "streaming"}
                placeholder={isVibe ? "Describe what you want to build… or /command" : "Ask… or /command"}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton
                  disabled={!(status === "submitted" || status === "streaming")}
                  onClick={handleStop}
                >
                  Stop
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit disabled={status === "submitted" || status === "streaming"} status={status} />
            </PromptInputFooter>
          </PromptInput>
          {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
        </div>
      </div>
    </div>
  );

  // File tree panel
  const fileTreePanel = (
    <FileTree
      onFileSelect={handleFileSelect}
      selectedPath={activeFilePath}
      sessionId={config?.currentSessionId}
    />
  );

  // Editor panel
  const editorPanel = (
    <div className="flex h-full flex-col">
      <EditorTabs
        files={openFiles}
        activePath={activeFilePath}
        onSelect={handleTabSelect}
        onClose={handleFileClose}
      />
      {activeFilePath ? (
        <>
          <Breadcrumbs path={activeFilePath} />
          <div className="flex-1">
            <MonacoEditor
              value={activeFileContent}
              onChange={handleFileChange}
              path={activeFilePath}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-sm">Select a file to edit</p>
          </div>
        </div>
      )}
    </div>
  );

  // Terminal panel
  const terminalPanel = <TerminalPanel />;

  // Settings modal
  const settingsModal = <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />;

  // Web Layout (New)
  const webLayout = (
    <div className="flex h-full">
        <div className="w-[300px] flex-shrink-0">
            <Sidebar 
                sessions={config?.sessions} 
                currentSessionId={config?.currentSessionId}
                onOpenSettings={() => setSettingsOpen(true)}
                onNewSession={createSession}
                onSessionSelect={switchSession}
            />
        </div>
        <div className="flex-1 min-w-0">
            <MainView 
                workspaceRoot={config?.workspaceRoot}
                currentBranch="Main branch (master)" // TODO: Get from config
                lastModified="2 seconds ago" // TODO: Get from config/stats
                onSubmit={handleSubmit}
                messages={messages}
            >
                {messages.length > 0 ? (
                    <div className="max-w-3xl mx-auto w-full h-full flex flex-col">
                        {chatMessages}
                    </div>
                ) : null}
            </MainView>
        </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {isVibe ? (
        <>
            {/* Header only for Vibe mode if needed, or maybe standard header is fine */}
            <Header onOpenSettings={() => setSettingsOpen(true)} />
            <ResizableLayout
            defaultSizes={{
                left: [20],
                center: [50, 30],
                right: [30],
                bottom: [25],
            }}
            >
            {fileTreePanel}
            <EditorPreviewSplit
                filePath={activeFilePath}
                fileContent={activeFileContent}
                onFileChange={handleFileChange}
            />
            {chatPanel}
            {terminalPanel}
            </ResizableLayout>
        </>
      ) : (
        webLayout
      )}

      {/* Settings Modal */}
      {settingsModal}
    </div>
  );
}
