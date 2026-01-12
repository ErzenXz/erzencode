/**
 * CommandInput component for the Web UI.
 * Provides slash command autocomplete and @mention file autocomplete.
 */

import React, { useRef, useEffect, useCallback, useState } from "react";

import {
  useCommands,
  useFileAutocomplete,
  type SlashCommand,
} from "@/hooks";

interface CommandInputProps {
  sessionId?: string;
  onSubmit: (message: string) => void;
  onCommand?: (command: string, args: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CommandInput({
  sessionId,
  onSubmit,
  onCommand,
  disabled = false,
  placeholder = "Type a message or /command...",
}: CommandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);

  const commands = useCommands();
  const files = useFileAutocomplete(sessionId);

  // Combined autocomplete state
  const showCommandAutocomplete = commands.showAutocomplete;
  const showFileAutocomplete = files.showAutocomplete;
  const showAutocomplete = showCommandAutocomplete || showFileAutocomplete;

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setCursorIndex(e.target.selectionStart || 0);

    // Check for command autocomplete
    commands.handleInputChange(newValue);

    // Check for file autocomplete
    files.handleInputChange(newValue, e.target.selectionStart || 0);
  }, [commands, files]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && showAutocomplete) {
      e.preventDefault();
      if (showCommandAutocomplete) {
        const completed = commands.selectAutocompleteItem();
        setValue(completed);
        commands.handleInputChange(completed);
      } else if (showFileAutocomplete) {
        const selected = files.files[files.selectedIndex];
        if (selected) {
          const completed = files.selectFile(selected, value, cursorIndex);
          setValue(completed);
          files.handleInputChange(completed, cursorIndex + selected.length + 1);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && showAutocomplete) {
      e.preventDefault();
      if (showCommandAutocomplete) {
        commands.navigateAutocomplete("down");
      } else {
        files.navigate("down");
      }
      return;
    }

    if (e.key === "ArrowUp" && showAutocomplete) {
      e.preventDefault();
      if (showCommandAutocomplete) {
        commands.navigateAutocomplete("up");
      } else {
        files.navigate("up");
      }
      return;
    }

    if (e.key === "Escape") {
      commands.resetAutocomplete();
      files.reset();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const trimmed = value.trim();
      if (!trimmed) return;

      // Check if it's a command
      const parsed = commands.parseCommand(trimmed);
      if (parsed && commands.isCommand(trimmed)) {
        if (onCommand) {
          onCommand(parsed.command, parsed.args);
        }
        setValue("");
        commands.resetAutocomplete();
        files.reset();
        return;
      }

      // Regular message
      onSubmit(trimmed);
      setValue("");
      commands.resetAutocomplete();
      files.reset();
    }
  }, [
    showAutocomplete,
    showCommandAutocomplete,
    showFileAutocomplete,
    commands,
    files,
    value,
    cursorIndex,
    onSubmit,
    onCommand,
  ]);

  // Handle click on autocomplete item
  const handleCommandClick = useCallback((cmd: SlashCommand) => {
    const completed = `/${cmd.name} `;
    setValue(completed);
    commands.handleInputChange(completed);
    commands.resetAutocomplete();
    textareaRef.current?.focus();
  }, [commands]);

  const handleFileClick = useCallback((filePath: string) => {
    const completed = files.selectFile(filePath, value, cursorIndex);
    setValue(completed);
    files.reset();
    textareaRef.current?.focus();
  }, [files, value, cursorIndex]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="w-full min-h-[56px] max-h-[200px] px-4 py-3 bg-transparent border-none resize-none focus:outline-none text-sm"
        style={{ fieldSizing: "content" }}
      />

      {/* Command Autocomplete Dropdown */}
      {showCommandAutocomplete && commands.filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50">
          {commands.filteredCommands.map((cmd, index) => (
            <button
              key={`${cmd.name}-${index}`}
              type="button"
              onClick={() => handleCommandClick(cmd)}
              className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                index === commands.selectedIndex
                  ? "bg-blue-600 text-white"
                  : "text-gray-200 hover:bg-gray-800"
              }`}
            >
              <span>
                <span className="font-medium">/{cmd.name}</span>
                {cmd.aliases && cmd.aliases.length > 0 && (
                  <span className="ml-2 text-gray-500">
                    {cmd.aliases.map((a) => `/${a}`).join(", ")}
                  </span>
                )}
              </span>
              <span className="text-gray-500 text-xs">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* File Autocomplete Dropdown */}
      {showFileAutocomplete && files.files.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50">
          {files.files.map((file, index) => (
            <button
              key={`${file}-${index}`}
              type="button"
              onClick={() => handleFileClick(file)}
              className={`w-full px-4 py-2 text-left text-sm font-mono truncate ${
                index === files.selectedIndex
                  ? "bg-blue-600 text-white"
                  : "text-gray-200 hover:bg-gray-800"
              }`}
            >
              @{file}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
