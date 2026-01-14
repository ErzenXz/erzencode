/**
 * Terminal Adapter Interface
 * Abstract terminal operations for cross-platform compatibility
 */

import type { Terminal, TerminalResult } from "./types.js";

export interface TerminalAdapter {
  /**
   * Execute a command and return the result
   */
  executeCommand(command: string, cwd?: string): Promise<TerminalResult>;

  /**
   * Create a new terminal instance
   */
  createTerminal(name?: string): Terminal;

  /**
   * Get the active terminal
   */
  getTerminal(): Terminal | undefined;
}
