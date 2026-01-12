/**
 * Command handling hook for the Web UI.
 * Provides slash command autocomplete and parsing.
 */

import { useState, useCallback, useEffect } from "react";

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
}

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface UseCommandsReturn {
  /** All available slash commands */
  commands: SlashCommand[];
  /** Currently filtered commands for autocomplete */
  filteredCommands: SlashCommand[];
  /** Selected command index in autocomplete */
  selectedIndex: number;
  /** Whether to show autocomplete */
  showAutocomplete: boolean;
  /** Parse a command string */
  parseCommand: (input: string) => ParsedCommand | null;
  /** Check if input is a command */
  isCommand: (input: string) => boolean;
  /** Handle input change for autocomplete */
  handleInputChange: (value: string) => void;
  /** Navigate autocomplete selection */
  navigateAutocomplete: (direction: "up" | "down") => void;
  /** Select current autocomplete item */
  selectAutocompleteItem: () => string;
  /** Reset autocomplete state */
  resetAutocomplete: () => void;
}

export function useCommands(): UseCommandsReturn {
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [currentInput, setCurrentInput] = useState("");

  // Load commands from API
  useEffect(() => {
    fetch("/api/commands")
      .then((res) => res.json())
      .then((data) => {
        if (data.commands) {
          setCommands(data.commands);
        }
      })
      .catch(() => {
        // Fallback to hardcoded commands
        setCommands([
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
        ]);
      });
  }, []);

  // Parse a command string
  const parseCommand = useCallback((input: string): ParsedCommand | null => {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) {
      return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? "";
    const args = parts.slice(1);

    if (!command) {
      return null;
    }

    return {
      command,
      args,
      raw: trimmed,
    };
  }, []);

  // Check if input is a valid command
  const isCommand = useCallback((input: string): boolean => {
    const parsed = parseCommand(input);
    if (!parsed) return false;

    const commandName = parsed.command.toLowerCase();
    return commands.some(
      (cmd) =>
        cmd.name.toLowerCase() === commandName ||
        cmd.aliases?.some((a) => a.toLowerCase() === commandName)
    );
  }, [parseCommand, commands]);

  // Handle input change for autocomplete
  const handleInputChange = useCallback((value: string) => {
    setCurrentInput(value);

    const trimmed = value.trim();
    if (!trimmed.startsWith("/")) {
      setShowAutocomplete(false);
      setFilteredCommands([]);
      return;
    }

    // Check if there's a space after the command (means we're done with command name)
    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex > 0) {
      setShowAutocomplete(false);
      setFilteredCommands([]);
      return;
    }

    // Filter commands
    const query = trimmed.slice(1).toLowerCase();
    if (!query) {
      setFilteredCommands(commands);
      setShowAutocomplete(true);
      setSelectedIndex(0);
      return;
    }

    const matches = commands
      .map((cmd) => {
        const name = cmd.name.toLowerCase();
        const aliases = (cmd.aliases || []).map((a) => a.toLowerCase());
        const namePrefix = name.startsWith(query) ? 3 : 0;
        const aliasPrefix = aliases.some((a) => a.startsWith(query)) ? 2 : 0;
        const nameIncludes = name.includes(query) ? 1 : 0;
        const aliasIncludes = aliases.some((a) => a.includes(query)) ? 1 : 0;
        const score = namePrefix + aliasPrefix + nameIncludes + aliasIncludes;
        return { cmd, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.cmd.name.localeCompare(b.cmd.name))
      .map((x) => x.cmd);

    setFilteredCommands(matches);
    setShowAutocomplete(matches.length > 0);
    setSelectedIndex(0);
  }, [commands]);

  // Navigate autocomplete selection
  const navigateAutocomplete = useCallback((direction: "up" | "down") => {
    if (!showAutocomplete || filteredCommands.length === 0) return;

    setSelectedIndex((prev) => {
      if (direction === "up") {
        return prev > 0 ? prev - 1 : filteredCommands.length - 1;
      } else {
        return prev < filteredCommands.length - 1 ? prev + 1 : 0;
      }
    });
  }, [showAutocomplete, filteredCommands.length]);

  // Select current autocomplete item
  const selectAutocompleteItem = useCallback((): string => {
    if (!showAutocomplete || filteredCommands.length === 0) {
      return currentInput;
    }

    const selected = filteredCommands[selectedIndex];
    if (selected) {
      return `/${selected.name} `;
    }

    return currentInput;
  }, [showAutocomplete, filteredCommands, selectedIndex, currentInput]);

  // Reset autocomplete state
  const resetAutocomplete = useCallback(() => {
    setShowAutocomplete(false);
    setFilteredCommands([]);
    setSelectedIndex(0);
    setCurrentInput("");
  }, []);

  return {
    commands,
    filteredCommands,
    selectedIndex,
    showAutocomplete,
    parseCommand,
    isCommand,
    handleInputChange,
    navigateAutocomplete,
    selectAutocompleteItem,
    resetAutocomplete,
  };
}
