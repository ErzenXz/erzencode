import { useCallback, useRef } from "react";
import { useInput } from "ink";
import type { AgentMode as CodingAgentMode } from "@erzencode/core/ai-agent";
import { MODES, SLASH_COMMANDS, type ModalType, type SlashCommand } from "../types.js";
import { clamp } from "../utils.js";

interface UseKeyboardOptions {
  stage: "welcome" | "chat";
  activeModal: ModalType;
  isThinking: boolean;
  mode: CodingAgentMode;
  showAutocomplete: boolean;
  autocompleteMatches: SlashCommand[];
  autocompleteIndex: number;
  commandHistory: string[];
  historyIndex: number;
  scrollOffset: number;
  contentHeight: number;
  activityLineCount: number;
  cancelCountdown: number | null;
  abortController: AbortController | null;
  
  onStageChange: (stage: "welcome" | "chat") => void;
  onModalChange: (modal: ModalType) => void;
  onModalSelectionChange: (index: number) => void;
  onModalSelect: () => void;
  onModalSearchInput: (char: string) => void;
  onModalSearchBackspace: () => void;
  onModeChange: (mode: CodingAgentMode) => void;
  onStatusChange: (status: string) => void;
  onAutocompleteToggle: (show: boolean) => void;
  onAutocompleteIndexChange: (index: number) => void;
  onAutocompleteSelect: (cmd: SlashCommand) => void;
  onHistoryIndexChange: (index: number) => void;
  onInputChange: (input: string) => void;
  onScrollOffsetChange: (offset: number) => void;
  onCancelCountdownChange: (countdown: number | null) => void;
  onCancel: () => void;
  onExit: () => void;
  getModalItemCount: () => number;
}

export function useKeyboard(options: UseKeyboardOptions) {
  const {
    stage,
    activeModal,
    isThinking,
    mode,
    showAutocomplete,
    autocompleteMatches,
    autocompleteIndex,
    commandHistory,
    historyIndex,
    scrollOffset,
    contentHeight,
    activityLineCount,
    cancelCountdown,
    abortController,
    onStageChange,
    onModalChange,
    onModalSelectionChange,
    onModalSelect,
    onModalSearchInput,
    onModalSearchBackspace,
    onModeChange,
    onStatusChange,
    onAutocompleteToggle,
    onAutocompleteIndexChange,
    onAutocompleteSelect,
    onHistoryIndexChange,
    onInputChange,
    onScrollOffsetChange,
    onCancelCountdownChange,
    onCancel,
    onExit,
    getModalItemCount,
  } = options;

  const suppressInputRef = useRef(false);
  const inputSnapshotRef = useRef("");

  const markInputUnchanged = useCallback((currentInput: string) => {
    inputSnapshotRef.current = currentInput;
    suppressInputRef.current = true;
  }, []);

  const handleInputChange = useCallback((next: string) => {
    if (suppressInputRef.current) {
      suppressInputRef.current = false;
      onInputChange(inputSnapshotRef.current);
      return;
    }
    onInputChange(next);
  }, [onInputChange]);

  useInput((inputKey, key) => {
    // Welcome stage - just press enter to start
    if (stage === "welcome") {
      if (key.return) onStageChange("chat");
      return;
    }

    // Ctrl+C to exit
    if (key.ctrl && inputKey === "c") {
      onExit();
      return;
    }

    // Modal navigation
    if (activeModal !== "none") {
      if (key.escape) {
        onModalChange("none");
        onModalSelectionChange(0);
        return;
      }
      if (key.upArrow) {
        onModalSelectionChange(-1); // Will be handled by parent to decrement
        return;
      }
      if (key.downArrow) {
        onModalSelectionChange(1); // Will be handled by parent to increment
        return;
      }
      if (key.return) {
        onModalSelect();
        return;
      }
      // Handle typing in searchable modals (models, provider)
      const isSearchableModal = activeModal === "models" || activeModal === "provider";
      if (isSearchableModal) {
        if (key.backspace || key.delete) {
          onModalSearchBackspace();
          return;
        }
        // Allow typing printable characters
        if (inputKey && inputKey.length === 1 && !key.ctrl && !key.meta) {
          onModalSearchInput(inputKey);
          return;
        }
      }
      return;
    }

    // Tab to switch modes - CRITICAL: prevent input interference
    if (key.tab && !isThinking && stage === "chat") {
      const currentIndex = MODES.indexOf(mode);
      const nextIndex = (currentIndex + 1) % MODES.length;
      const nextMode = MODES[nextIndex]!;
      onModeChange(nextMode);
      onStatusChange(`Mode: ${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}`);
      return;
    }

    // ESC handling for cancel
    if (key.escape) {
      if (showAutocomplete) {
        onAutocompleteToggle(false);
        return;
      }
      if (isThinking) {
        if (cancelCountdown !== null) {
          onCancel();
        } else {
          onCancelCountdownChange(2);
        }
      }
      return;
    }

    // Autocomplete navigation
    if (showAutocomplete) {
      if (key.upArrow) {
        onAutocompleteIndexChange(autocompleteIndex > 0 ? autocompleteIndex - 1 : autocompleteMatches.length - 1);
        return;
      }
      if (key.downArrow) {
        onAutocompleteIndexChange(autocompleteIndex < autocompleteMatches.length - 1 ? autocompleteIndex + 1 : 0);
        return;
      }
      if (key.return && autocompleteMatches[autocompleteIndex]) {
        onAutocompleteSelect(autocompleteMatches[autocompleteIndex]);
        return;
      }
    }

    // Command history navigation (only when not in autocomplete)
    if (!showAutocomplete) {
      if (key.upArrow && commandHistory.length > 0) {
        if (historyIndex === -1) {
          onHistoryIndexChange(commandHistory.length - 1);
          onInputChange(commandHistory[commandHistory.length - 1] ?? "");
        } else if (historyIndex > 0) {
          onHistoryIndexChange(historyIndex - 1);
          onInputChange(commandHistory[historyIndex - 1] ?? "");
        }
        return;
      }
      if (key.downArrow && historyIndex !== -1) {
        if (historyIndex < commandHistory.length - 1) {
          onHistoryIndexChange(historyIndex + 1);
          onInputChange(commandHistory[historyIndex + 1] ?? "");
        } else {
          onHistoryIndexChange(-1);
          onInputChange("");
        }
        return;
      }
    }

    // Scrolling with Page Up/Down
    if (key.pageUp) {
      const maxScroll = Math.max(0, activityLineCount - contentHeight);
      onScrollOffsetChange(clamp(scrollOffset + 5, 0, maxScroll));
      return;
    }
    if (key.pageDown) {
      onScrollOffsetChange(Math.max(scrollOffset - 5, 0));
      return;
    }

    // Scrolling with Ctrl+U/D
    if (key.ctrl && (inputKey === "u" || inputKey === "d")) {
      const isUp = inputKey === "u";
      const page = Math.max(3, Math.floor(contentHeight / 2));
      const maxScroll = Math.max(0, activityLineCount - contentHeight);
      onScrollOffsetChange(clamp(scrollOffset + (isUp ? page : -page), 0, maxScroll));
      return;
    }
  });

  return {
    handleInputChange,
    markInputUnchanged,
  };
}
