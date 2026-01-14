/**
 * SessionService - Chat session persistence and management
 * Handles creating, loading, saving, and deleting chat sessions
 */

import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import {
  loadSessions,
  saveSessions,
  saveSession,
  deleteSession,
  getSessionsPath,
  type SessionData,
} from "@erzencode/core/config.js";

export interface SessionCreateOptions {
  name?: string;
  provider?: string;
  model?: string;
  workingDirectory?: string;
}

export interface SessionExportOptions {
  format: "json" | "markdown";
  includeMetadata?: boolean;
}

export class SessionService {
  private sessions: Map<string, SessionData> = new Map();
  private currentSessionId?: string;
  private _onSessionChanged = new vscode.EventEmitter<SessionData>();
  private _onSessionCreated = new vscode.EventEmitter<SessionData>();
  private _onSessionDeleted = new vscode.EventEmitter<string>();

  readonly onSessionChanged = this._onSessionChanged.event;
  readonly onSessionCreated = this._onSessionCreated.event;
  readonly onSessionDeleted = this._onSessionDeleted.event;

  constructor(
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Initialize the session service
   * Loads all sessions from the sessions.json file
   */
  async initialize(): Promise<void> {
    try {
      const sessions = await loadSessions();
      this.sessions.clear();

      for (const session of sessions) {
        this.sessions.set(session.id, session);
      }

      // Restore last session from workspace state
      this.currentSessionId = this.context.workspaceState.get<string>("currentSessionId");

      console.log(`Loaded ${sessions.length} sessions`);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      vscode.window.showErrorMessage(
        `Failed to load sessions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a new session
   */
  async createSession(options: SessionCreateOptions = {}): Promise<SessionData> {
    const workspaceRoot =
      options.workingDirectory ||
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
      process.cwd();

    const session: SessionData = {
      id: uuidv4(),
      name: options.name || this.generateDefaultSessionName(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDirectory: workspaceRoot,
      provider: options.provider as any,
      model: options.model,
      messages: [],
    };

    this.sessions.set(session.id, session);
    await this.saveSessionToDisk(session);

    this._onSessionCreated.fire(session);

    vscode.window.showInformationMessage(`Created new session: ${session.name}`);

    return session;
  }

  /**
   * Load a session by ID
   */
  loadSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    this.currentSessionId = sessionId;
    this.context.workspaceState.update("currentSessionId", sessionId);

    return session;
  }

  /**
   * Get the current session
   */
  getCurrentSession(): SessionData | null {
    if (!this.currentSessionId) {
      return null;
    }

    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession: SessionData = {
      ...session,
      ...updates,
      id: session.id, // Preserve ID
      createdAt: session.createdAt, // Preserve creation time
      updatedAt: Date.now(), // Update modification time
    };

    this.sessions.set(sessionId, updatedSession);
    await this.saveSessionToDisk(updatedSession);

    this._onSessionChanged.fire(updatedSession);
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    message: {
      role: "user" | "assistant" | "system" | "thinking" | "tool";
      content: string;
      toolName?: string;
      toolCallId?: string;
      toolStatus?: "running" | "success" | "error";
      toolInput?: string;
      toolOutput?: string;
    }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...message,
    };

    const updatedSession: SessionData = {
      ...session,
      messages: [...session.messages, newMessage],
      updatedAt: Date.now(),
    };

    this.sessions.set(sessionId, updatedSession);
    await this.saveSessionToDisk(updatedSession);

    this._onSessionChanged.fire(updatedSession);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the session "${session.name}"? This cannot be undone.`,
      { modal: true },
      "Delete",
      "Cancel"
    );

    if (confirmed === "Delete") {
      this.sessions.delete(sessionId);
      await deleteSession(sessionId);

      if (this.currentSessionId === sessionId) {
        this.currentSessionId = undefined;
        this.context.workspaceState.update("currentSessionId", undefined);
      }

      this._onSessionDeleted.fire(sessionId);

      vscode.window.showInformationMessage(`Deleted session: ${session.name}`);
    }
  }

  /**
   * Rename a session
   */
  async renameSession(sessionId: string, newName: string): Promise<void> {
    if (!newName || newName.trim().length === 0) {
      throw new Error("Session name cannot be empty");
    }

    await this.updateSession(sessionId, { name: newName.trim() });
  }

  /**
   * Duplicate a session
   */
  async duplicateSession(sessionId: string): Promise<SessionData> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const duplicatedSession: SessionData = {
      id: uuidv4(),
      name: `${session.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDirectory: session.workingDirectory,
      provider: session.provider,
      model: session.model,
      messages: [...session.messages], // Deep copy messages
    };

    this.sessions.set(duplicatedSession.id, duplicatedSession);
    await this.saveSessionToDisk(duplicatedSession);

    this._onSessionCreated.fire(duplicatedSession);

    vscode.window.showInformationMessage(`Duplicated session: ${session.name}`);

    return duplicatedSession;
  }

  /**
   * Export a session
   */
  async exportSession(sessionId: string, options: SessionExportOptions): Promise<string> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (options.format === "json") {
      return JSON.stringify(session, null, 2);
    }

    // Export as markdown
    let markdown = `# ${session.name}\n\n`;

    if (options.includeMetadata) {
      markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
      markdown += `**Last Updated:** ${new Date(session.updatedAt).toLocaleString()}\n`;
      markdown += `**Working Directory:** \`${session.workingDirectory}\`\n`;
      if (session.provider) {
        markdown += `**Provider:** ${session.provider}\n`;
      }
      if (session.model) {
        markdown += `**Model:** ${session.model}\n`;
      }
      markdown += `\n---\n\n`;
    }

    for (const message of session.messages) {
      const role = message.role === "user" ? "👤 **You**" : "🤖 **ErzenCode**";
      const timestamp = new Date(message.timestamp).toLocaleTimeString();

      markdown += `## ${role} (${timestamp})\n\n`;
      markdown += `${message.content}\n\n`;

      if (message.toolName) {
        markdown += `🔧 **Tool:** ${message.toolName}\n`;
        if (message.toolInput) {
          markdown += `**Input:**\n\`\`\`\n${message.toolInput}\n\`\`\`\n\n`;
        }
        if (message.toolOutput) {
          markdown += `**Output:**\n\`\`\`\n${message.toolOutput}\n\`\`\`\n\n`;
        }
      }

      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Export all sessions
   */
  async exportAllSessions(format: "json" | "markdown"): Promise<string> {
    const sessions = this.getAllSessions();

    if (format === "json") {
      return JSON.stringify(sessions, null, 2);
    }

    // Export all sessions as markdown
    let markdown = `# ErzenCode Sessions\n\n`;
    markdown += `Exported: ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    for (const session of sessions) {
      const sessionMarkdown = await this.exportSession(session.id, { format, includeMetadata: true });
      markdown += sessionMarkdown + "\n\n";
    }

    return markdown;
  }

  /**
   * Import sessions from JSON
   */
  async importSessions(data: string): Promise<number> {
    try {
      const imported = JSON.parse(data) as SessionData | SessionData[];

      const sessionsToImport = Array.isArray(imported) ? imported : [imported];

      let importCount = 0;

      for (const session of sessionsToImport) {
        // Validate session structure
        if (!session.id || !session.name || !Array.isArray(session.messages)) {
          console.warn("Skipping invalid session:", session);
          continue;
        }

        // Generate new ID to avoid conflicts
        const newSession: SessionData = {
          ...session,
          id: uuidv4(),
          createdAt: session.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        this.sessions.set(newSession.id, newSession);
        await this.saveSessionToDisk(newSession);
        importCount++;

        this._onSessionCreated.fire(newSession);
      }

      vscode.window.showInformationMessage(`Imported ${importCount} session(s)`);

      return importCount;
    } catch (error) {
      throw new Error(`Failed to import sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear all sessions
   */
  async clearAllSessions(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure you want to delete all ${this.sessions.size} session(s)? This cannot be undone.`,
      { modal: true },
      "Delete All",
      "Cancel"
    );

    if (confirmed === "Delete All") {
      const sessionIds = Array.from(this.sessions.keys());

      for (const sessionId of sessionIds) {
        this.sessions.delete(sessionId);
        this._onSessionDeleted.fire(sessionId);
      }

      await saveSessions([]);

      this.currentSessionId = undefined;
      this.context.workspaceState.update("currentSessionId", undefined);

      vscode.window.showInformationMessage("All sessions have been deleted");
    }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    totalMessages: number;
    oldestSession?: SessionData;
    newestSession?: SessionData;
    currentSession?: SessionData;
  } {
    const sessions = this.getAllSessions();
    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);

    return {
      totalSessions: sessions.length,
      totalMessages,
      oldestSession: sessions[sessions.length - 1],
      newestSession: sessions[0],
      currentSession: this.getCurrentSession() || undefined,
    };
  }

  /**
   * Save session to disk
   */
  private async saveSessionToDisk(session: SessionData): Promise<void> {
    try {
      await saveSession(session);
    } catch (error) {
      console.error("Failed to save session:", error);
      throw new Error(`Failed to save session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a default session name based on timestamp
   */
  private generateDefaultSessionName(): string {
    const date = new Date();
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `Session ${formattedDate}`;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onSessionChanged.dispose();
    this._onSessionCreated.dispose();
    this._onSessionDeleted.dispose();
  }
}
