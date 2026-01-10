import { baseStyles } from "./base-styles.js";

export function getVibeModeHTML(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Erzencode Vibe</title>
  <style>
    ${baseStyles}
    /* AI SDK Elements Inspired Styles - Vibe Mode */
    :root {
      --vibe-gradient: linear-gradient(135deg, #8b5cf6, #ec4899);
      --reasoning-bg: rgba(139, 92, 246, 0.1);
      --reasoning-border: rgba(139, 92, 246, 0.3);
    }
    
    .app { display: grid; grid-template-columns: 380px 1fr; height: 100vh; }
    
    /* Chat Panel - Left Side */
    .chat-panel { 
      display: flex; flex-direction: column; 
      background: var(--bg-secondary); 
      border-right: 1px solid var(--border);
    }
    
    .chat-header { 
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border);
    }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 17px; }
    .logo-icon { 
      width: 32px; height: 32px; 
      background: var(--vibe-gradient);
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      font-size: 16px; color: white;
    }
    .header-actions { display: flex; gap: 4px; }
    .icon-btn { 
      width: 36px; height: 36px; padding: 0; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; color: var(--text-secondary);
    }
    .icon-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    
    .session-bar { 
      display: flex; align-items: center; gap: 8px;
      padding: 12px 20px; border-bottom: 1px solid var(--border);
      background: var(--bg-tertiary);
    }
    .session-bar select { flex: 1; padding: 8px 10px; font-size: 13px; border-radius: 8px; }
    .session-bar button { padding: 8px 12px; border-radius: 8px; font-size: 13px; }
    
    /* Conversation - AI SDK Conversation */
    .conversation { 
      flex: 1; overflow-y: auto; 
      display: flex; flex-direction: column;
    }
    .conversation-content { 
      padding: 20px; display: flex; flex-direction: column; gap: 20px; 
    }
    
    /* Message - AI SDK Message */
    .message { animation: messageIn 0.3s ease-out; }
    @keyframes messageIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .message-header { 
      display: flex; align-items: center; gap: 8px; 
      margin-bottom: 6px; font-size: 12px;
    }
    .message-avatar { 
      width: 22px; height: 22px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600;
    }
    .message.user .message-avatar { background: var(--accent); color: white; }
    .message.assistant .message-avatar { background: var(--vibe-gradient); color: white; }
    .message-role { font-weight: 500; color: var(--text-secondary); }
    .message-time { color: var(--text-muted); font-size: 11px; }
    .message-content { 
      font-size: 14px; line-height: 1.6; color: var(--text-primary);
      padding-left: 30px;
    }
    .message-content pre { 
      background: var(--bg-primary); border: 1px solid var(--border);
      padding: 12px; border-radius: 8px; margin: 8px 0;
      font-size: 12px; overflow-x: auto;
    }
    .message-content code { 
      background: var(--bg-primary); padding: 2px 5px; 
      border-radius: 4px; font-size: 12px;
    }
    .message-content pre code { background: none; padding: 0; }
    
    /* Reasoning - AI SDK Reasoning */
    .reasoning { 
      background: var(--reasoning-bg); border: 1px solid var(--reasoning-border);
      border-radius: 8px; margin: 6px 0; overflow: hidden;
    }
    .reasoning-trigger { 
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; cursor: pointer; font-size: 12px;
      color: #a78bfa; font-weight: 500;
    }
    .reasoning-trigger:hover { background: rgba(139, 92, 246, 0.05); }
    .reasoning-icon { transition: transform 0.2s; font-size: 10px; }
    .reasoning.open .reasoning-icon { transform: rotate(90deg); }
    .reasoning-content { 
      padding: 0 12px 12px; font-size: 12px;
      color: var(--text-secondary); line-height: 1.5; display: none;
    }
    .reasoning.open .reasoning-content { display: block; }
    
    /* Tool Call */
    .tool-call { 
      background: var(--bg-tertiary); border: 1px solid var(--border);
      border-radius: 8px; margin: 6px 0; overflow: hidden; font-size: 12px;
    }
    .tool-call.running { border-color: var(--accent); }
    .tool-call.success { border-color: var(--success); }
    .tool-call.error { border-color: var(--error); }
    .tool-header { 
      display: flex; align-items: center; gap: 6px; padding: 8px 12px;
    }
    .tool-name { font-weight: 500; }
    .tool-status { margin-left: auto; color: var(--text-muted); }
    .tool-call.running .tool-status { color: var(--accent); }
    .tool-call.success .tool-status { color: var(--success); }
    .tool-call.error .tool-status { color: var(--error); }
    
    /* Loader - AI SDK Loader */
    .loader { display: flex; gap: 4px; padding: 6px 0; }
    .loader-dot { 
      width: 6px; height: 6px; background: var(--text-muted); border-radius: 50%;
      animation: loaderBounce 1.4s ease-in-out infinite;
    }
    .loader-dot:nth-child(1) { animation-delay: 0s; }
    .loader-dot:nth-child(2) { animation-delay: 0.16s; }
    .loader-dot:nth-child(3) { animation-delay: 0.32s; }
    @keyframes loaderBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    
    /* PromptInput - AI SDK PromptInput */
    .prompt-container { padding: 16px 20px; border-top: 1px solid var(--border); }
    .prompt-input { 
      background: var(--bg-primary); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .prompt-input:focus-within { 
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
    .prompt-textarea { 
      width: 100%; min-height: 80px; max-height: 160px;
      padding: 14px 16px; resize: none;
      background: transparent; border: none;
      font-size: 14px; line-height: 1.5;
    }
    .prompt-textarea::placeholder { color: var(--text-muted); }
    .prompt-textarea:focus { outline: none; }
    .prompt-footer { 
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-top: 1px solid var(--border);
      background: var(--bg-tertiary);
    }
    .prompt-submit { 
      padding: 8px 16px; border-radius: 8px;
      background: var(--vibe-gradient); color: white;
      font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 6px;
    }
    .prompt-submit:hover:not(:disabled) { opacity: 0.9; }
    .prompt-stop { 
      padding: 8px 16px; border-radius: 8px;
      background: var(--error); color: white;
      font-size: 13px; display: none;
    }
    .prompt-stop.visible { display: flex; }
    
    /* Welcome State */
    .welcome { 
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 32px; text-align: center;
    }
    .welcome h2 { font-size: 20px; margin-bottom: 8px; }
    .welcome p { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }
    .welcome-suggestions { display: flex; flex-direction: column; gap: 8px; width: 100%; }
    .suggestion-btn { 
      padding: 14px 16px; background: var(--bg-primary);
      border: 1px solid var(--border); border-radius: 10px;
      text-align: left; font-size: 13px;
    }
    .suggestion-btn:hover { border-color: #8b5cf6; background: var(--bg-tertiary); }
    .suggestion-title { font-weight: 500; margin-bottom: 2px; }
    .suggestion-desc { font-size: 12px; color: var(--text-muted); }
    
    /* Right Panel */
    .right-panel { display: flex; flex-direction: column; background: var(--bg-primary); }
    
    /* Tabs */
    .tabs { 
      display: flex; align-items: center; gap: 4px;
      padding: 10px 16px; background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    .tab { 
      padding: 8px 14px; border-radius: 8px; font-size: 13px;
      color: var(--text-secondary); display: flex; align-items: center; gap: 6px;
    }
    .tab:hover { color: var(--text-primary); background: var(--bg-tertiary); }
    .tab.active { color: var(--text-primary); background: var(--bg-primary); }
    .tabs-spacer { flex: 1; }
    .tabs-right { display: flex; gap: 8px; }
    .tabs-right select { padding: 6px 10px; font-size: 12px; border-radius: 6px; }
    
    /* Content Area */
    .content-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .code-view, .preview-view { flex: 1; display: none; flex-direction: column; }
    .code-view.active, .preview-view.active { display: flex; }
    
    /* File Tabs */
    .file-tabs { 
      display: flex; gap: 2px; padding: 8px 16px;
      background: var(--bg-secondary); border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .file-tab { 
      padding: 6px 12px; border-radius: 6px; font-size: 12px;
      color: var(--text-secondary); white-space: nowrap;
    }
    .file-tab:hover { background: var(--bg-tertiary); }
    .file-tab.active { background: var(--bg-primary); color: var(--text-primary); }
    
    /* Code Content */
    .code-content { 
      flex: 1; overflow: auto; padding: 16px;
      font-family: 'SF Mono', Monaco, monospace; font-size: 13px;
      line-height: 1.5; background: var(--code-bg);
    }
    .placeholder { 
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: var(--text-muted); gap: 12px;
    }
    .placeholder-icon { 
      width: 48px; height: 48px; background: var(--bg-tertiary);
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    
    /* Preview */
    .preview-frame { flex: 1; background: white; border: none; }
    
    /* Terminal */
    .terminal { 
      height: 200px; border-top: 1px solid var(--border);
      background: var(--bg-primary); display: flex; flex-direction: column;
    }
    .terminal.collapsed { height: 36px; }
    .terminal-header { 
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; background: var(--bg-secondary);
      border-bottom: 1px solid var(--border); cursor: pointer;
    }
    .terminal-header:hover { background: var(--bg-tertiary); }
    .terminal-tabs { display: flex; gap: 4px; flex: 1; }
    .terminal-tab { 
      padding: 4px 10px; border-radius: 6px; font-size: 11px;
      color: var(--text-secondary); cursor: pointer;
    }
    .terminal-tab.active { background: var(--bg-primary); color: var(--text-primary); }
    .terminal-add { padding: 4px 8px; color: var(--text-muted); }
    .terminal-toggle { padding: 4px 8px; color: var(--text-muted); }
    .terminal-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .terminal.collapsed .terminal-body { display: none; }
    .terminal-content { 
      flex: 1; overflow: auto; padding: 10px 16px;
      font-family: 'SF Mono', Monaco, monospace; font-size: 12px;
      line-height: 1.4; background: var(--code-bg);
    }
    .terminal-line { margin-bottom: 2px; white-space: pre-wrap; }
    .terminal-line.cmd { color: var(--success); }
    .terminal-line.output { color: var(--text-secondary); }
    .terminal-line.error { color: var(--error); }
    .terminal-line.info { color: var(--accent); }
    .terminal-input-row { 
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; background: var(--bg-secondary);
      border-top: 1px solid var(--border);
    }
    .terminal.collapsed .terminal-input-row { display: none; }
    .terminal-cwd { font-size: 11px; color: var(--accent); font-family: monospace; }
    .terminal-prompt { color: var(--success); font-family: monospace; }
    .terminal-input { 
      flex: 1; background: transparent; border: none;
      font-family: monospace; font-size: 12px; color: var(--text-primary);
    }
    .terminal-input:focus { outline: none; }
    
    /* Modal */
    .modal-overlay { 
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center; z-index: 100;
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
    }
    .modal-overlay.open { opacity: 1; pointer-events: auto; }
    .modal { 
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 16px; width: 90%; max-width: 420px;
      max-height: 70vh; display: flex; flex-direction: column;
    }
    .modal-header { 
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid var(--border);
    }
    .modal-title { font-weight: 600; font-size: 15px; }
    .modal-close { 
      width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted);
    }
    .modal-close:hover { background: var(--bg-tertiary); }
    .modal-body { flex: 1; overflow-y: auto; padding: 18px; }
    .modal-footer { 
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 18px; border-top: 1px solid var(--border);
    }
    .folder-browser { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .folder-path { 
      display: flex; align-items: center; gap: 6px;
      padding: 10px 12px; background: var(--bg-tertiary);
      font-family: monospace; font-size: 11px;
    }
    .folder-path-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .folder-up { padding: 4px 8px; border-radius: 4px; font-size: 11px; }
    .folder-list { max-height: 260px; overflow-y: auto; }
    .folder-item { 
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; cursor: pointer; font-size: 12px;
    }
    .folder-item:hover { background: var(--bg-tertiary); }
    .folder-icon { color: var(--accent); }
  </style>
</head>
<body>
  <div class="app">
    <div class="chat-panel">
      <header class="chat-header">
        <div class="logo">
          <div class="logo-icon">✨</div>
          <span>Vibe</span>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="themeBtn" title="Toggle theme">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
        </div>
      </header>
      
      <div class="session-bar">
        <select id="sessionSelect"></select>
        <button id="newSessionBtn">+ New</button>
        <button id="folderBtn">📁</button>
      </div>
      
      <div class="conversation" id="conversation">
        <div class="conversation-content" id="conversationContent">
          <div class="welcome" id="welcome">
            <h2>What do you want to build?</h2>
            <p>Describe your idea and I'll help create it.</p>
            <div class="welcome-suggestions">
              <button class="suggestion-btn" data-prompt="Create a landing page for a SaaS product with hero section, features, and pricing">
                <div class="suggestion-title">🚀 Landing Page</div>
                <div class="suggestion-desc">Modern SaaS website with hero, features, pricing</div>
              </button>
              <button class="suggestion-btn" data-prompt="Build a todo app with React, local storage, and drag-and-drop">
                <div class="suggestion-title">✅ Todo App</div>
                <div class="suggestion-desc">Task management with drag and drop</div>
              </button>
              <button class="suggestion-btn" data-prompt="Create a dashboard with charts, stats cards, and a data table">
                <div class="suggestion-title">📊 Dashboard</div>
                <div class="suggestion-desc">Analytics view with charts and tables</div>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="prompt-container">
        <div class="prompt-input">
          <textarea class="prompt-textarea" id="promptTextarea" placeholder="Describe what you want to build..."></textarea>
          <div class="prompt-footer">
            <div></div>
            <div style="display: flex; gap: 8px;">
              <button class="prompt-stop" id="stopBtn">⬛ Stop</button>
              <button class="prompt-submit" id="submitBtn">Generate →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="right-panel">
      <div class="tabs">
        <button class="tab active" data-tab="code">💻 Code</button>
        <button class="tab" data-tab="preview">▶ Preview</button>
        <div class="tabs-spacer"></div>
        <div class="tabs-right">
          <select id="providerSelect"></select>
          <select id="modelSelect"></select>
        </div>
      </div>
      
      <div class="content-area">
        <div class="code-view active" id="codeView">
          <div class="file-tabs" id="fileTabs"></div>
          <div class="code-content" id="codeContent">
            <div class="placeholder">
              <div class="placeholder-icon">💻</div>
              <p>Code appears here as you build</p>
            </div>
          </div>
        </div>
        <div class="preview-view" id="previewView">
          <div class="placeholder" id="previewPlaceholder">
            <div class="placeholder-icon">▶</div>
            <p>Preview appears here</p>
          </div>
          <iframe class="preview-frame" id="previewFrame" style="display:none;"></iframe>
        </div>
      </div>
      
      <div class="terminal" id="terminal">
        <div class="terminal-header" id="terminalHeader">
          <div class="terminal-tabs" id="terminalTabs"></div>
          <button class="terminal-add" id="addTerminalBtn">+</button>
          <button class="terminal-toggle" id="terminalToggle">▲</button>
        </div>
        <div class="terminal-body">
          <div class="terminal-content" id="terminalContent"></div>
          <div class="terminal-input-row">
            <span class="terminal-cwd" id="terminalCwd">~</span>
            <span class="terminal-prompt">$</span>
            <input type="text" class="terminal-input" id="terminalInput" placeholder="command...">
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="modal-overlay" id="folderModal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Select Folder</span>
        <button class="modal-close" id="closeFolderModal">✕</button>
      </div>
      <div class="modal-body">
        <div class="folder-browser">
          <div class="folder-path">
            <span class="folder-path-text" id="browserPath">~</span>
            <button class="folder-up" id="folderUpBtn">↑</button>
          </div>
          <div class="folder-list" id="folderList"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelFolderBtn">Cancel</button>
        <button class="btn btn-primary" id="selectFolderBtn">Select</button>
      </div>
    </div>
  </div>

<script>
const $ = id => document.getElementById(id);
const conversation = $('conversation');
const conversationContent = $('conversationContent');
const welcome = $('welcome');
const promptTextarea = $('promptTextarea');
const submitBtn = $('submitBtn');
const stopBtn = $('stopBtn');
const codeView = $('codeView');
const previewView = $('previewView');
const codeContent = $('codeContent');
const fileTabs = $('fileTabs');
const terminal = $('terminal');
const terminalContent = $('terminalContent');
const terminalInput = $('terminalInput');
const terminalCwd = $('terminalCwd');
const terminalTabs = $('terminalTabs');
const providerSelect = $('providerSelect');
const modelSelect = $('modelSelect');
const sessionSelect = $('sessionSelect');
const folderModal = $('folderModal');
const browserPath = $('browserPath');
const folderList = $('folderList');
const themeBtn = $('themeBtn');

let state = {
  isRunning: false,
  currentContentEl: null,
  messageCount: 0,
  currentPath: '',
  terminals: [],
  activeTerminalId: null,
  files: new Map(),
  activeFile: null,
  pendingTools: new Map(),
  cmdHistory: [],
  cmdHistoryIdx: -1,
  textBuffer: ''
};

// Theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeBtn.onclick = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};

// Tabs
document.querySelectorAll('.tabs .tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    codeView.classList.toggle('active', tab.dataset.tab === 'code');
    previewView.classList.toggle('active', tab.dataset.tab === 'preview');
  };
});

// Terminal toggle
$('terminalHeader').onclick = e => {
  if (e.target.closest('.terminal-tab') || e.target.closest('.terminal-add')) return;
  terminal.classList.toggle('collapsed');
  $('terminalToggle').textContent = terminal.classList.contains('collapsed') ? '▼' : '▲';
};

function setRunning(running) {
  state.isRunning = running;
  submitBtn.disabled = running;
  submitBtn.style.display = running ? 'none' : 'flex';
  stopBtn.classList.toggle('visible', running);
}

function formatText(text) {
  return text
    .replace(/\`\`\`(\\w*)?\\n?([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
    .replace(/\\n/g, '<br>');
}

function addUserMessage(text) {
  if (state.messageCount === 0) welcome.style.display = 'none';
  state.messageCount++;
  
  const msg = document.createElement('div');
  msg.className = 'message user';
  msg.innerHTML = \`
    <div class="message-header">
      <div class="message-avatar">U</div>
      <span class="message-role">You</span>
      <span class="message-time">\${new Date().toLocaleTimeString()}</span>
    </div>
    <div class="message-content">\${formatText(text)}</div>
  \`;
  conversationContent.appendChild(msg);
  conversation.scrollTop = conversation.scrollHeight;
}

function startAssistantMessage() {
  if (state.messageCount === 0) welcome.style.display = 'none';
  state.messageCount++;
  
  const msg = document.createElement('div');
  msg.className = 'message assistant';
  msg.innerHTML = \`
    <div class="message-header">
      <div class="message-avatar">A</div>
      <span class="message-role">Assistant</span>
      <span class="message-time">\${new Date().toLocaleTimeString()}</span>
    </div>
    <div class="message-content">
      <div class="loader"><div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div></div>
    </div>
  \`;
  conversationContent.appendChild(msg);
  conversation.scrollTop = conversation.scrollHeight;
  state.currentContentEl = msg.querySelector('.message-content');
  state.textBuffer = '';
}

function addReasoning(text) {
  if (!state.currentContentEl) return;
  const loader = state.currentContentEl.querySelector('.loader');
  if (loader) loader.remove();
  
  const r = document.createElement('div');
  r.className = 'reasoning';
  r.innerHTML = \`
    <div class="reasoning-trigger"><span class="reasoning-icon">▶</span> 💭 Thinking...</div>
    <div class="reasoning-content">\${text.replace(/\\n/g, '<br>')}</div>
  \`;
  r.querySelector('.reasoning-trigger').onclick = () => r.classList.toggle('open');
  state.currentContentEl.appendChild(r);
  conversation.scrollTop = conversation.scrollHeight;
}

function addToolCall(toolId, toolName) {
  if (!state.currentContentEl) return;
  const loader = state.currentContentEl.querySelector('.loader');
  if (loader) loader.remove();
  
  const t = document.createElement('div');
  t.className = 'tool-call running';
  t.id = 'tool-' + toolId;
  t.innerHTML = '<div class="tool-header"><span>🔧</span><span class="tool-name">' + toolName + '</span><span class="tool-status">running...</span></div>';
  state.currentContentEl.appendChild(t);
  state.pendingTools.set(toolId, t);
  conversation.scrollTop = conversation.scrollHeight;
}

function updateToolResult(toolId, isError) {
  const t = state.pendingTools.get(toolId) || document.getElementById('tool-' + toolId);
  if (t) {
    t.className = 'tool-call ' + (isError ? 'error' : 'success');
    t.querySelector('.tool-status').textContent = isError ? '✗ failed' : '✓ done';
    state.pendingTools.delete(toolId);
  }
}

function updateTextContent(text) {
  if (!state.currentContentEl) return;
  const loader = state.currentContentEl.querySelector('.loader');
  if (loader) loader.remove();
  
  let el = state.currentContentEl.querySelector('.text-content');
  if (!el) {
    el = document.createElement('div');
    el.className = 'text-content';
    state.currentContentEl.appendChild(el);
  }
  el.innerHTML = formatText(text);
  conversation.scrollTop = conversation.scrollHeight;
  
  // Extract code for code view
  const match = text.match(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\`/);
  if (match) {
    const lang = match[1] || 'code';
    const code = match[2];
    const name = lang === 'tsx' || lang === 'jsx' ? 'App.' + lang : 'main.' + (lang || 'txt');
    updateFile(name, code);
  }
}

function updateFile(name, content) {
  state.files.set(name, content);
  renderFileTabs();
  if (!state.activeFile) selectFile(name);
}

function renderFileTabs() {
  fileTabs.innerHTML = '';
  state.files.forEach((_, name) => {
    const tab = document.createElement('button');
    tab.className = 'file-tab' + (state.activeFile === name ? ' active' : '');
    tab.textContent = name;
    tab.onclick = () => selectFile(name);
    fileTabs.appendChild(tab);
  });
}

function selectFile(name) {
  state.activeFile = name;
  const content = state.files.get(name) || '';
  codeContent.innerHTML = '<pre style="margin:0;">' + escapeHtml(content) + '</pre>';
  renderFileTabs();
}

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function addTerminalLine(text, type = '') {
  const line = document.createElement('div');
  line.className = 'terminal-line' + (type ? ' ' + type : '');
  line.textContent = text;
  terminalContent.appendChild(line);
  terminalContent.scrollTop = terminalContent.scrollHeight;
}

async function sendMessage() {
  const text = promptTextarea.value.trim();
  if (!text || state.isRunning) return;
  promptTextarea.value = '';
  addUserMessage(text);
  setRunning(true);
  startAssistantMessage();
  try {
    await fetch('/api/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
  } catch (e) {
    updateTextContent('Error: ' + e.message);
    setRunning(false);
  }
}

async function stopGeneration() {
  try { await fetch('/api/abort', { method: 'POST' }); } catch {}
}

promptTextarea.onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
};
submitBtn.onclick = sendMessage;
stopBtn.onclick = stopGeneration;

document.querySelectorAll('.suggestion-btn').forEach(btn => {
  btn.onclick = () => { promptTextarea.value = btn.dataset.prompt; promptTextarea.focus(); };
});

// Terminal
terminalInput.onkeydown = async e => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (state.cmdHistoryIdx < state.cmdHistory.length - 1) {
      state.cmdHistoryIdx++;
      terminalInput.value = state.cmdHistory[state.cmdHistory.length - 1 - state.cmdHistoryIdx] || '';
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (state.cmdHistoryIdx > 0) {
      state.cmdHistoryIdx--;
      terminalInput.value = state.cmdHistory[state.cmdHistory.length - 1 - state.cmdHistoryIdx] || '';
    } else { state.cmdHistoryIdx = -1; terminalInput.value = ''; }
    return;
  }
  if (e.key === 'Enter') {
    const cmd = terminalInput.value.trim();
    if (!cmd) return;
    state.cmdHistory.push(cmd);
    state.cmdHistoryIdx = -1;
    addTerminalLine(terminalCwd.textContent + ' $ ' + cmd, 'cmd');
    terminalInput.value = '';
    if (cmd === 'clear' || cmd === 'cls') { terminalContent.innerHTML = ''; return; }
    try {
      const res = await fetch('/api/terminal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: cmd, terminalId: state.activeTerminalId }) });
      const data = await res.json();
      if (data.output) data.output.split('\\n').forEach(l => { if (l.trim()) addTerminalLine(l, 'output'); });
      if (data.error) addTerminalLine(data.error, 'error');
      if (data.cwd) terminalCwd.textContent = data.cwd.replace(/^\\/Users\\/[^\\/]+/, '~');
    } catch (e) { addTerminalLine('Error: ' + e.message, 'error'); }
  }
};

// Folder browser
$('folderBtn').onclick = () => { folderModal.classList.add('open'); loadFolder(state.currentPath || ''); };
$('closeFolderModal').onclick = () => folderModal.classList.remove('open');
$('cancelFolderBtn').onclick = () => folderModal.classList.remove('open');
$('folderUpBtn').onclick = () => { if (browserPath.dataset.parent) loadFolder(browserPath.dataset.parent); };
$('selectFolderBtn').onclick = async () => {
  const path = browserPath.dataset.path;
  if (!path) return;
  try {
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceRoot: path }) });
    state.currentPath = path;
    folderModal.classList.remove('open');
    terminalCwd.textContent = path.replace(/^\\/Users\\/[^\\/]+/, '~');
    addTerminalLine('Workspace: ' + path, 'info');
  } catch (e) { addTerminalLine('Error: ' + e.message, 'error'); }
};

async function loadFolder(path) {
  try {
    const res = await fetch('/api/browse?path=' + encodeURIComponent(path));
    const data = await res.json();
    browserPath.textContent = data.path.replace(/^\\/Users\\/[^\\/]+/, '~');
    browserPath.dataset.path = data.path;
    browserPath.dataset.parent = data.parent || '';
    folderList.innerHTML = '';
    data.entries.filter(e => e.type === 'directory').forEach(entry => {
      const el = document.createElement('div');
      el.className = 'folder-item';
      el.innerHTML = '<span class="folder-icon">📁</span><span>' + entry.name + '</span>';
      el.onclick = () => loadFolder(data.path + '/' + entry.name);
      folderList.appendChild(el);
    });
  } catch (e) { console.error(e); }
}

async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    const data = await res.json();
    providerSelect.innerHTML = data.providers.map(p => '<option value="' + p.id + '"' + (p.hasKey ? '' : ' disabled') + '>' + p.name + '</option>').join('');
  } catch (e) { console.error(e); }
}

async function loadModels(provider) {
  try {
    const res = await fetch('/api/models?provider=' + provider);
    const data = await res.json();
    modelSelect.innerHTML = data.models.map(m => '<option value="' + m + '"' + (m === data.currentModel ? ' selected' : '') + '>' + m + '</option>').join('');
  } catch (e) { console.error(e); }
}

providerSelect.onchange = async () => {
  await loadModels(providerSelect.value);
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: providerSelect.value, model: modelSelect.value }) });
};
modelSelect.onchange = async () => {
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelSelect.value }) });
};

async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    sessionSelect.innerHTML = data.sessions.map(s => '<option value="' + s.id + '"' + (s.id === data.currentSessionId ? ' selected' : '') + '>' + s.name + '</option>').join('');
  } catch (e) { console.error(e); }
}

sessionSelect.onchange = async () => {
  await fetch('/api/sessions/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sessionSelect.value }) });
  conversationContent.innerHTML = '';
  state.messageCount = 0;
  welcome.style.display = 'flex';
  conversationContent.appendChild(welcome);
  state.files.clear(); state.activeFile = null;
  codeContent.innerHTML = '<div class="placeholder"><div class="placeholder-icon">💻</div><p>Code appears here</p></div>';
  fileTabs.innerHTML = '';
  await loadConfig();
};

$('newSessionBtn').onclick = async () => {
  folderModal.classList.add('open');
  $('selectFolderBtn').onclick = async () => {
    const path = browserPath.dataset.path;
    if (!path) return;
    try {
      await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceRoot: path }) });
      folderModal.classList.remove('open');
      await loadSessions();
      conversationContent.innerHTML = '';
      state.messageCount = 0;
      welcome.style.display = 'flex';
      conversationContent.appendChild(welcome);
      state.currentPath = path;
      terminalCwd.textContent = path.replace(/^\\/Users\\/[^\\/]+/, '~');
    } catch (e) { addTerminalLine('Error: ' + e.message, 'error'); }
  };
};

async function loadTerminals() {
  try {
    const res = await fetch('/api/terminals');
    const data = await res.json();
    state.terminals = data.terminals;
    terminalTabs.innerHTML = state.terminals.map(t => '<div class="terminal-tab' + (t.id === state.activeTerminalId ? ' active' : '') + '" data-id="' + t.id + '">' + t.name + '</div>').join('');
    terminalTabs.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.onclick = e => { e.stopPropagation(); state.activeTerminalId = tab.dataset.id; loadTerminals(); terminalContent.innerHTML = ''; };
    });
    if (!state.activeTerminalId && data.terminals.length > 0) state.activeTerminalId = data.terminals[0].id;
  } catch (e) { console.error(e); }
}

$('addTerminalBtn').onclick = async e => {
  e.stopPropagation();
  try {
    const res = await fetch('/api/terminals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    state.activeTerminalId = data.terminal.id;
    await loadTerminals();
    terminalContent.innerHTML = '';
  } catch (e) { console.error(e); }
};

// SSE
const es = new EventSource('/api/events');
es.onmessage = ev => {
  try {
    const event = JSON.parse(ev.data);
    if (event.type === 'text-delta') {
      state.textBuffer += event.data?.text || '';
      updateTextContent(state.textBuffer);
      return;
    }
    if (event.type === 'thinking') { addReasoning(event.data?.text || 'Thinking...'); return; }
    if (event.type === 'tool-call') { addToolCall(event.data?.toolCallId || Date.now(), event.data?.toolName || 'tool'); return; }
    if (event.type === 'tool-result') { updateToolResult(event.data?.toolCallId, event.data?.isError); return; }
    if (event.type === 'complete' || event.type === 'aborted') {
      state.textBuffer = ''; state.currentContentEl = null; state.pendingTools.clear(); setRunning(false); return;
    }
    if (event.type === 'error') {
      updateTextContent('Error: ' + (event.data?.message || 'Unknown')); state.textBuffer = ''; setRunning(false); return;
    }
  } catch (e) { console.error('SSE error:', e); }
};

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    state.currentPath = cfg.workspaceRoot;
    terminalCwd.textContent = (cfg.workspaceRoot || '~').replace(/^\\/Users\\/[^\\/]+/, '~');
    providerSelect.value = cfg.provider;
    await loadModels(cfg.provider);
  } catch (e) { console.error(e); }
}

(async () => {
  await loadProviders();
  await loadConfig();
  await loadSessions();
  await loadTerminals();
  addTerminalLine('Terminal ready.', 'info');
})();
</script>
</body>
</html>`;
}
