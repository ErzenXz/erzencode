import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { createAIAgent, type AgentConfig, type AgentMode } from "./ai-agent.js";
import { setWorkspaceRoot } from "./tools-standalone.js";
import type { ProviderType } from "./ai-provider.js";

type WebUIState = {
  workspaceRoot: string;
  provider: ProviderType;
  model: string;
  mode: AgentMode;
};

export type WebUIHandle = {
  url: string;
  close: () => Promise<void>;
};

function safeJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    let buf = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      buf += chunk;
    });
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}

function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    // ignore
  }
}

function html(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>erzencode web</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0d10;
      --panel: #0f1318;
      --border: #222a34;
      --text: #e6edf3;
      --muted: #9aa4b2;
      --accent: #22d3ee;
      --good: #22c55e;
      --warn: #fbbf24;
      --bad: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      background: var(--bg);
      color: var(--text);
    }
    header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(34,211,238,0.08), rgba(34,211,238,0));
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    header .title { font-weight: 700; letter-spacing: 0.4px; }
    header .meta { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    main {
      display: grid;
      grid-template-columns: 320px 1fr;
      height: calc(100vh - 56px);
    }
    aside {
      border-right: 1px solid var(--border);
      background: var(--panel);
      padding: 14px;
      overflow: auto;
    }
    .field { margin-bottom: 12px; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    input, select {
      width: 100%;
      padding: 10px 10px;
      border: 1px solid var(--border);
      background: #0b0d10;
      color: var(--text);
      border-radius: 10px;
      outline: none;
    }
    button {
      width: 100%;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: rgba(34,211,238,0.12);
      color: var(--text);
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: rgba(34,211,238,0.18); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .hint { font-size: 12px; color: var(--muted); line-height: 1.4; }

    section {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    #log {
      flex: 1;
      overflow: auto;
      padding: 14px;
    }
    .msg { padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,0.02); margin-bottom: 10px; }
    .msg .role { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .msg.user { border-color: rgba(34,197,94,0.25); }
    .msg.assistant { border-color: rgba(34,211,238,0.22); }
    .msg.system { border-color: rgba(251,191,36,0.18); }
    .msg pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }

    #composer {
      padding: 12px;
      border-top: 1px solid var(--border);
      background: var(--panel);
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #input { flex: 1; }
    #send { width: 110px; }
  </style>
</head>
<body>
  <header>
    <div class="title">erzencode web</div>
    <div class="meta" id="meta">connecting…</div>
  </header>
  <main>
    <aside>
      <div class="field">
        <label>Workspace folder</label>
        <input id="workspace" placeholder="/path/to/project" />
        <div class="hint" style="margin-top:6px;">Set the workspace root used by tools like file reads/search and command execution.</div>
      </div>
      <div class="field">
        <label>Mode</label>
        <select id="mode">
          <option value="agent">agent</option>
          <option value="ask">ask</option>
          <option value="plan">plan</option>
        </select>
      </div>
      <div class="field">
        <button id="apply">Apply settings</button>
      </div>
      <div class="hint">Streaming events render into the chat. This UI is intentionally lightweight.</div>
    </aside>
    <section>
      <div id="log"></div>
      <div id="composer">
        <input id="input" placeholder="Ask…" />
        <button id="send">Send</button>
      </div>
    </section>
  </main>

<script>
  const log = document.getElementById('log');
  const meta = document.getElementById('meta');
  const workspace = document.getElementById('workspace');
  const mode = document.getElementById('mode');
  const apply = document.getElementById('apply');
  const input = document.getElementById('input');
  const send = document.getElementById('send');

  let isRunning = false;

  function add(role, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    const r = document.createElement('div');
    r.className = 'role';
    r.textContent = role;
    const pre = document.createElement('pre');
    pre.textContent = text;
    el.appendChild(r);
    el.appendChild(pre);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  async function api(path, init) {
    const res = await fetch(path, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || ('HTTP ' + res.status));
    }
    return json;
  }

  async function refresh() {
    const cfg = await api('/api/config');
    meta.textContent = cfg.provider + ' • ' + cfg.model + ' • ' + cfg.mode + ' • ' + cfg.workspaceRoot;
    workspace.value = cfg.workspaceRoot;
    mode.value = cfg.mode;
  }

  apply.addEventListener('click', async () => {
    try {
      apply.disabled = true;
      await api('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceRoot: workspace.value, mode: mode.value })
      });
      await refresh();
      add('system', 'Settings updated');
    } catch (e) {
      add('system', String(e?.message || e));
    } finally {
      apply.disabled = false;
    }
  });

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isRunning) return;
    input.value = '';
    add('user', text);
    isRunning = true;
    send.disabled = true;
    try {
      await api('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
    } catch (e) {
      add('system', String(e?.message || e));
      isRunning = false;
      send.disabled = false;
    }
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  const es = new EventSource('/api/events');
  let assistantBuf = '';
  es.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data);
      if (event.type === 'chunk') {
        const t = event.data?.text || '';
        assistantBuf += t;
        return;
      }
      if (event.type === 'complete') {
        if (assistantBuf.trim()) add('assistant', assistantBuf);
        assistantBuf = '';
        isRunning = false;
        send.disabled = false;
        return;
      }
      if (event.type === 'error') {
        add('system', event.data?.message || 'error');
        assistantBuf = '';
        isRunning = false;
        send.disabled = false;
        return;
      }
      if (event.type === 'thinking') {
        add('system', event.data?.text || 'thinking');
        return;
      }
      if (event.type === 'tool-call') {
        add('system', 'tool: ' + (event.data?.toolName || 'tool'));
        return;
      }
      if (event.type === 'tool-result') {
        add('system', 'tool result: ' + (event.data?.toolResult?.toolName || 'tool'));
        return;
      }
      if (event.type === 'step') {
        const st = event.data?.type;
        const content = event.data?.content;
        if (st && content) add('system', st + ': ' + content);
        return;
      }
    } catch (e) {
      add('system', 'Bad event');
    }
  };
  es.onerror = () => {
    add('system', 'Disconnected');
  };

  refresh().catch(() => {});
</script>
</body>
</html>`;
}

export async function startWebUI(options: {
  baseConfig: AgentConfig;
  initialWorkspaceRoot: string;
  provider: ProviderType;
  model: string;
  mode: AgentMode;
  openBrowser?: boolean;
}): Promise<WebUIHandle> {
  const state: WebUIState = {
    workspaceRoot: options.initialWorkspaceRoot,
    provider: options.provider,
    model: options.model,
    mode: options.mode,
  };

  let agent = createAIAgent({
    ...options.baseConfig,
    provider: state.provider,
    model: state.model,
    mode: state.mode,
    workspaceRoot: state.workspaceRoot,
  });
  setWorkspaceRoot(state.workspaceRoot);

  let messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  let sseRes: http.ServerResponse | null = null;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

      if (req.method === "GET" && url.pathname === "/") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html());
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/config") {
        safeJson(res, 200, {
          workspaceRoot: state.workspaceRoot,
          provider: state.provider,
          model: state.model,
          mode: state.mode,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/config") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { workspaceRoot?: string; mode?: AgentMode };

        if (body.workspaceRoot) {
          const candidate = path.resolve(body.workspaceRoot);
          const st = await fs.stat(candidate);
          if (!st.isDirectory()) {
            safeJson(res, 400, { error: "workspaceRoot must be a directory" });
            return;
          }
          state.workspaceRoot = candidate;
          setWorkspaceRoot(candidate);
        }

        if (body.mode && (body.mode === "agent" || body.mode === "ask" || body.mode === "plan")) {
          state.mode = body.mode;
        }

        agent = createAIAgent({
          ...options.baseConfig,
          provider: state.provider,
          model: state.model,
          mode: state.mode,
          workspaceRoot: state.workspaceRoot,
        });
        messages = []; // Reset messages on config change

        safeJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/events") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.write("retry: 1000\n\n");
        sseRes = res;

        const keepAlive = setInterval(() => {
          try {
            res.write(`event: ping\ndata: {}\n\n`);
          } catch {
            // ignore
          }
        }, 15000);

        req.on("close", () => {
          clearInterval(keepAlive);
          if (sseRes === res) sseRes = null;
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/message") {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}") as { message?: string };
        const message = (body.message ?? "").trim();
        if (!message) {
          safeJson(res, 400, { error: "message required" });
          return;
        }

        if (!sseRes) {
          safeJson(res, 409, { error: "no event stream connected" });
          return;
        }

        messages.push({ role: "user" as const, content: message });

        safeJson(res, 200, { ok: true });

        const writeEvent = (event: unknown) => {
          try {
            sseRes?.write(`data: ${JSON.stringify(event)}\n\n`);
          } catch {
            // ignore
          }
        };

        let responseText = "";
        try {
          for await (const event of agent.stream(messages)) {
            writeEvent(event);
            if (event.type === "text-delta" && event.data?.text) {
              responseText += event.data.text;
            }
          }
          if (responseText) {
            messages.push({ role: "assistant" as const, content: responseText });
          }
          writeEvent({ type: "complete", data: {} });
        } catch (e: any) {
          writeEvent({ type: "error", data: { message: e?.message ?? String(e) } });
        }

        return;
      }

      safeJson(res, 404, { error: "not found" });
    } catch (e: any) {
      safeJson(res, 500, { error: e?.message ?? String(e) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
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
