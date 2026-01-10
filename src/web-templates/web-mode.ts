import { baseStyles } from "./base-styles.js";

export function getWebModeHTML(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Erzencode</title>
  <style>
    ${baseStyles}
    /* AI SDK Elements Inspired Styles */
    :root {
      --conversation-bg: var(--bg-primary);
      --message-user-bg: var(--accent);
      --message-assistant-bg: var(--bg-secondary);
      --prompt-bg: var(--bg-secondary);
      --prompt-border: var(--border);
      --reasoning-bg: rgba(139, 92, 246, 0.1);
      --reasoning-border: rgba(139, 92, 246, 0.3);
      --tool-bg: var(--bg-tertiary);
      --tool-border: var(--border);
    }
    
    .app { display: flex; flex-direction: column; height: 100vh; background: var(--conversation-bg); }
    
    /* Header - AI SDK style */
    .header { 
      display: flex; align-items: center; justify-content: space-between; 
      padding: 12px 24px; border-bottom: 1px solid var(--border); 
      background: var(--bg-secondary); backdrop-filter: blur(8px);
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 16px; }
    .logo-icon { 
      width: 32px; height: 32px; 
      background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
      border-radius: 8px; display: flex; align-items: center; justify-content: center; 
      font-size: 16px; color: white; 
    }
    .header-select { 
      padding: 8px 12px; font-size: 13px; border-radius: 8px; 
      background: var(--bg-primary); border: 1px solid var(--border);
      min-width: 120px; cursor: pointer;
    }
    .header-btn { 
      padding: 8px 12px; border-radius: 8px; font-size: 13px; 
      display: flex; align-items: center; gap: 6px;
      background: var(--bg-primary); border: 1px solid var(--border);
    }
    .header-btn:hover { background: var(--bg-tertiary); }
    .icon-btn { width: 36px; height: 36px; padding: 0; border-radius: 8px; }
    
    /* Conversation Container - AI SDK Conversation component */
    .conversation { 
      flex: 1; overflow-y: auto; 
      display: flex; flex-direction: column;
      scroll-behavior: smooth;
    }
    .conversation-content { 
      max-width: 768px; width: 100%; margin: 0 auto; 
      padding: 24px; display: flex; flex-direction: column; gap: 24px;
    }
    
    /* Message - AI SDK Message component */
    .message { 
      display: flex; flex-direction: column; gap: 8px;
      animation: messageIn 0.3s ease-out;
    }
    @keyframes messageIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .message-header { 
      display: flex; align-items: center; gap: 8px; 
      font-size: 13px; font-weight: 500;
    }
    .message-avatar { 
      width: 24px; height: 24px; border-radius: 6px; 
      display: flex; align-items: center; justify-content: center; 
      font-size: 11px; font-weight: 600;
    }
    .message.user .message-avatar { background: var(--accent); color: white; }
    .message.assistant .message-avatar { background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; }
    .message-role { color: var(--text-secondary); }
    .message-content { 
      padding-left: 32px;
      font-size: 14px; line-height: 1.6; 
      color: var(--text-primary);
    }
    .message-content p { margin: 0 0 12px 0; }
    .message-content p:last-child { margin-bottom: 0; }
    .message-content pre { 
      background: var(--code-bg); 
      border: 1px solid var(--border);
      padding: 16px; border-radius: 8px; 
      overflow-x: auto; margin: 12px 0; 
      font-size: 13px; line-height: 1.5;
    }
    .message-content code { 
      background: var(--code-bg); 
      padding: 2px 6px; border-radius: 4px; 
      font-size: 13px; 
    }
    .message-content pre code { background: none; padding: 0; }
    
    /* Message Actions - AI SDK MessageActions */
    .message-actions { 
      display: flex; gap: 4px; padding-left: 32px; margin-top: 4px;
      opacity: 0; transition: opacity 0.15s;
    }
    .message:hover .message-actions { opacity: 1; }
    .message-action { 
      padding: 6px 10px; border-radius: 6px; font-size: 12px;
      color: var(--text-muted); display: flex; align-items: center; gap: 4px;
      background: transparent; border: 1px solid transparent;
    }
    .message-action:hover { 
      background: var(--bg-tertiary); 
      border-color: var(--border);
      color: var(--text-primary);
    }
    
    /* Reasoning - AI SDK Reasoning component */
    .reasoning { 
      background: var(--reasoning-bg); 
      border: 1px solid var(--reasoning-border);
      border-radius: 8px; margin: 8px 0; overflow: hidden;
    }
    .reasoning-trigger { 
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; cursor: pointer; font-size: 13px;
      color: #a78bfa; font-weight: 500;
    }
    .reasoning-trigger:hover { background: rgba(139, 92, 246, 0.05); }
    .reasoning-icon { transition: transform 0.2s; }
    .reasoning.open .reasoning-icon { transform: rotate(90deg); }
    .reasoning-content { 
      padding: 0 14px 14px 14px; font-size: 13px; 
      color: var(--text-secondary); line-height: 1.5;
      display: none;
    }
    .reasoning.open .reasoning-content { display: block; }
    
    /* Tool Call - styled like AI SDK tool parts */
    .tool-call { 
      background: var(--tool-bg); 
      border: 1px solid var(--tool-border);
      border-radius: 8px; margin: 8px 0; overflow: hidden;
    }
    .tool-call.running { border-color: var(--accent); background: var(--accent-light); }
    .tool-call.success { border-color: var(--success); }
    .tool-call.error { border-color: var(--error); }
    .tool-header { 
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; font-size: 13px;
    }
    .tool-icon { font-size: 14px; }
    .tool-name { font-weight: 500; color: var(--text-primary); }
    .tool-status { margin-left: auto; font-size: 12px; color: var(--text-muted); }
    .tool-call.running .tool-status { color: var(--accent); }
    .tool-call.success .tool-status { color: var(--success); }
    .tool-call.error .tool-status { color: var(--error); }
    .tool-args, .tool-result { 
      padding: 10px 14px; font-size: 12px; 
      font-family: 'SF Mono', Monaco, monospace;
      color: var(--text-secondary); 
      border-top: 1px solid var(--border);
      max-height: 120px; overflow: auto;
      white-space: pre-wrap; word-break: break-all;
    }
    
    /* Loader - AI SDK Loader component */
    .loader { 
      display: flex; align-items: center; gap: 4px; 
      padding: 8px 0;
    }
    .loader-dot { 
      width: 8px; height: 8px; 
      background: var(--text-muted); 
      border-radius: 50%;
      animation: loaderBounce 1.4s ease-in-out infinite;
    }
    .loader-dot:nth-child(1) { animation-delay: 0s; }
    .loader-dot:nth-child(2) { animation-delay: 0.16s; }
    .loader-dot:nth-child(3) { animation-delay: 0.32s; }
    @keyframes loaderBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    
    /* PromptInput - AI SDK PromptInput component */
    .prompt-input-container { 
      border-top: 1px solid var(--border); 
      background: var(--prompt-bg);
      padding: 16px 24px 24px;
    }
    .prompt-input { 
      max-width: 768px; margin: 0 auto;
      background: var(--bg-primary);
      border: 1px solid var(--prompt-border);
      border-radius: 16px;
      overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .prompt-input:focus-within { 
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }
    .prompt-input-body { display: flex; flex-direction: column; }
    .prompt-textarea { 
      width: 100%; min-height: 56px; max-height: 200px; 
      padding: 16px 18px; resize: none;
      background: transparent; border: none;
      font-size: 14px; line-height: 1.5;
      color: var(--text-primary);
    }
    .prompt-textarea::placeholder { color: var(--text-muted); }
    .prompt-textarea:focus { outline: none; box-shadow: none; }
    .prompt-footer { 
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-top: 1px solid var(--border);
      background: var(--bg-tertiary);
    }
    .prompt-tools { display: flex; align-items: center; gap: 4px; }
    .prompt-tool-btn { 
      padding: 6px 10px; border-radius: 6px; font-size: 12px;
      color: var(--text-secondary); display: flex; align-items: center; gap: 4px;
      background: transparent;
    }
    .prompt-tool-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .prompt-tool-btn.active { background: var(--accent-light); color: var(--accent); }
    .prompt-actions { display: flex; align-items: center; gap: 8px; }
    .prompt-submit { 
      padding: 8px 16px; border-radius: 8px;
      background: var(--accent); color: white;
      font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 6px;
    }
    .prompt-submit:hover:not(:disabled) { background: var(--accent-hover); }
    .prompt-submit:disabled { opacity: 0.5; }
    .prompt-stop { 
      padding: 8px 16px; border-radius: 8px;
      background: var(--error); color: white;
      font-size: 13px; font-weight: 500;
      display: none;
    }
    .prompt-stop.visible { display: flex; }
    
    /* Terminal Panel */
    .terminal-panel { 
      height: 220px; border-top: 1px solid var(--border); 
      background: var(--bg-primary); display: flex; flex-direction: column;
    }
    .terminal-panel.collapsed { height: 40px; }
    .terminal-header { 
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; background: var(--bg-secondary);
      border-bottom: 1px solid var(--border); cursor: pointer;
    }
    .terminal-header:hover { background: var(--bg-tertiary); }
    .terminal-tabs { display: flex; gap: 4px; flex: 1; }
    .terminal-tab { 
      padding: 4px 12px; border-radius: 6px; font-size: 12px;
      color: var(--text-secondary); cursor: pointer;
    }
    .terminal-tab.active { background: var(--bg-primary); color: var(--text-primary); }
    .terminal-tab:hover { color: var(--text-primary); }
    .terminal-add { padding: 4px 8px; color: var(--text-muted); font-size: 14px; }
    .terminal-toggle { padding: 4px 8px; color: var(--text-muted); }
    .terminal-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .terminal-panel.collapsed .terminal-body { display: none; }
    .terminal-content { 
      flex: 1; overflow: auto; padding: 12px 16px;
      font-family: 'SF Mono', Monaco, monospace; font-size: 13px; line-height: 1.5;
      background: var(--code-bg);
    }
    .terminal-line { margin-bottom: 2px; white-space: pre-wrap; }
    .terminal-line.cmd { color: var(--success); }
    .terminal-line.output { color: var(--text-secondary); }
    .terminal-line.error { color: var(--error); }
    .terminal-line.info { color: var(--accent); }
    .terminal-input-row { 
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; background: var(--bg-secondary);
      border-top: 1px solid var(--border);
    }
    .terminal-cwd { 
      font-size: 12px; color: var(--accent); 
      font-family: 'SF Mono', Monaco, monospace;
    }
    .terminal-prompt { color: var(--success); font-family: 'SF Mono', Monaco, monospace; }
    .terminal-input { 
      flex: 1; background: transparent; border: none;
      font-family: 'SF Mono', Monaco, monospace; font-size: 13px;
      color: var(--text-primary);
    }
    .terminal-input:focus { outline: none; }
    
    /* Welcome State */
    .welcome { 
      flex: 1; display: flex; flex-direction: column; 
      align-items: center; justify-content: center; 
      padding: 48px 24px; text-align: center;
    }
    .welcome-icon { 
      width: 64px; height: 64px; 
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 16px; display: flex; align-items: center; justify-content: center;
      font-size: 28px; margin-bottom: 24px; color: white;
    }
    .welcome h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .welcome p { color: var(--text-secondary); max-width: 400px; margin-bottom: 32px; }
    .welcome-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 500px; }
    .suggestion { 
      padding: 10px 16px; background: var(--bg-secondary);
      border: 1px solid var(--border); border-radius: 20px;
      font-size: 13px; color: var(--text-secondary);
    }
    .suggestion:hover { border-color: var(--accent); color: var(--text-primary); }
    
    /* Modal */
    .modal-overlay { 
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center; z-index: 100;
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
    }
    .modal-overlay.open { opacity: 1; pointer-events: auto; }
    .modal { 
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 16px; width: 90%; max-width: 480px;
      max-height: 80vh; display: flex; flex-direction: column;
      transform: scale(0.95); transition: transform 0.2s;
    }
    .modal-overlay.open .modal { transform: scale(1); }
    .modal-header { 
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border);
    }
    .modal-title { font-weight: 600; }
    .modal-close { 
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted);
    }
    .modal-close:hover { background: var(--bg-tertiary); }
    .modal-body { flex: 1; overflow-y: auto; padding: 20px; }
    .modal-footer { 
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 16px 20px; border-top: 1px solid var(--border);
    }
    .folder-browser { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .folder-path { 
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; background: var(--bg-tertiary);
      font-family: 'SF Mono', Monaco, monospace; font-size: 12px;
    }
    .folder-path-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .folder-up { padding: 4px 10px; border-radius: 6px; font-size: 12px; }
    .folder-up:hover { background: var(--bg-secondary); }
    .folder-list { max-height: 300px; overflow-y: auto; }
    .folder-item { 
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; cursor: pointer; font-size: 13px;
    }
    .folder-item:hover { background: var(--bg-tertiary); }
    .folder-icon { color: var(--accent); }
  </style>
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="header-left">
        <div class="logo">
          <div class="logo-icon">⚡</div>
          <span>erzencode</span>
        </div>
      </div>
      <div class="header-right">
        <select class="header-select" id="sessionSelect"></select>
        <button class="header-btn" id="newSessionBtn">+ New</button>
        <button class="header-btn" id="folderBtn">📁 <span id="folderName">Folder</span></button>
        <select class="header-select" id="providerSelect"></select>
        <select class="header-select" id="modelSelect"></select>
        <button class="header-btn icon-btn" id="themeBtn" title="Toggle theme">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        </button>
      </div>
    </header>
    
    <div class="conversation" id="conversation">
      <div class="conversation-content" id="conversationContent">
        <div class="welcome" id="welcome">
          <div class="welcome-icon">⚡</div>
          <h1>How can I help you today?</h1>
          <p>Ask me to write code, explain concepts, debug issues, or help with your projects.</p>
          <div class="welcome-suggestions">
            <button class="suggestion" data-prompt="Create a React component for a todo list">Build a todo list</button>
            <button class="suggestion" data-prompt="Help me debug my code">Debug help</button>
            <button class="suggestion" data-prompt="Explain how async/await works in JavaScript">Explain async/await</button>
            <button class="suggestion" data-prompt="Write a REST API endpoint with Express">Write an API</button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="prompt-input-container">
      <div class="prompt-input">
        <div class="prompt-input-body">
          <textarea class="prompt-textarea" id="promptTextarea" placeholder="Ask anything..." rows="1"></textarea>
          <div class="prompt-footer">
            <div class="prompt-tools">
              <button class="prompt-tool-btn" id="modeBtn">🤖 Agent</button>
            </div>
            <div class="prompt-actions">
              <button class="prompt-stop" id="stopBtn">⬛ Stop</button>
              <button class="prompt-submit" id="submitBtn">
                Send <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="terminal-panel" id="terminalPanel">
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
          <input type="text" class="terminal-input" id="terminalInput" placeholder="Enter command...">
        </div>
      </div>
    </div>
  </div>
  
  <div class="modal-overlay" id="folderModal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Select Project Folder</span>
        <button class="modal-close" id="closeFolderModal">✕</button>
      </div>
      <div class="modal-body">
        <div class="folder-browser">
          <div class="folder-path">
            <span class="folder-path-text" id="browserPath">~</span>
            <button class="folder-up" id="folderUpBtn">↑ Up</button>
          </div>
          <div class="folder-list" id="folderList"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelFolderBtn">Cancel</button>
        <button class="btn btn-primary" id="selectFolderBtn">Select Folder</button>
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
const providerSelect = $('providerSelect');
const modelSelect = $('modelSelect');
const sessionSelect = $('sessionSelect');
const folderBtn = $('folderBtn');
const folderName = $('folderName');
const folderModal = $('folderModal');
const browserPath = $('browserPath');
const folderList = $('folderList');
const terminalPanel = $('terminalPanel');
const terminalContent = $('terminalContent');
const terminalInput = $('terminalInput');
const terminalCwd = $('terminalCwd');
const terminalTabs = $('terminalTabs');
const themeBtn = $('themeBtn');

let state = {
  isRunning: false,
  currentMessageEl: null,
  currentContentEl: null,
  messageCount: 0,
  currentPath: '',
  terminals: [],
  activeTerminalId: null,
  pendingTools: new Map(),
  cmdHistory: [],
  cmdHistoryIdx: -1,
  textBuffer: ''
};

// Theme toggle
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeBtn.onclick = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};

// Terminal toggle
$('terminalHeader').onclick = e => {
  if (e.target.closest('.terminal-tab') || e.target.closest('.terminal-add')) return;
  terminalPanel.classList.toggle('collapsed');
  $('terminalToggle').textContent = terminalPanel.classList.contains('collapsed') ? '▼' : '▲';
};

// Auto-resize textarea
promptTextarea.oninput = () => {
  promptTextarea.style.height = 'auto';
  promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 200) + 'px';
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

// Create user message
function addUserMessage(text) {
  if (state.messageCount === 0) welcome.style.display = 'none';
  state.messageCount++;
  
  const msg = document.createElement('div');
  msg.className = 'message user';
  msg.innerHTML = \`
    <div class="message-header">
      <div class="message-avatar">U</div>
      <span class="message-role">You</span>
    </div>
    <div class="message-content">\${formatText(text)}</div>
  \`;
  conversationContent.appendChild(msg);
  conversation.scrollTop = conversation.scrollHeight;
}

// Start assistant message
function startAssistantMessage() {
  if (state.messageCount === 0) welcome.style.display = 'none';
  state.messageCount++;
  
  const msg = document.createElement('div');
  msg.className = 'message assistant';
  msg.innerHTML = \`
    <div class="message-header">
      <div class="message-avatar">A</div>
      <span class="message-role">Assistant</span>
    </div>
    <div class="message-content">
      <div class="loader"><div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div></div>
    </div>
    <div class="message-actions">
      <button class="message-action copy-btn">📋 Copy</button>
    </div>
  \`;
  conversationContent.appendChild(msg);
  conversation.scrollTop = conversation.scrollHeight;
  
  state.currentMessageEl = msg;
  state.currentContentEl = msg.querySelector('.message-content');
  state.textBuffer = '';
  
  // Copy button handler
  msg.querySelector('.copy-btn').onclick = () => {
    const text = state.currentContentEl?.textContent || '';
    navigator.clipboard.writeText(text);
  };
}

// Add reasoning block
function addReasoning(text) {
  if (!state.currentContentEl) return;
  removeLoader();
  
  const reasoning = document.createElement('div');
  reasoning.className = 'reasoning';
  reasoning.innerHTML = \`
    <div class="reasoning-trigger">
      <span class="reasoning-icon">▶</span>
      <span>💭 Thinking...</span>
    </div>
    <div class="reasoning-content">\${text.replace(/\\n/g, '<br>')}</div>
  \`;
  reasoning.querySelector('.reasoning-trigger').onclick = () => {
    reasoning.classList.toggle('open');
  };
  state.currentContentEl.appendChild(reasoning);
  conversation.scrollTop = conversation.scrollHeight;
}

// Add tool call block
function addToolCall(toolId, toolName, args) {
  if (!state.currentContentEl) return;
  removeLoader();
  
  const tool = document.createElement('div');
  tool.className = 'tool-call running';
  tool.id = 'tool-' + toolId;
  tool.innerHTML = \`
    <div class="tool-header">
      <span class="tool-icon">🔧</span>
      <span class="tool-name">\${toolName}</span>
      <span class="tool-status">running...</span>
    </div>
    \${args ? '<div class="tool-args">' + JSON.stringify(args, null, 2).slice(0, 300) + '</div>' : ''}
  \`;
  state.currentContentEl.appendChild(tool);
  state.pendingTools.set(toolId, tool);
  conversation.scrollTop = conversation.scrollHeight;
}

// Update tool result
function updateToolResult(toolId, result, isError) {
  const tool = state.pendingTools.get(toolId) || document.getElementById('tool-' + toolId);
  if (tool) {
    tool.className = 'tool-call ' + (isError ? 'error' : 'success');
    tool.querySelector('.tool-status').textContent = isError ? '✗ failed' : '✓ done';
    if (result) {
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const resultEl = document.createElement('div');
      resultEl.className = 'tool-result';
      resultEl.textContent = resultStr.slice(0, 500) + (resultStr.length > 500 ? '...' : '');
      tool.appendChild(resultEl);
    }
    state.pendingTools.delete(toolId);
  }
  conversation.scrollTop = conversation.scrollHeight;
}

// Update text content
function updateTextContent(text) {
  if (!state.currentContentEl) return;
  removeLoader();
  
  let textEl = state.currentContentEl.querySelector('.text-content');
  if (!textEl) {
    textEl = document.createElement('div');
    textEl.className = 'text-content';
    state.currentContentEl.appendChild(textEl);
  }
  textEl.innerHTML = formatText(text);
  conversation.scrollTop = conversation.scrollHeight;
}

function removeLoader() {
  const loader = state.currentContentEl?.querySelector('.loader');
  if (loader) loader.remove();
}

// Terminal
function addTerminalLine(text, type = '') {
  const line = document.createElement('div');
  line.className = 'terminal-line' + (type ? ' ' + type : '');
  line.textContent = text;
  terminalContent.appendChild(line);
  terminalContent.scrollTop = terminalContent.scrollHeight;
}

// Send message
async function sendMessage() {
  const text = promptTextarea.value.trim();
  if (!text || state.isRunning) return;
  
  promptTextarea.value = '';
  promptTextarea.style.height = 'auto';
  addUserMessage(text);
  setRunning(true);
  startAssistantMessage();
  
  try {
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
  } catch (e) {
    updateTextContent('Error: ' + e.message);
    setRunning(false);
  }
}

async function stopGeneration() {
  try { await fetch('/api/abort', { method: 'POST' }); } catch {}
}

promptTextarea.onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};
submitBtn.onclick = sendMessage;
stopBtn.onclick = stopGeneration;

document.querySelectorAll('.suggestion').forEach(btn => {
  btn.onclick = () => {
    promptTextarea.value = btn.dataset.prompt;
    promptTextarea.focus();
  };
});

// Terminal input with history
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
    } else {
      state.cmdHistoryIdx = -1;
      terminalInput.value = '';
    }
    return;
  }
  if (e.key === 'Enter') {
    const cmd = terminalInput.value.trim();
    if (!cmd) return;
    state.cmdHistory.push(cmd);
    state.cmdHistoryIdx = -1;
    addTerminalLine(terminalCwd.textContent + ' $ ' + cmd, 'cmd');
    terminalInput.value = '';
    
    if (cmd === 'clear' || cmd === 'cls') {
      terminalContent.innerHTML = '';
      return;
    }
    
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, terminalId: state.activeTerminalId })
      });
      const data = await res.json();
      if (data.output) data.output.split('\\n').forEach(l => { if (l.trim()) addTerminalLine(l, 'output'); });
      if (data.error) addTerminalLine(data.error, 'error');
      if (data.cwd) terminalCwd.textContent = data.cwd.replace(/^\\/Users\\/[^\\/]+/, '~');
    } catch (e) {
      addTerminalLine('Error: ' + e.message, 'error');
    }
  }
};

// Folder browser
folderBtn.onclick = () => { folderModal.classList.add('open'); loadFolder(state.currentPath || ''); };
$('closeFolderModal').onclick = () => folderModal.classList.remove('open');
$('cancelFolderBtn').onclick = () => folderModal.classList.remove('open');
$('folderUpBtn').onclick = () => { if (browserPath.dataset.parent) loadFolder(browserPath.dataset.parent); };
$('selectFolderBtn').onclick = async () => {
  const path = browserPath.dataset.path;
  if (!path) return;
  try {
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceRoot: path }) });
    state.currentPath = path;
    folderName.textContent = path.split('/').pop() || path;
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

// Provider/Model selection
async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    const data = await res.json();
    providerSelect.innerHTML = data.providers.map(p => 
      '<option value="' + p.id + '"' + (p.hasKey ? '' : ' disabled') + '>' + p.name + (p.hasKey ? '' : ' ❌') + '</option>'
    ).join('');
  } catch (e) { console.error(e); }
}

async function loadModels(provider) {
  try {
    const res = await fetch('/api/models?provider=' + provider);
    const data = await res.json();
    modelSelect.innerHTML = data.models.map(m => 
      '<option value="' + m + '"' + (m === data.currentModel ? ' selected' : '') + '>' + m + '</option>'
    ).join('');
  } catch (e) { console.error(e); }
}

providerSelect.onchange = async () => {
  await loadModels(providerSelect.value);
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: providerSelect.value, model: modelSelect.value }) });
};
modelSelect.onchange = async () => {
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelSelect.value }) });
};

// Sessions
async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    sessionSelect.innerHTML = data.sessions.map(s => 
      '<option value="' + s.id + '"' + (s.id === data.currentSessionId ? ' selected' : '') + '>' + s.name + '</option>'
    ).join('');
  } catch (e) { console.error(e); }
}

sessionSelect.onchange = async () => {
  await fetch('/api/sessions/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sessionSelect.value }) });
  conversationContent.innerHTML = '';
  state.messageCount = 0;
  welcome.style.display = 'flex';
  conversationContent.appendChild(welcome);
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
      folderName.textContent = path.split('/').pop() || path;
      terminalCwd.textContent = path.replace(/^\\/Users\\/[^\\/]+/, '~');
    } catch (e) { addTerminalLine('Error: ' + e.message, 'error'); }
  };
};

// Terminals
async function loadTerminals() {
  try {
    const res = await fetch('/api/terminals');
    const data = await res.json();
    state.terminals = data.terminals;
    renderTerminalTabs();
    if (!state.activeTerminalId && data.terminals.length > 0) state.activeTerminalId = data.terminals[0].id;
  } catch (e) { console.error(e); }
}

function renderTerminalTabs() {
  terminalTabs.innerHTML = state.terminals.map(t => 
    '<div class="terminal-tab' + (t.id === state.activeTerminalId ? ' active' : '') + '" data-id="' + t.id + '">' + t.name + '</div>'
  ).join('');
  terminalTabs.querySelectorAll('.terminal-tab').forEach(tab => {
    tab.onclick = e => {
      e.stopPropagation();
      state.activeTerminalId = tab.dataset.id;
      renderTerminalTabs();
      terminalContent.innerHTML = '';
    };
  });
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

// SSE Events
const es = new EventSource('/api/events');
es.onmessage = ev => {
  try {
    const event = JSON.parse(ev.data);
    
    if (event.type === 'text-delta') {
      state.textBuffer += event.data?.text || '';
      updateTextContent(state.textBuffer);
      return;
    }
    
    if (event.type === 'thinking') {
      addReasoning(event.data?.text || 'Thinking...');
      return;
    }
    
    if (event.type === 'tool-call') {
      const d = event.data || {};
      addToolCall(d.toolCallId || Date.now(), d.toolName || 'tool', d.args);
      return;
    }
    
    if (event.type === 'tool-result') {
      const d = event.data || {};
      updateToolResult(d.toolCallId, d.result, d.isError);
      return;
    }
    
    if (event.type === 'complete' || event.type === 'aborted') {
      state.textBuffer = '';
      state.currentMessageEl = null;
      state.currentContentEl = null;
      state.pendingTools.clear();
      setRunning(false);
      return;
    }
    
    if (event.type === 'error') {
      updateTextContent('Error: ' + (event.data?.message || 'Unknown error'));
      state.textBuffer = '';
      setRunning(false);
      return;
    }
  } catch (e) { console.error('SSE error:', e); }
};

// Load config
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    state.currentPath = cfg.workspaceRoot;
    folderName.textContent = cfg.workspaceRoot?.split('/').pop() || 'Folder';
    terminalCwd.textContent = (cfg.workspaceRoot || '~').replace(/^\\/Users\\/[^\\/]+/, '~');
    providerSelect.value = cfg.provider;
    await loadModels(cfg.provider);
  } catch (e) { console.error(e); }
}

// Initialize
(async () => {
  await loadProviders();
  await loadConfig();
  await loadSessions();
  await loadTerminals();
  addTerminalLine('Terminal ready. Type commands here.', 'info');
})();
</script>
</body>
</html>`;
}
