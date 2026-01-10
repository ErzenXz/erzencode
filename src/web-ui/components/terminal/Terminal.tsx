import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ChevronDown, ChevronUp, Plus, X, Terminal as TerminalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TerminalPanelProps {
  className?: string;
}

export function TerminalPanel({ className }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [tabs, setTabs] = useState([{ id: 1, name: "Terminal 1" }]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const xterm = new XTerm({
      theme: {
        background: "#0a0a0f",
        foreground: "#e4e4e7",
        cursor: "#8b5cf6",
        cursorAccent: "#0a0a0f",
        selectionBackground: "#8b5cf640",
        black: "#18181b",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#8b5cf6",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#a78bfa",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Welcome message
    xterm.writeln("\r\n\x1b[1;35m✨ Erzencode Terminal\x1b[0m\r\n");
    xterm.writeln("Type 'help' for available commands.\r\n");

    // Store ref
    xtermRef.current = xterm;

    // Handle terminal input
    let currentLine = "";
    xterm.onData((data) => {
      switch (data) {
        case "\r": // Enter
          xterm.writeln("");
          if (currentLine.trim()) {
            handleCommand(currentLine.trim(), xterm);
          }
          currentLine = "";
          xterm.write("\r\n$ ");
          break;
        case "\u007F": // Backspace
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            xterm.write("\b \b");
          }
          break;
        default:
          if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7e)) {
            currentLine += data;
            xterm.write(data);
          }
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
    };
  }, []);

  const handleCommand = async (command: string, xterm: XTerm) => {
    try {
      const response = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await response.json();

      if (data.output) {
        xterm.writeln(data.output);
      }
      if (data.error) {
        xterm.writeln(`\x1b[31m${data.error}\x1b[0m`);
      }
    } catch (e) {
      xterm.writeln(`\x1b[31mError: ${(e as Error).message}\x1b[0m`);
    }
  };

  const addTab = () => {
    const newId = tabs.length + 1;
    setTabs([...tabs, { id: newId, name: `Terminal ${newId}` }]);
    setActiveTab(tabs.length);
  };

  const removeTab = (id: number) => {
    if (tabs.length === 1) return; // Keep at least one tab
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    setActiveTab(Math.min(activeTab, newTabs.length - 1));
  };

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border bg-background",
        isCollapsed && "h-9",
        className
      )}
    >
      {/* Terminal Header */}
      <div
        className="flex items-center justify-between border-b border-border px-2 py-1"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-1">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                activeTab === index
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(index);
              }}
            >
              <TerminalIcon className="h-3 w-3" />
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  className="ml-1 rounded hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              addTab();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
        >
          {isCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Terminal Content */}
      {!isCollapsed && (
        <div ref={terminalRef} className="flex-1 overflow-hidden p-2" />
      )}
    </div>
  );
}
