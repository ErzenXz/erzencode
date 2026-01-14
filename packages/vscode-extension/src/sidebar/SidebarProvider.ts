/**
 * Sidebar Provider for ErzenCode Chat View
 * Manages the webview sidebar in VSCode
 */

import * as vscode from "vscode";
import { AgentService } from "../services/AgentService.js";
import { ModelsService } from "../services/ModelsService.js";
import { ConfigService } from "../services/ConfigService.js";
import { SecretStorageService } from "../services/SecretStorageService.js";
import { SessionService } from "../services/SessionService.js";
import type { WebviewMessage, ExtensionMessage } from "./messages.js";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private agentService: AgentService;
  private modelsService: ModelsService;

  constructor(
    private context: vscode.ExtensionContext,
    private configService: ConfigService,
    private secretStorageService: SecretStorageService,
    private sessionService: SessionService
  ) {
    this.agentService = new AgentService(context);
    this.modelsService = new ModelsService();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
      ],
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    this.setupMessageHandlers(webviewView);
  }

  private setupMessageHandlers(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case "sendMessage":
            await this.handleSendMessage(message.data);
            break;

          case "openSettings":
            await this.handleOpenSettings();
            break;

          case "searchFiles":
            await this.handleSearchFiles(message.data);
            break;

          case "fileOperation":
            await this.handleFileOperation(message.data);
            break;

          case "commandExecution":
            await this.handleCommandExecution(message.data);
            break;

          case "getProviders":
            await this.handleGetProviders();
            break;

          case "getModels":
            await this.handleGetModels(message.data);
            break;

          case "preloadModels":
            await this.handlePreloadModels();
            break;

          case "ready":
            // Webview is ready, send current config and preload models
            this.postMessage({
              type: "configUpdate",
              data: await this.configService.loadLocalConfig(),
            });
            // Preload models in background
            this.modelsService.preloadModels().then(() => {
              this.postMessage({
                type: "modelsPreloaded",
                data: { cached: true },
              });
            }).catch(() => {
              // Silently fail if preloading doesn't work
            });
            break;
        }
      }
    );
  }

  private async handleSendMessage(data: unknown): Promise<void> {
    const { content } = data as { content: string };

    try {
      // Stream response back to webview
      for await (const event of this.agentService.streamMessage(content)) {
        this.postMessage({
          type: "streamEvent",
          data: event,
        });
      }
    } catch (error) {
      this.postMessage({
        type: "error",
        data: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  private async handleFileOperation(data: unknown): Promise<void> {
    // Handle file operations from webview
    // This will be implemented when we add file operations
    vscode.window.showInformationMessage(
      "File operation requested: " + JSON.stringify(data)
    );
  }

  private async handleCommandExecution(data: unknown): Promise<void> {
    // Handle command execution requests from webview
    // This will be implemented with proper approval flow
    vscode.window.showInformationMessage(
      "Command execution requested: " + JSON.stringify(data)
    );
  }

  private async handleOpenSettings(): Promise<void> {
    // Open ErzenCode settings webview (will be implemented)
    await vscode.commands.executeCommand("erzencode.openSettings");
  }

  private async handleSearchFiles(data: unknown): Promise<void> {
    const { query } = data as { query: string };

    // Search for files in the workspace
    const workspaceFiles = await vscode.workspace.findFiles(
      `**/*${query}*`,
      "**/node_modules/**",
      20 // Limit to 20 results
    );

    // Format results for autocomplete
    const items = workspaceFiles.map((uri) => {
      const fileName = uri.fsPath.split("/").pop() || uri.fsPath;
      const relativePath = vscode.workspace.asRelativePath(uri);
      const ext = fileName.includes(".") ? fileName.split(".").pop() : "";

      // Determine icon based on extension
      let icon = "📄";
      let type = "file";

      if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
        icon = "📜";
        type = "code";
      } else if (ext === "json") {
        icon = "{ }";
        type = "json";
      } else if (ext === "md") {
        icon = "📝";
        type = "markdown";
      } else if (ext === "css" || ext === "scss") {
        icon = "🎨";
        type = "style";
      } else if (ext === "html") {
        icon = "🌐";
        type = "html";
      } else if (ext === "py") {
        icon = "🐍";
        type = "python";
      } else if (ext === "go") {
        icon = "🐹";
        type = "go";
      } else if (ext === "rs") {
        icon = "🦀";
        type = "rust";
      }

      return {
        icon,
        label: relativePath,
        value: relativePath,
        type,
      };
    });

    this.postMessage({
      type: "searchResults",
      data: { items, query },
    });
  }

  private async handleGetProviders(): Promise<void> {
    const providers = await this.modelsService.getProviders();
    this.postMessage({
      type: "providers",
      data: providers,
    });
  }

  private async handleGetModels(data: unknown): Promise<void> {
    const { providerId } = data as { providerId: string };
    const models = await this.modelsService.getModels(providerId);
    this.postMessage({
      type: "models",
      data: { providerId, models },
    });
  }

  private async handlePreloadModels(): Promise<void> {
    await this.modelsService.preloadModels();
    this.postMessage({
      type: "modelsPreloaded",
      data: { cached: true },
    });
  }

  private postMessage(message: ExtensionMessage): void {
    this.view?.webview.postMessage(message);
  }

  private getWebviewContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource};">
  <title>ErzenCode AI</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* Header */
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-widget-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
      flex-shrink: 0;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-bottom {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .config-selector {
      padding: 4px 8px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 3px;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      outline: none;
      flex: 1;
      min-width: 100px;
    }

    .config-selector:hover {
      background: var(--vscode-dropdown-listBackground);
    }

    .config-selector:focus {
      border-color: var(--vscode-focusBorder);
    }

    .provider-status {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .provider-status.configured {
      background: var(--vscode-testingIconPassedForeground);
      color: white;
    }

    .provider-status.needs-key {
      background: var(--vscode-editorWarning-foreground);
      color: white;
    }

    .mode-selector {
      padding: 4px 8px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 3px;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      outline: none;
    }

    .mode-selector:hover {
      background: var(--vscode-dropdown-listBackground);
    }

    .mode-selector:focus {
      border-color: var(--vscode-focusBorder);
    }

    .settings-btn {
      padding: 4px 8px;
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      transition: background 0.2s;
    }

    .settings-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .header-status {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    /* Messages */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .message-role {
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }

    .message-time {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    .message-content {
      padding: 8px 12px;
      border-radius: 6px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .user-message .message-content {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }

    .assistant-message .message-content {
      background: var(--vscode-editor-inactiveSelectionBackground);
    }

    /* Code blocks */
    .code-block {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      margin: 8px 0;
      overflow: hidden;
    }

    .code-header {
      padding: 4px 8px;
      background: var(--vscode-editor-selectionBackground);
      font-size: 11px;
      font-family: var(--vscode-font-family);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .code-content {
      padding: 12px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      white-space: pre;
    }

    /* Tool calls */
    .tool-call {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 8px 12px;
      margin: 4px 0;
      border-radius: 4px;
    }

    .tool-name {
      font-weight: 600;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
    }

    .tool-args {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
      margin-top: 4px;
    }

    .tool-result {
      margin-top: 8px;
      padding: 8px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      font-size: 12px;
    }

    /* Input area */
    .input-area {
      padding: 12px;
      border-top: 1px solid var(--vscode-widget-border);
      display: flex;
      gap: 8px;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    #input {
      width: 100%;
      padding: 10px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      outline: none;
      resize: none;
      font-family: var(--vscode-font-family);
    }

    #input:focus {
      border-color: var(--vscode-focusBorder);
    }

    #send {
      padding: 10px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    #send:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }

    #send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Autocomplete */
    .autocomplete {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      display: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .autocomplete.visible {
      display: block;
    }

    .autocomplete-item {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .autocomplete-item:hover,
    .autocomplete-item.selected {
      background: var(--vscode-list-hoverBackground);
    }

    .autocomplete-item-icon {
      font-size: 14px;
    }

    .autocomplete-item-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .autocomplete-item-type {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    /* Typing indicator */
    .typing {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--vscode-descriptionForeground);
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Error messages */
    .error-message {
      background: var(--vscode-errorBackground);
      color: var(--vscode-errorForeground);
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid var(--vscode-errorBorder);
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: var(--vscode-scrollbarSlider-background);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-hoverBackground);
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-activeBackground);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <div class="header-title">🤖 ErzenCode AI</div>
        <div class="header-controls">
          <select id="mode-selector" class="mode-selector">
            <option value="agent">Agent</option>
            <option value="ask">Ask</option>
            <option value="plan">Plan</option>
          </select>
          <button id="settings-btn" class="settings-btn" title="Settings">⚙️</button>
        </div>
      </div>
      <div class="header-bottom">
        <select id="provider-selector" class="config-selector">
          <option value="" disabled selected>Loading providers...</option>
        </select>
        <select id="model-selector" class="config-selector">
          <option value="" disabled selected>Select provider first</option>
        </select>
        <div class="header-status" id="status">Ready</div>
      </div>
    </div>

    <div class="messages" id="messages"></div>

    <div class="input-area">
      <div class="input-wrapper">
        <textarea id="input" placeholder="Ask ErzenCode anything... Type @ to mention files" rows="1"></textarea>
        <div id="autocomplete" class="autocomplete"></div>
      </div>
      <button id="send">Send</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('input');
    const sendButton = document.getElementById('send');
    const messagesDiv = document.getElementById('messages');
    const statusDiv = document.getElementById('status');
    const autocompleteDiv = document.getElementById('autocomplete');
    const providerSelector = document.getElementById('provider-selector');
    const modelSelector = document.getElementById('model-selector');

    let isProcessing = false;
    let currentAssistantMessage = null;
    let currentToolCall = null;
    let providers = [];
    let models = {};

    // Autocomplete state
    let autocompleteItems = [];
    let autocompleteIndex = 0;
    let autocompleteQuery = '';
    let autocompleteStart = 0;

    // Request providers and models
    vscode.postMessage({ type: 'getProviders', data: {} });

    // Request file list from extension
    async function searchFiles(query) {
      vscode.postMessage({ type: 'searchFiles', data: { query } });
    }

    // Populate providers dropdown
    function populateProviders(providersList) {
      providers = providersList;
      providerSelector.innerHTML = '';

      // Group providers by status
      const configured = providersList.filter(p => p.status === 'configured');
      const needsKey = providersList.filter(p => p.status === 'needs-key');

      // Add configured providers first
      configured.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = '✓ ' + provider.name;
        providerSelector.appendChild(option);
      });

      // Add providers that need keys
      if (needsKey.length > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '--- Needs API Key ---';
        providerSelector.appendChild(separator);

        needsKey.forEach(provider => {
          const option = document.createElement('option');
          option.value = provider.id;
          option.textContent = '⚠ ' + provider.name;
          providerSelector.appendChild(option);
        });
      }
    }

    // Populate models dropdown
    function populateModels(modelsList) {
      modelSelector.innerHTML = '';
      modelsList.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        let displayName = model.name;
        if (model.pricing) {
          displayName = displayName + ' ($' + model.pricing.input + '/' + model.pricing.output + ')';
        }
        option.textContent = displayName;
        modelSelector.appendChild(option);
      });
    }

    // Show autocomplete dropdown
    function showAutocomplete(items, query) {
      autocompleteItems = items;
      autocompleteQuery = query;
      autocompleteIndex = 0;

      autocompleteDiv.innerHTML = '';
      if (items.length === 0) {
        autocompleteDiv.classList.remove('visible');
        return;
      }

      items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'autocomplete-item' + (index === 0 ? ' selected' : '');
        const iconSpan = document.createElement('span');
        iconSpan.className = 'autocomplete-item-icon';
        iconSpan.textContent = item.icon;
        const textSpan = document.createElement('span');
        textSpan.className = 'autocomplete-item-text';
        textSpan.textContent = item.label;
        const typeSpan = document.createElement('span');
        typeSpan.className = 'autocomplete-item-type';
        typeSpan.textContent = item.type;
        itemDiv.appendChild(iconSpan);
        itemDiv.appendChild(textSpan);
        itemDiv.appendChild(typeSpan);
        itemDiv.addEventListener('click', () => selectAutocompleteItem(item));
        autocompleteDiv.appendChild(itemDiv);
      });

      autocompleteDiv.classList.add('visible');
    }

    function hideAutocomplete() {
      autocompleteDiv.classList.remove('visible');
      autocompleteItems = [];
    }

    function selectAutocompleteItem(item) {
      const before = input.value.substring(0, autocompleteStart);
      const after = input.value.substring(input.selectionStart);
      input.value = before + item.value + after;
      input.selectionStart = input.selectionEnd = before.length + item.value.length;
      hideAutocomplete();
      input.focus();
    }

    function navigateAutocomplete(direction) {
      if (autocompleteItems.length === 0) return;

      autocompleteIndex += direction;
      if (autocompleteIndex < 0) autocompleteIndex = autocompleteItems.length - 1;
      if (autocompleteIndex >= autocompleteItems.length) autocompleteIndex = 0;

      const items = autocompleteDiv.querySelectorAll('.autocomplete-item');
      items.forEach((item, i) => {
        item.classList.toggle('selected', i === autocompleteIndex);
      });

      // Scroll into view
      items[autocompleteIndex].scrollIntoView({ block: 'nearest' });
    }

    // Handle input for @ mentions
    input.addEventListener('input', async (e) => {
      // Auto-resize
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';

      const value = input.value;
      const cursorPos = input.selectionStart;

      // Find @ symbol before cursor
      let atPos = -1;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (value[i] === '@') {
          atPos = i;
          break;
        }
        if (value[i] === ' ' || value[i] === '\\n') {
          break;
        }
      }

      if (atPos >= 0) {
        const query = value.substring(atPos + 1, cursorPos);
        if (query.length > 0) {
          autocompleteStart = atPos;
          await searchFiles(query);
        } else {
          hideAutocomplete();
        }
      } else {
        hideAutocomplete();
      }
    });

    // Handle keyboard navigation in autocomplete
    input.addEventListener('keydown', (e) => {
      if (autocompleteDiv.classList.contains('visible')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateAutocomplete(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateAutocomplete(-1);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (autocompleteItems[autocompleteIndex]) {
            selectAutocompleteItem(autocompleteItems[autocompleteIndex]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideAutocomplete();
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'streamEvent':
          handleStreamEvent(message.data);
          break;

        case 'error':
          removeTypingIndicator();
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = '❌ Error: ' + message.data.message;
          messagesDiv.appendChild(errorDiv);
          setProcessing(false);
          break;

        case 'searchResults':
          showAutocomplete(message.data.items, message.data.query);
          break;

        case 'providers':
          populateProviders(message.data);
          break;

        case 'models':
          models[message.data.providerId] = message.data.models;
          if (providerSelector.value === message.data.providerId) {
            populateModels(message.data.models);
          }
          break;

        case 'modelsPreloaded':
          console.log('Models preloaded successfully');
          break;
      }
    });

    // Format code blocks
    function formatContent(text) {
      if (!text) return '';

      // Escape HTML
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Code blocks
      text = text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, (match, code) => {
        const lines = code.trim().split('\\n');
        const language = lines[0] || 'text';
        const codeContent = lines.slice(1).join('\\n');
        return \`<div class="code-block">
          <div class="code-header">
            <span>\${language}</span>
          </div>
          <div class="code-content">\${codeContent}</div>
        </div>\`;
      });

      // Inline code
      text = text.replace(/\`([^\`]+)\`/g, '<code style="background: var(--vscode-editor-selectionBackground); padding: 2px 4px; border-radius: 3px; font-family: var(--vscode-editor-font-family);">$1</code>');

      // Line breaks
      text = text.replace(/\\n/g, '<br>');

      return text;
    }

    function createMessageElement(role, content) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + (role === 'user' ? 'user-message' : 'assistant-message');

      const headerDiv = document.createElement('div');
      headerDiv.className = 'message-header';

      const roleSpan = document.createElement('span');
      roleSpan.className = 'message-role';
      roleSpan.textContent = role === 'user' ? 'You' : 'ErzenCode';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'message-time';
      timeSpan.textContent = new Date().toLocaleTimeString();

      headerDiv.appendChild(roleSpan);
      headerDiv.appendChild(timeSpan);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = formatContent(content);

      messageDiv.appendChild(headerDiv);
      messageDiv.appendChild(contentDiv);

      return messageDiv;
    }

    function addMessage(role, content) {
      const messageDiv = createMessageElement(role, content);
      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return messageDiv;
    }

    function addTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'message assistant-message';
      typingDiv.id = 'typing';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = '<div class="typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

      typingDiv.appendChild(contentDiv);
      messagesDiv.appendChild(typingDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function removeTypingIndicator() {
      const typing = document.getElementById('typing');
      if (typing) typing.remove();
    }

    function addToolCall(toolName, args) {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'tool-call';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'tool-name';
      nameDiv.textContent = '🔧 ' + toolName;

      const argsDiv = document.createElement('div');
      argsDiv.className = 'tool-args';
      argsDiv.textContent = JSON.stringify(args, null, 2);

      toolDiv.appendChild(nameDiv);
      toolDiv.appendChild(argsDiv);

      if (currentAssistantMessage) {
        currentAssistantMessage.querySelector('.message-content').appendChild(toolDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }

      return toolDiv;
    }

    function addToolResult(result) {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'tool-result';
      resultDiv.textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      if (currentToolCall) {
        currentToolCall.appendChild(resultDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    }

    function setProcessing(processing) {
      isProcessing = processing;
      sendButton.disabled = processing;
      input.disabled = processing;
      statusDiv.textContent = processing ? 'Thinking...' : 'Ready';

      if (processing) {
        addTypingIndicator();
      } else {
        removeTypingIndicator();
      }
    }

    function sendMessage() {
      const content = input.value.trim();
      if (!content || isProcessing) return;

      addMessage('user', content);
      input.value = '';
      input.style.height = 'auto';
      setProcessing(true);

      vscode.postMessage({
        type: 'sendMessage',
        data: { content }
      });
    }

    sendButton.addEventListener('click', sendMessage);

    // Settings button handler
    document.getElementById('settings-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings', data: {} });
    });

    // Mode selector handler
    const modeSelector = document.getElementById('mode-selector');
    modeSelector.addEventListener('change', (e) => {
      const newMode = e.target.value;
      statusDiv.textContent = 'Mode: ' + newMode;
    });

    // Provider selector handler
    providerSelector.addEventListener('change', (e) => {
      const selectedProvider = e.target.value;
      modelSelector.innerHTML = '<option disabled selected>Loading models...</option>';

      // Check if we have cached models
      if (models[selectedProvider]) {
        populateModels(models[selectedProvider]);
      } else {
        // Request models from extension
        vscode.postMessage({
          type: 'getModels',
          data: { providerId: selectedProvider }
        });
      }
    });

    function handleStreamEvent(event) {
      removeTypingIndicator();

      switch (event.type) {
        case 'text-delta':
          if (!currentAssistantMessage) {
            currentAssistantMessage = addMessage('assistant', '');
          }
          const contentDiv = currentAssistantMessage.querySelector('.message-content');
          contentDiv.innerHTML = formatContent(event.data.text || '');
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
          break;

        case 'tool-call':
          currentToolCall = addToolCall(event.data.toolName, event.data.args);
          break;

        case 'tool-result':
          addToolResult(event.data.result);
          break;

        case 'finish':
          setProcessing(false);
          currentAssistantMessage = null;
          currentToolCall = null;
          break;

        case 'error':
          const errorMsg = event.data.message || 'Unknown error';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = '❌ ' + errorMsg;
          if (currentAssistantMessage) {
            currentAssistantMessage.querySelector('.message-content').appendChild(errorDiv);
          } else {
            messagesDiv.appendChild(errorDiv);
          }
          setProcessing(false);
          break;
      }
    }

    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready', data: {} });

    // Focus input on load
    input.focus();
  </script>
</body>
</html>`;
  }

  /**
   * Public method to send a message to the chat
   */
  public sendMessage(content: string): void {
    this.postMessage({
      type: "streamEvent",
      data: {
        type: "text-delta",
        data: { text: content },
      },
    });
  }
}
