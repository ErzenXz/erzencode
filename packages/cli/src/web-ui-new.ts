/**
 * Web UI Server
 * Serves the React-based web UI with API endpoints
 */

import http from "node:http";
import { spawn, exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { createAIAgent, type AgentConfig, type AgentMode } from "@erzencode/core/ai-agent";
import {
  setWorkspaceRoot,
  approveBashCommandOnce,
  cancelBashApproval,
  setBashYoloMode,
  addBashAllowPrefix,
  removeBashAllowPrefix,
  getBashApprovalStatus,
  getPendingBashApprovals,
} from "@erzencode/core/tools";
import type { ProviderType } from "@erzencode/core/ai-provider";
import {
  MODEL_CHOICES,
  PROVIDERS,
  getApiKeyAsync,
  modelSupportsThinking,
  resolveThinkingConfig,
  setApiKey,
  type ThinkingLevel,
} from "@erzencode/core/config";
import type { ProviderInfo } from "@erzencode/core/models";

const WEB_UI_DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "web-ui",
);

async function resolveWebUIDistDir(): Promise<string | null> {
  const candidates = [
    WEB_UI_DIST_DIR,
    path.resolve(process.cwd(), "dist", "web-ui"),
    path.resolve(process.cwd(), "node_modules", "erzencode", "dist", "web-ui"),
  ];

  for (const candidate of candidates) {
    try {
      const indexPath = path.join(candidate, "index.html");
      const st = await fs.stat(indexPath);
      if (st.isFile()) return candidate;
    } catch {
      // ignore
    }
  }

  return null;
}

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
    case ".json":
      return "application/json; charset=utf-8";
    case ".woff":
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

// Check at startup if web UI is built
async function validateWebUIBuilt(distDir: string): Promise<boolean> {
  try {
    const indexPath = path.join(distDir, "index.html");
    const stat = await fs.stat(indexPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function tryServeStatic(
  distDir: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) return false;
  if (req.method !== "GET") return false;

  let rel = url.pathname;
  if (rel === "/") rel = "index.html";
  rel = rel.replace(/^\/+/, "");
  rel = rel.replace(/\.{2,}/g, ".");

  const filePath = path.join(distDir, rel);

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
    // For root path, show helpful error if index.html doesn't exist
    if (url.pathname === "/") {
      res.statusCode = 503;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Web UI Not Built</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 80px auto; padding: 20px; }
    h1 { color: #e11d48; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>⚠️ Web UI Not Built</h1>
  <p>The web UI assets haven't been built yet. Run the following command:</p>
  <pre><code>npm run build:web-ui</code></pre>
  <p>Then start the web UI again.</p>
</body>
</html>`);
      return true;
    }

    // SPA fallback: serve index.html for client-side routes (e.g. /vibe)
    // Only do this when the path doesn't look like a real asset request.
    if (!path.extname(url.pathname)) {
      try {
        const indexPath = path.join(distDir, "index.html");
        const buf = await fs.readFile(indexPath);
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
  process: any;
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
  thinkingLevel: ThinkingLevel;
  temperature: number;
  maxTokens: number;
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

function inferThinkingLevel(thinking: unknown): ThinkingLevel {
  const cfg = thinking as { enabled?: boolean; budgetTokens?: number } | undefined;
  if (!cfg?.enabled) return "off";
  const budget = cfg.budgetTokens ?? 0;
  if (budget <= 1024) return "low";
  if (budget <= 4096) return "medium";
  return "high";
}

function safeJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
  const distDir = await resolveWebUIDistDir();
  if (!distDir) {
    throw new Error(
      "Web UI assets not found. Please build the web UI first:\n  pnpm run build:web-ui\n(or pnpm run build)"
    );
  }

  // Validate that web UI is built before starting
  const isBuilt = await validateWebUIBuilt(distDir);
  if (!isBuilt) {
    throw new Error(
      "Web UI assets not found. Please build the web UI first:\n  pnpm run build:web-ui\n(or pnpm run build)"
    );
  }

  const initialSessionId = generateId();
  const initialTerminalId = generateId();

  const state: WebUIState = {
    workspaceRoot: options.initialWorkspaceRoot,
    provider: options.provider,
    model: options.model,
    mode: options.mode,
    thinkingLevel: inferThinkingLevel((options.baseConfig as any).thinking),
    temperature: options.baseConfig.temperature ?? 0.7,
    maxTokens: options.baseConfig.maxTokens ?? 16384,
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
    const supportsThinking = modelSupportsThinking(state.provider, state.model);
    return createAIAgent({
      ...options.baseConfig,
      apiKey: apiKey ?? options.baseConfig.apiKey,
      provider: state.provider,
      model: state.model,
      mode: state.mode,
      workspaceRoot: state.workspaceRoot,
      thinking: resolveThinkingConfig(state.thinkingLevel, supportsThinking),
      temperature: state.temperature,
      maxTokens: state.maxTokens,
    });
  };

  let agent = await rebuildAgent();
  setWorkspaceRoot(state.workspaceRoot);

  const getConfigPayload = () => ({
    workspaceRoot: state.workspaceRoot,
    provider: state.provider,
    model: state.model,
    mode: state.mode,
    thinkingLevel: state.thinkingLevel,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    uiMode: state.uiMode,
    currentSessionId: state.currentSessionId,
    sessions: Array.from(state.sessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      workspaceRoot: s.workspaceRoot,
      createdAt: s.createdAt,
    })),
    terminals: Array.from(state.terminals.values()).map((t) => ({
      id: t.id,
      name: t.name,
      cwd: t.cwd,
    })),
  });

  let activeStreamSessionId: string | null = null;
  const sseClientsBySession = new Map<string, Set<http.ServerResponse>>();
  const abortControllerBySession = new Map<string, AbortController>();

  const getSSEClients = (sessionId: string): Set<http.ServerResponse> => {
    const existing = sseClientsBySession.get(sessionId);
    if (existing) return existing;
    const next = new Set<http.ServerResponse>();
    sseClientsBySession.set(sessionId, next);
    return next;
  };

  const writeEvent = (sessionId: string, event: unknown) => {
    const clients = sseClientsBySession.get(sessionId);
    if (!clients || clients.size === 0) return;

    for (const client of clients) {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  };

  const server = http.createServer(async (req, res) => {
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

      if (await tryServeStatic(distDir, req, res)) {
        return;
      }

      // Config endpoints
      if (req.method === "GET" && url.pathname === "/api/config") {
        safeJson(res, 200, getConfigPayload());
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/api-key") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { provider?: string; apiKey?: string };
        const provider = (body.provider ?? "").trim();
        const apiKey = (body.apiKey ?? "").trim();
        if (!provider || !apiKey) {
          safeJson(res, 400, { error: "provider and apiKey required" });
          return;
        }
        await setApiKey(provider, apiKey);
        safeJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/config") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as {
          workspaceRoot?: string;
          mode?: AgentMode;
          provider?: ProviderType;
          model?: string;
          thinkingLevel?: ThinkingLevel;
          temperature?: number;
          maxTokens?: number;
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
            const currentSession = state.sessions.get(state.currentSessionId);
            if (currentSession) {
              currentSession.workspaceRoot = candidate;
            }
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

        if (body.thinkingLevel && ["off", "low", "medium", "high"].includes(body.thinkingLevel)) {
          state.thinkingLevel = body.thinkingLevel;
          needsRebuild = true;
        }

        if (typeof body.temperature === "number" && Number.isFinite(body.temperature)) {
          state.temperature = body.temperature;
          needsRebuild = true;
        }

        if (typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens) && body.maxTokens > 0) {
          state.maxTokens = body.maxTokens;
          needsRebuild = true;
        }

        if (needsRebuild) {
          agent = await rebuildAgent();
        }

        safeJson(res, 200, getConfigPayload());
        return;
      }

      // Providers list
      if (req.method === "GET" && url.pathname === "/api/providers") {
        const providersWithStatus = await Promise.all(
          PROVIDERS.map(async (p: ProviderInfo) => ({
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

      // Slash commands list
      if (req.method === "GET" && url.pathname === "/api/commands") {
        const SLASH_COMMANDS = [
          { name: "help", aliases: ["h", "?"], description: "Show help and shortcuts" },
          { name: "models", aliases: ["m"], description: "Select AI model" },
          { name: "sessions", aliases: ["s"], description: "Manage sessions" },
          { name: "settings", description: "View/change settings" },
          { name: "theme", description: "Select theme" },
          { name: "thinking", aliases: ["t"], description: "Set thinking level" },
          { name: "provider", aliases: ["p"], description: "Switch provider" },
          { name: "bash", description: "Manage bash tool approvals" },
          { name: "cost", description: "Show token cost for this session" },
          { name: "index", aliases: ["idx"], description: "Index codebase for search" },
          { name: "search", description: "Search indexed codebase" },
          { name: "new", aliases: ["n"], description: "Create new session" },
          { name: "reset", aliases: ["r"], description: "Reset current session" },
          { name: "clear", aliases: ["c"], description: "Clear messages" },
        ];

        const query = url.searchParams.get("query") || "";
        if (!query) {
          safeJson(res, 200, { commands: SLASH_COMMANDS });
          return;
        }

        const q = query.toLowerCase().replace(/^\/?/, "");
        const matches = SLASH_COMMANDS.map((cmd) => {
          const name = cmd.name.toLowerCase();
          const aliases = (cmd.aliases || []).map((a) => a.toLowerCase());
          const namePrefix = name.startsWith(q) ? 3 : 0;
          const aliasPrefix = aliases.some((a) => a.startsWith(q)) ? 2 : 0;
          const nameIncludes = name.includes(q) ? 1 : 0;
          const aliasIncludes = aliases.some((a) => a.includes(q)) ? 1 : 0;
          const score = namePrefix + aliasPrefix + nameIncludes + aliasIncludes;
          return { cmd, score };
        })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score || a.cmd.name.localeCompare(b.cmd.name))
          .map((x) => x.cmd);

        safeJson(res, 200, { commands: matches });
        return;
      }

      // File autocomplete for @ mentions
      if (req.method === "GET" && url.pathname === "/api/files/autocomplete") {
        const query = url.searchParams.get("query") || "";
        const sessionId = url.searchParams.get("sessionId") || state.currentSessionId;
        const session = state.sessions.get(sessionId);

        if (!session || !query) {
          safeJson(res, 200, { files: [] });
          return;
        }

        const workspaceRoot = session.workspaceRoot;
        const results: string[] = [];

        try {
          async function searchDir(dir: string, query: string, maxDepth = 3): Promise<void> {
            if (maxDepth <= 0) return;

            try {
              const entries = await fs.readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name.startsWith(".")) continue;
                if (entry.name === "node_modules") continue;
                if (entry.name === "dist" || entry.name === "build") continue;

                const fullPath = path.join(dir, entry.name);
                const relPath = path.relative(workspaceRoot, fullPath);

                if (entry.isDirectory()) {
                  await searchDir(fullPath, query, maxDepth - 1);
                } else if (entry.isFile()) {
                  if (relPath.toLowerCase().includes(query.toLowerCase())) {
                    results.push(relPath);
                    if (results.length >= 20) return;
                  }
                }
              }
            } catch {
              // Ignore permission errors
            }
          }

          await searchDir(workspaceRoot, query);
          safeJson(res, 200, { files: results.slice(0, 20) });
        } catch {
          safeJson(res, 200, { files: [] });
        }
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
        const sessionId = url.searchParams.get("sessionId") || state.currentSessionId;
        const session = state.sessions.get(sessionId);
        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }

        const workspaceRoot = session.workspaceRoot;
        const reqPath = url.searchParams.get("path") || ".";
        const resolvedPath = path.resolve(path.join(workspaceRoot, reqPath));

        const relativePath = path.relative(workspaceRoot, resolvedPath);
        if (relativePath.startsWith("..")) {
          safeJson(res, 403, { error: "Access denied" });
          return;
        }

        async function buildTree(dir: string, relativeTo: string): Promise<any[]> {
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const results: any[] = [];

            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue;
              if (entry.name === "node_modules") continue;
              if (entry.name === "dist" || entry.name === "build") continue;

              const fullPath = path.join(dir, entry.name);
              const relPath = path.relative(relativeTo, fullPath);
              const item: any = {
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

        const files = await buildTree(resolvedPath, workspaceRoot);
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

        const sessionId = url.searchParams.get("sessionId") || state.currentSessionId;
        const session = state.sessions.get(sessionId);
        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }
        const workspaceRoot = session.workspaceRoot;

        const resolvedPath = path.resolve(path.join(workspaceRoot, reqPath));
        try {
          const relativePath = path.relative(workspaceRoot, resolvedPath);
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

        const sessionId = url.searchParams.get("sessionId") || state.currentSessionId;
        const session = state.sessions.get(sessionId);
        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }
        const workspaceRoot = session.workspaceRoot;

        const resolvedPath = path.resolve(path.join(workspaceRoot, reqPath));
        try {
          const relativePath = path.relative(workspaceRoot, resolvedPath);
          if (relativePath.startsWith("..")) {
            safeJson(res, 403, { error: "Access denied" });
            return;
          }

          const dir = path.dirname(resolvedPath);
          await fs.mkdir(dir, { recursive: true });

          await fs.writeFile(resolvedPath, body.content, "utf-8");
          safeJson(res, 200, { ok: true, path: reqPath });
        } catch (e: any) {
          safeJson(res, 500, { error: `Failed to write file: ${e.message}` });
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
        safeJson(res, 200, { ok: true });
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

      // SSE events endpoint
      if (req.method === "GET" && url.pathname === "/api/events") {
        const sessionId = url.searchParams.get("sessionId") || state.currentSessionId;
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.write("retry: 1000\n\n");

        const clients = getSSEClients(sessionId);
        clients.add(res);

        const keepAlive = setInterval(() => {
          try { res.write(`event: ping\ndata: {}\n\n`); } catch { /* ignore */ }
        }, 15000);

        req.on("close", () => {
          clearInterval(keepAlive);
          clients.delete(res);
        });
        return;
      }

      // Abort/Stop endpoint
      if (req.method === "POST" && url.pathname === "/api/abort") {
        const raw = await readBody(req);
        let sessionId = state.currentSessionId;
        try {
          const body = JSON.parse(raw || "{}") as { sessionId?: string };
          sessionId = body.sessionId || sessionId;
        } catch {
          // ignore
        }

        const controller = abortControllerBySession.get(sessionId);
        if (controller) {
          controller.abort();
          abortControllerBySession.delete(sessionId);
        }
        safeJson(res, 200, { ok: true });
        return;
      }

      // Message endpoint
      if (req.method === "GET" && url.pathname === "/api/messages") {
        const sessionId = url.searchParams.get("sessionId") || state.currentSessionId;
        const session = state.sessions.get(sessionId);

        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }

        safeJson(res, 200, { messages: session.messages });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/message") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { message?: string; sessionId?: string };
        const message = (body.message ?? "").trim();

        if (!message) {
          safeJson(res, 400, { error: "message required" });
          return;
        }

        const sessionId = body.sessionId || state.currentSessionId;
        const session = state.sessions.get(sessionId);
        if (!session) {
          safeJson(res, 404, { error: "Session not found" });
          return;
        }

        if (activeStreamSessionId && activeStreamSessionId !== sessionId) {
          safeJson(res, 409, { error: "another session is currently streaming" });
          return;
        }

        if (getSSEClients(sessionId).size === 0) {
          safeJson(res, 409, { error: "no event stream connected" });
          return;
        }

        if (state.workspaceRoot !== session.workspaceRoot || state.currentSessionId !== sessionId) {
          state.currentSessionId = sessionId;
          state.workspaceRoot = session.workspaceRoot;
          setWorkspaceRoot(session.workspaceRoot);
          agent = await rebuildAgent();
        }

        session.messages.push({ role: "user" as const, content: message });
        safeJson(res, 200, { ok: true });

        activeStreamSessionId = sessionId;

        const controller = new AbortController();
        abortControllerBySession.set(sessionId, controller);
        const abortSignal = controller.signal;

        let responseText = "";
        try {
          for await (const event of agent.stream(session.messages)) {
            if (abortSignal.aborted) {
              writeEvent(sessionId, { type: "aborted", data: {} });
              break;
            }
            if (event.type === "text-delta") {
              const text = (event.data as any)?.text ?? "";
              responseText += text;
              writeEvent(sessionId, { type: "text-delta", data: { text } });
            } else if (event.type === "tool-call") {
              writeEvent(sessionId, { type: "tool-call", data: event.data });
            } else if (event.type === "tool-result") {
              writeEvent(sessionId, { type: "tool-result", data: event.data });
            } else if (event.type === "reasoning") {
              writeEvent(sessionId, { type: "thinking", data: event.data });
            } else if (event.type === "error") {
              writeEvent(sessionId, { type: "error", data: event.data });
            }
          }

          if (responseText) {
            session.messages.push({ role: "assistant" as const, content: responseText });
          }
          writeEvent(sessionId, { type: "complete", data: {} });
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            writeEvent(sessionId, { type: "error", data: { message: e?.message ?? String(e) } });
          }
        } finally {
          abortControllerBySession.delete(sessionId);
          if (activeStreamSessionId === sessionId) activeStreamSessionId = null;
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

      // Bash approval status
      if (req.method === "GET" && url.pathname === "/api/bash/status") {
        const status = await getBashApprovalStatus();
        const pending = await getPendingBashApprovals();
        safeJson(res, 200, {
          yolo: status.yolo,
          allowPrefixes: status.allowPrefixes,
          pending: pending.map((p: { id: string; command: string; workdir: string }) => ({
            id: p.id,
            command: p.command,
            workdir: p.workdir,
          })),
        });
        return;
      }

      // Bash approve command
      if (req.method === "POST" && url.pathname === "/api/bash/approve") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { approvalId?: string };
        const approvalId = body.approvalId;
        if (!approvalId) {
          safeJson(res, 400, { error: "approvalId required" });
          return;
        }
        const result = await approveBashCommandOnce(approvalId);
        safeJson(res, result.ok ? 200 : 400, result);
        return;
      }

      // Bash deny command
      if (req.method === "POST" && url.pathname === "/api/bash/deny") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { approvalId?: string };
        const approvalId = body.approvalId;
        if (!approvalId) {
          safeJson(res, 400, { error: "approvalId required" });
          return;
        }
        const result = await cancelBashApproval(approvalId, "user denied");
        safeJson(res, result.ok ? 200 : 400, result);
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
