/**
 * VSCode Terminal Adapter Implementation
 * Implements TerminalAdapter using VSCode Terminal API
 */

import * as vscode from "vscode";
import type {
  TerminalAdapter,
  Terminal,
  TerminalResult,
} from "@erzencode/core/platform/index.js";

class VSCodeTerminalWrapper implements Terminal {
  constructor(private terminal: vscode.Terminal) {}

  show(): void {
    this.terminal.show();
  }

  sendText(text: string): void {
    this.terminal.sendText(text);
  }

  dispose(): void {
    this.terminal.dispose();
  }
}

export class VSCodeTerminalAdapter implements TerminalAdapter {
  private activeTerminal?: VSCodeTerminalWrapper;

  async executeCommand(
    command: string,
    cwd?: string
  ): Promise<TerminalResult> {
    // Create terminal and execute command
    const terminal = vscode.window.createTerminal("ErzenCode");

    if (cwd) {
      terminal.sendText(`cd "${cwd}"`);
    }

    terminal.sendText(command);
    terminal.show();

    // For now, return a simple result
    // In production, we'd need to capture terminal output properly
    return {
      output: `Command executed: ${command}`,
      exitCode: 0,
    };
  }

  createTerminal(name?: string): Terminal {
    const terminal = vscode.window.createTerminal(name || "ErzenCode");
    this.activeTerminal = new VSCodeTerminalWrapper(terminal);
    return this.activeTerminal;
  }

  getTerminal(): Terminal | undefined {
    return this.activeTerminal;
  }
}
