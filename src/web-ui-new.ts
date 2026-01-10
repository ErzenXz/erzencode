import http from "node:http";
import { spawn, exec, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { createAIAgent, type AgentConfig, type AgentMode } from "./ai-agent.js";
import { setWorkspaceRoot } from "./tools-standalone.js";
import type { ProviderType } from "./ai-provider.js";
import { getWebModeHTML } from "./web-templates/web-mode.js";
import { getVibeModeHTML } from "./web-templates/vibe-mode.js";
import { MODEL_CHOICES, PROVIDERS, getApiKeyAsync } from "./config.js";

const WEB_UI_DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "web-ui",
);

function contentTypeForPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function tryServeStatic(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) return false;
  if (req.method !== "GET") return false;

  try {
    const indexPath = path.join(WEB_UI_DIST_DIR, "index.html");
    await fs.stat(indexPath);
  } catch {
    return false;
  }

  let rel = url.pathname;
  if (rel === "/") rel = "/index.html";
  rel = rel.replace(/\.{2,}/g, ".");
  const filePath = path.join(WEB_UI_DIST_DIR, rel);

  try {
    const st = await fs.stat(filePath);
    if (!st.isFile()) {
      return false;
    }
    const buf = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeForPath(filePath));
    res.end(buf);
    return true;
  } catch {
    if (url.pathname === "/") {
      try {
        const buf = await fs.readFile(path.join(WEB_UI_DIST_DIR, "index.html"));
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(buf);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export type UIMode = "web" | "vibe";

interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  history: string[];
  process: ChildProcess | null;
}

interface ChatSession {
  id: string;
  name: string;
  workspaceRoot: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  createdAt: number;
}

type WebUIState = {
  workspaceRoot: string;
  provider: ProviderType;
  model: string;
  mode: AgentMode;
  uiMode: UIMode;
  terminals: Map<string, TerminalSession>;
  sessions: Map<string, ChatSession>;
  currentSessionId: string;
};

export type WebUIHandle = {
  url: string;
  close: () => Promise<void>;
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function safeJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    let buf = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { buf += chunk; });
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}

function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch { /* ignore */ }
}

async function executeCommand(command: string, cwd: string): Promise<{ output: string; error?: string; exitCode?: number }> {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 60000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ output: stdout || "", error: stderr || error.message, exitCode: error.code ?? 1 });
      } else {
        resolve({ output: stdout + (stderr ? "\n" + stderr : ""), exitCode: 0 });
      }
    });
  });
}

async function listDirectory(dirPath: string): Promise<Array<{ name: string; type: "file" | "directory"; size?: number }>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const item: { name: string; type: "file" | "directory"; size?: number } = {
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      };
      if (!entry.isDirectory()) {
        try {
          const stat = await fs.stat(path.join(dirPath, entry.name));
          item.size = stat.size;
        } catch { /* ignore */ }
      }
      results.push(item);
    }
    return results.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

export async function startWebUI(options: {
  baseConfig: AgentConfig;
  initialWorkspaceRoot: string;
  provider: ProviderType;
  model: string;
  mode: AgentMode;
  uiMode?: UIMode;
  openBrowser?: boolean;
}): Promise<WebUIHandle> {
  const initialSessionId = generateId();
  const initialTerminalId = generateId();
  
  const state: WebUIState = {
    workspaceRoot: options.initialWorkspaceRoot,
    provider: options.provider,
    model: options.model,
    mode: options.mode,
    uiMode: options.uiMode ?? "web",
    terminals: new Map([[initialTerminalId, {
      id: initialTerminalId,
      name: "Terminal 1",
      cwd: options.initialWorkspaceRoot,
      history: [],
      process: null,
    }]]),
    sessions: new Map([[initialSessionId, {
      id: initialSessionId,
      name: "Session 1",
      workspaceRoot: options.initialWorkspaceRoot,
      messages: [],
      createdAt: Date.now(),
    }]]),
    currentSessionId: initialSessionId,
  };

  const rebuildAgent = async () => {
    const apiKey = await getApiKeyAsync(state.provider);
    return createAIAgent({
      ...options.baseConfig,
      apiKey: apiKey ?? options.baseConfig.apiKey,
      provider: state.provider,
      model: state.model,
      mode: state.mode,
      workspaceRoot: state.workspaceRoot,
    });
  };

  let agent = await rebuildAgent();
  setWorkspaceRoot(state.workspaceRoot);

  let sseRes: http.ServerResponse | null = null;
  const sseClients: Set<http.ServerResponse> = new Set();
  let currentAbortController: AbortController | null = null;

  const server = http.createServer(async (req, res) => {
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

      if (await tryServeStatic(req, res)) {
        return;
      }

      // Serve HTML based on UI mode
      if (req.method === "GET" && url.pathname === "/") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const html = state.uiMode === "vibe" ? getVibeModeHTML() : getWebModeHTML();
        res.end(html);
        return;
      }

      // Config endpoints
      if (req.method === "GET" && url.pathname === "/api/config") {
        const currentSession = state.sessions.get(state.currentSessionId);
        safeJson(res, 200, {
          workspaceRoot: state.workspaceRoot,
          provider: state.provider,
          model: state.model,
          mode: state.mode,
          uiMode: state.uiMode,
          currentSessionId: state.currentSessionId,
          sessions: Array.from(state.sessions.values()).map(s => ({
            id: s.id, name: s.name, workspaceRoot: s.workspaceRoot, createdAt: s.createdAt
          })),
          terminals: Array.from(state.terminals.values()).map(t => ({
            id: t.id, name: t.name, cwd: t.cwd
          })),
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/config") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { 
          workspaceRoot?: string; 
          mode?: AgentMode;
          provider?: ProviderType;
          model?: string;
        };

        let needsRebuild = false;

        if (body.workspaceRoot) {
          const candidate = path.resolve(body.workspaceRoot);
          try {
            const st = await fs.stat(candidate);
            if (!st.isDirectory()) {
              safeJson(res, 400, { error: "workspaceRoot must be a directory" });
              return;
            }
            state.workspaceRoot = candidate;
            setWorkspaceRoot(candidate);
            needsRebuild = true;
          } catch {
            safeJson(res, 400, { error: "Invalid workspace path" });
            return;
          }
        }

        if (body.mode && ["agent", "ask", "plan"].includes(body.mode)) {
          state.mode = body.mode;
          needsRebuild = true;
        }

        if (body.provider) {
          state.provider = body.provider;
          needsRebuild = true;
        }

        if (body.model) {
          state.model = body.model;
          needsRebuild = true;
        }

        if (needsRebuild) {
          agent = await rebuildAgent();
        }

        safeJson(res, 200, { ok: true });
        return;
      }

      // Providers list
      if (req.method === "GET" && url.pathname === "/api/providers") {
        const providersWithStatus = await Promise.all(
          PROVIDERS.map(async (p) => ({
            id: p.id,
            name: p.name,
            hasKey: !!(await getApiKeyAsync(p.id)),
          }))
        );
        safeJson(res, 200, { providers: providersWithStatus });
        return;
      }

      // Models list
      if (req.method === "GET" && url.pathname === "/api/models") {
        const provider = url.searchParams.get("provider") || state.provider;
        const models = MODEL_CHOICES[provider as ProviderType] || [];
        safeJson(res, 200, { models, currentModel: state.model });
        return;
      }

      // Browse directories
      if (req.method === "GET" && url.pathname === "/api/browse") {
        const dirPath = url.searchParams.get("path") || os.homedir();
        const resolvedPath = path.resolve(dirPath);
        const entries = await listDirectory(resolvedPath);
        const parent = path.dirname(resolvedPath);
        safeJson(res, 200, {
          path: resolvedPath,
          parent: parent !== resolvedPath ? parent : null,
          entries
        });
        return;
      }

      // File System API - List files
      if (req.method === "GET" && url.pathname === "/api/files") {
        const reqPath = url.searchParams.get("path") || state.workspaceRoot;
        const resolvedPath = path.resolve(reqPath);

        // Build hierarchical file tree
        async function buildTree(dir: string, relativeTo: string): Promise<Array<{ name: string; type: "file" | "directory"; path: string; size?: number; children?: any[] }>> {
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const results: Array<{ name: string; type: "file" | "directory"; path: string; size?: number; children?: any[] }> = [];

            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue; // Skip hidden files
              if (entry.name === "node_modules") continue; // Skip node_modules
              if (entry.name === "dist" || entry.name === "build") continue; // Skip build dirs

              const fullPath = path.join(dir, entry.name);
              const relPath = path.relative(relativeTo, fullPath);
              const item: { name: string; type: "file" | "directory"; path: string; size?: number; children?: any[] } = {
                name: entry.name,
                type: entry.isDirectory() ? "directory" : "file",
                path: relPath,
              };

              if (entry.isDirectory()) {
                item.children = await buildTree(fullPath, relativeTo);
              } else {
                try {
                  const stat = await fs.stat(fullPath);
                  item.size = stat.size;
                } catch { /* ignore */ }
              }
              results.push(item);
            }
            return results.sort((a, b) => {
              if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          } catch {
            return [];
          }
        }

        const files = await buildTree(resolvedPath, resolvedPath);
        safeJson(res, 200, { files });
        return;
      }

      // File System API - Read file content
      if (req.method === "GET" && url.pathname === "/api/files/content") {
        const reqPath = url.searchParams.get("path");
        if (!reqPath) {
          safeJson(res, 400, { error: "path parameter required" });
          return;
        }

        const resolvedPath = path.resolve(path.join(state.workspaceRoot, reqPath));
        try {
          // Ensure path is within workspace
          const relativePath = path.relative(state.workspaceRoot, resolvedPath);
          if (relativePath.startsWith("..")) {
            safeJson(res, 403, { error: "Access denied" });
            return;
          }

          const content = await fs.readFile(resolvedPath, "utf-8");
          safeJson(res, 200, { path: reqPath, content });
        } catch (e: any) {
          safeJson(res, 404, { error: `File not found: ${e.message}` });
        }
        return;
      }

      // File System API - Write file content
      if (req.method === "PUT" && url.pathname === "/api/files/content") {
        const reqPath = url.searchParams.get("path");
        if (!reqPath) {
          safeJson(res, 400, { error: "path parameter required" });
          return;
        }

        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { content: string };

        const resolvedPath = path.resolve(path.join(state.workspaceRoot, reqPath));
        try {
          // Ensure path is within workspace
          const relativePath = path.relative(state.workspaceRoot, resolvedPath);
          if (relativePath.startsWith("..")) {
            safeJson(res, 403, { error: "Access denied" });
            return;
          }

          // Ensure directory exists
          const dir = path.dirname(resolvedPath);
          await fs.mkdir(dir, { recursive: true });

          await fs.writeFile(resolvedPath, body.content, "utf-8");
          safeJson(res, 200, { ok: true, path: reqPath });
        } catch (e: any) {
          safeJson(res, 500, { error: `Failed to write file: ${e.message}` });
        }
        return;
      }

      // File System API - Delete file
      if (req.method === "DELETE" && url.pathname === "/api/files") {
        const reqPath = url.searchParams.get("path");
        if (!reqPath) {
          safeJson(res, 400, { error: "path parameter required" });
          return;
        }

        const resolvedPath = path.resolve(path.join(state.workspaceRoot, reqPath));
        try {
          // Ensure path is within workspace
          const relativePath = path.relative(state.workspaceRoot, resolvedPath);
          if (relativePath.startsWith("..")) {
            safeJson(res, 403, { error: "Access denied" });
            return;
          }

          await fs.unlink(resolvedPath);
          safeJson(res, 200, { ok: true });
        } catch (e: any) {
          safeJson(res, 500, { error: `Failed to delete file: ${e.message}` });
        }
        return;
      }

      // File System API - Create directory
      if (req.method === "POST" && url.pathname === "/api/files/mkdir") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { path: string };

        if (!body.path) {
          safeJson(res, 400, { error: "path parameter required" });
          return;
        }

        const resolvedPath = path.resolve(path.join(state.workspaceRoot, body.path));
        try {
          // Ensure path is within workspace
          const relativePath = path.relative(state.workspaceRoot, resolvedPath);
          if (relativePath.startsWith("..")) {
            safeJson(res, 403, { error: "Access denied" });
            return;
          }

          await fs.mkdir(resolvedPath, { recursive: true });
          safeJson(res, 200, { ok: true });
        } catch (e: any) {
          safeJson(res, 500, { error: `Failed to create directory: ${e.message}` });
        }
        return;
      }

      // File System API - Move/rename file
      if (req.method === "POST" && url.pathname === "/api/files/move") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { from: string; to: string };

        if (!body.from || !body.to) {
          safeJson(res, 400, { error: "from and to parameters required" });
          return;
        }

        const fromPath = path.resolve(path.join(state.workspaceRoot, body.from));
        const toPath = path.resolve(path.join(state.workspaceRoot, body.to));

        try {
          // Ensure paths are within workspace
          const fromRelative = path.relative(state.workspaceRoot, fromPath);
          const toRelative = path.relative(state.workspaceRoot, toPath);
          if (fromRelative.startsWith("..") || toRelative.startsWith("..")) {
            safeJson(res, 403, { error: "Access denied" });
            return;
          }

          await fs.rename(fromPath, toPath);
          safeJson(res, 200, { ok: true });
        } catch (e: any) {
          safeJson(res, 500, { error: `Failed to move file: ${e.message}` });
        }
        return;
      }

      // Sessions management
      if (req.method === "GET" && url.pathname === "/api/sessions") {
        safeJson(res, 200, {
          currentSessionId: state.currentSessionId,
          sessions: Array.from(state.sessions.values()).map(s => ({
            id: s.id, name: s.name, workspaceRoot: s.workspaceRoot, 
            messageCount: s.messages.length, createdAt: s.createdAt
          })),
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/sessions") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { name?: string; workspaceRoot?: string };
        const id = generateId();
        const session: ChatSession = {
          id,
          name: body.name || `Session ${state.sessions.size + 1}`,
          workspaceRoot: body.workspaceRoot || state.workspaceRoot,
          messages: [],
          createdAt: Date.now(),
        };
        state.sessions.set(id, session);
        state.currentSessionId = id;
        state.workspaceRoot = session.workspaceRoot;
        setWorkspaceRoot(session.workspaceRoot);
        agent = await rebuildAgent();
        safeJson(res, 200, { session: { id: session.id, name: session.name, workspaceRoot: session.workspaceRoot } });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/sessions/switch") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { sessionId: string };
        const session = state.sessions.get(body.sessionId);
        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }
        state.currentSessionId = session.id;
        state.workspaceRoot = session.workspaceRoot;
        setWorkspaceRoot(session.workspaceRoot);
        agent = await rebuildAgent();
        safeJson(res, 200, { ok: true, session: { id: session.id, name: session.name } });
        return;
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = url.pathname.split("/").pop();
        if (sessionId && state.sessions.has(sessionId)) {
          state.sessions.delete(sessionId);
          if (state.currentSessionId === sessionId && state.sessions.size > 0) {
            state.currentSessionId = state.sessions.keys().next().value!;
          }
        }
        safeJson(res, 200, { ok: true });
        return;
      }

      // Terminals management
      if (req.method === "GET" && url.pathname === "/api/terminals") {
        safeJson(res, 200, {
          terminals: Array.from(state.terminals.values()).map(t => ({
            id: t.id, name: t.name, cwd: t.cwd, historyLength: t.history.length
          })),
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/terminals") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { name?: string; cwd?: string };
        const id = generateId();
        const terminal: TerminalSession = {
          id,
          name: body.name || `Terminal ${state.terminals.size + 1}`,
          cwd: body.cwd || state.workspaceRoot,
          history: [],
          process: null,
        };
        state.terminals.set(id, terminal);
        safeJson(res, 200, { terminal: { id: terminal.id, name: terminal.name, cwd: terminal.cwd } });
        return;
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/api/terminals/")) {
        const terminalId = url.pathname.split("/").pop();
        if (terminalId && state.terminals.has(terminalId)) {
          const term = state.terminals.get(terminalId);
          if (term?.process) {
            try { term.process.kill(); } catch { /* ignore */ }
          }
          state.terminals.delete(terminalId);
        }
        safeJson(res, 200, { ok: true });
        return;
      }

      // SSE events endpoint
      if (req.method === "GET" && url.pathname === "/api/events") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.write("retry: 1000\n\n");
        sseRes = res;
        sseClients.add(res);

        const keepAlive = setInterval(() => {
          try { res.write(`event: ping\ndata: {}\n\n`); } catch { /* ignore */ }
        }, 15000);

        req.on("close", () => {
          clearInterval(keepAlive);
          sseClients.delete(res);
          if (sseRes === res) sseRes = null;
        });
        return;
      }

      // Abort/Stop endpoint
      if (req.method === "POST" && url.pathname === "/api/abort") {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        safeJson(res, 200, { ok: true });
        return;
      }

      // Message endpoint
      if (req.method === "POST" && url.pathname === "/api/message") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { message?: string; sessionId?: string };
        const message = (body.message ?? "").trim();
        
        if (!message) {
          safeJson(res, 400, { error: "message required" });
          return;
        }

        if (!sseRes) {
          safeJson(res, 409, { error: "no event stream connected" });
          return;
        }

        const sessionId = body.sessionId || state.currentSessionId;
        const session = state.sessions.get(sessionId);
        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }

        session.messages.push({ role: "user" as const, content: message });
        safeJson(res, 200, { ok: true });

        currentAbortController = new AbortController();
        const abortSignal = currentAbortController.signal;

        const writeEvent = (event: unknown) => {
          try { sseRes?.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* ignore */ }
        };

        let responseText = "";
        try {
          for await (const event of agent.stream(session.messages)) {
            if (abortSignal.aborted) {
              writeEvent({ type: "aborted", data: {} });
              break;
            }
            if (event.type === "text-delta") {
              const text = (event.data as any)?.text ?? "";
              responseText += text;
              writeEvent({ type: "text-delta", data: { text } });
            } else if (event.type === "tool-call") {
              writeEvent({ type: "tool-call", data: event.data });
            } else if (event.type === "tool-result") {
              writeEvent({ type: "tool-result", data: event.data });
            } else if (event.type === "reasoning") {
              writeEvent({ type: "thinking", data: event.data });
            } else if (event.type === "error") {
              writeEvent({ type: "error", data: event.data });
            }
          }
          
          if (responseText) {
            session.messages.push({ role: "assistant" as const, content: responseText });
          }
          writeEvent({ type: "complete", data: {} });
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            writeEvent({ type: "error", data: { message: e?.message ?? String(e) } });
          }
        } finally {
          currentAbortController = null;
        }
        return;
      }

      // Terminal command endpoint
      if (req.method === "POST" && url.pathname === "/api/terminal") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { command?: string; terminalId?: string; cwd?: string };
        const command = (body.command ?? "").trim();
        
        if (!command) {
          safeJson(res, 400, { error: "command required" });
          return;
        }

        const terminalId = body.terminalId || state.terminals.keys().next().value;
        const terminal = terminalId ? state.terminals.get(terminalId) : null;
        const cwd = body.cwd || terminal?.cwd || state.workspaceRoot;

        // Handle cd command
        if (command.startsWith("cd ")) {
          const newDir = command.slice(3).trim().replace(/^["']|["']$/g, "");
          const resolved = path.resolve(cwd, newDir);
          try {
            const st = await fs.stat(resolved);
            if (st.isDirectory()) {
              if (terminal) {
                terminal.cwd = resolved;
                terminal.history.push(`$ ${command}`);
              }
              safeJson(res, 200, { output: "", cwd: resolved });
              return;
            }
          } catch { /* fall through */ }
          safeJson(res, 200, { output: "", error: `cd: no such directory: ${newDir}`, cwd });
          return;
        }

        const result = await executeCommand(command, cwd);
        if (terminal) {
          terminal.history.push(`$ ${command}`);
          if (result.output) terminal.history.push(result.output);
          if (result.error) terminal.history.push(`Error: ${result.error}`);
        }
        safeJson(res, 200, { ...result, cwd });
        return;
      }

      // Terminal history
      if (req.method === "GET" && url.pathname.startsWith("/api/terminal/") && url.pathname.endsWith("/history")) {
        const parts = url.pathname.split("/");
        const terminalId = parts[3];
        const terminal = state.terminals.get(terminalId || "");
        if (!terminal) {
          safeJson(res, 404, { error: "Terminal not found" });
          return;
        }
        safeJson(res, 200, { history: terminal.history, cwd: terminal.cwd });
        return;
      }

      // 404
      safeJson(res, 404, { error: "not found" });
    } catch (e: any) {
      safeJson(res, 500, { error: e?.message ?? String(e) });
    }
  });

  const requestedPortRaw = process.env.CODING_CLI_WEB_UI_PORT;
  const requestedPort = requestedPortRaw ? Number.parseInt(requestedPortRaw, 10) : 0;
  if (requestedPortRaw && (!Number.isFinite(requestedPort) || requestedPort < 0)) {
    throw new Error("Invalid CODING_CLI_WEB_UI_PORT");
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Failed to bind web server");
  }

  const url = `http://127.0.0.1:${addr.port}`;
  if (options.openBrowser !== false) {
    openInBrowser(url);
  }

  return {
    url,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// Export for backwards compatibility
export { startWebUI as startVibeUI };
