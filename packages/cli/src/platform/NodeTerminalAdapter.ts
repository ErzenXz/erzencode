/**
 * Node.js Terminal Adapter Implementation
 * Implements TerminalAdapter using Node.js child_process for CLI usage
 */

import { spawn, ChildProcess } from "child_process";
import type {
  TerminalAdapter,
  Terminal,
  TerminalResult,
} from "@erzencode/core/platform";

class NodeTerminal implements Terminal {
  constructor(private process: ChildProcess) {}

  show(): void {
    // In CLI, the terminal is always visible (stdout/stderr)
    // This is a no-op for Node.js
  }

  sendText(text: string): void {
    if (this.process.stdin) {
      this.process.stdin.write(text + "\n");
    }
  }

  dispose(): void {
    this.process.kill();
  }
}

export class NodeTerminalAdapter implements TerminalAdapter {
  private activeTerminal?: Terminal;

  async executeCommand(
    command: string,
    cwd?: string
  ): Promise<TerminalResult> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ");

      const childProcess = spawn(cmd, args, {
        cwd: cwd || process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let output = "";
      let errorOutput = "";

      childProcess.stdout?.on("data", (data) => {
        output += data.toString();
      });

      childProcess.stderr?.on("data", (data) => {
        errorOutput += data.toString();
      });

      childProcess.on("close", (code) => {
        resolve({
          output: output || errorOutput,
          exitCode: code || 0,
          error: errorOutput || undefined,
        });
      });

      childProcess.on("error", (error) => {
        reject(error);
      });

      this.activeTerminal = new NodeTerminal(childProcess);
    });
  }

  createTerminal(name?: string): Terminal {
    // For CLI, we create a new process that isn't immediately used
    const childProcess = spawn(process.env.SHELL || "bash", [], {
      stdio: "pipe",
    });

    return new NodeTerminal(childProcess);
  }

  getTerminal(): Terminal | undefined {
    return this.activeTerminal;
  }
}
