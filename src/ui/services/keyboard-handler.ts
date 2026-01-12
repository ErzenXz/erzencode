/**
 * Keyboard handler service for the Terminal UI.
 * Routes keyboard input to appropriate handlers based on context.
 * This module is independent of React.
 */

import type { Stage, ModalType } from "../types/ui-state.js";

/**
 * Key modifiers.
 */
/**
 * Keyboard context for routing decisions.
 */
export interface KeyboardContext {
  stage: Stage;
  activeModal: ModalType;
  isThinking: boolean;
  autocompleteKind: "none" | "slash" | "file";
  hasBashApprovalPrompt: boolean;
}

/**
 * Keyboard action types.
 */
export type KeyboardActionType =
  | "input"
  | "modal"
  | "navigation"
  | "scroll"
  | "command"
  | "autocomplete"
  | "history"
  | "cancel"
  | "exit"
  | "none";

/**
 * Keyboard action result.
 */
export interface KeyboardAction {
  type: KeyboardActionType;
  action: string;
  payload?: unknown;
}

/**
 * Ink key object structure.
 */
export interface InkKey {
  return: boolean;
  escape: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageUp: boolean;
  pageDown: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/**
 * Creates a keyboard action.
 */
function action(
  type: KeyboardActionType,
  actionName: string,
  payload?: unknown
): KeyboardAction {
  return { type, action: actionName, payload };
}

/**
 * No-op action.
 */
const noAction = (): KeyboardAction => action("none", "none");

/**
 * Handles keyboard input in the welcome stage.
 */
function handleWelcomeStage(key: InkKey): KeyboardAction {
  if (key.return) {
    return action("navigation", "start-chat");
  }
  return noAction();
}

/**
 * Handles keyboard input when bash approval prompt is shown.
 */
function handleBashApproval(
  _inputKey: string,
  key: InkKey
): KeyboardAction {
  if (key.escape) {
    return action("command", "bash-cancel");
  }
  if (key.upArrow) {
    return action("navigation", "bash-prev");
  }
  if (key.downArrow) {
    return action("navigation", "bash-next");
  }
  if (key.return) {
    return action("command", "bash-select");
  }
  return noAction();
}

/**
 * Handles keyboard input when a modal is open.
 */
function handleModalInput(
  inputKey: string,
  key: InkKey,
  modalType: ModalType
): KeyboardAction {
  const normalizedInput = inputKey ?? "";

  // Backspace/Delete detection (match handleTextInput behavior)
  // NOTE: On macOS, the Backspace key commonly sends DEL (\x7f) and Ink may surface it as key.delete=true.
  const charCode = normalizedInput.length === 1 ? normalizedInput.charCodeAt(0) : -1;

  // Forward delete (fn+backspace) usually sends an escape sequence like \x1b[3~
  const isForwardDelete =
    normalizedInput === "\x1b[3~" ||
    (normalizedInput.startsWith("\x1b") && normalizedInput.includes("3~"));

  const isBackspace =
    key.backspace === true ||
    charCode === 127 || // DEL - common macOS backspace
    charCode === 8 ||   // BS
    normalizedInput === "\x7f" ||
    normalizedInput === "\b" ||
    normalizedInput === "\u007f" ||
    normalizedInput === "\u0008" ||
    normalizedInput === "\x1b[127~" ||
    normalizedInput === "\x1b[8~" ||
    // Ink can report key.delete for macOS backspace (\x7f)
    (key.delete === true && normalizedInput.length <= 1);

  // inputKey is used for character input in apikey modal and copilot-oauth modal
  // API key modal has special text input handling
  if (modalType === "apikey") {
    if (key.escape) {
      return action("modal", "close");
    }
    if (key.return) {
      return action("modal", "submit");
    }
    if (isForwardDelete || isBackspace) {
      return action("input", "backspace");
    }
    if (key.leftArrow) {
      return action("input", "cursor-left");
    }
    if (key.rightArrow) {
      return action("input", "cursor-right");
    }
    // Printable characters
    if (!key.ctrl && !key.meta && normalizedInput && !normalizedInput.includes("\u001b")) {
      return action("input", "insert", normalizedInput);
    }
    return noAction();
  }

  // Selector modals (models, provider, theme, sessions, thinking)
  const selectorModals = ["models", "provider", "theme", "sessions", "thinking"];
  if (selectorModals.includes(modalType)) {
    if (key.escape) {
      return action("modal", "close");
    }
    if (key.upArrow) {
      return action("modal", "navigate-up");
    }
    if (key.downArrow) {
      return action("modal", "navigate-down");
    }
    if (key.return || key.tab) {
      return action("modal", "select");
    }
    if (isForwardDelete || isBackspace) {
      return action("input", "backspace");
    }
    if (!key.ctrl && !key.meta && normalizedInput && !normalizedInput.includes("\u001b")) {
      return action("input", "insert", normalizedInput);
    }
    return noAction();
  }

  // Index modal with API key input
  if (modalType === "index") {
    if (key.escape) {
      return action("modal", "close");
    }
    if (key.return) {
      return action("modal", "submit");
    }
    if (isForwardDelete || isBackspace) {
      return action("input", "backspace");
    }
    if (key.leftArrow) {
      return action("input", "cursor-left");
    }
    if (key.rightArrow) {
      return action("input", "cursor-right");
    }
    if (!key.ctrl && !key.meta && normalizedInput && !normalizedInput.includes("\u001b")) {
      return action("input", "insert", normalizedInput);
    }
    return noAction();
  }

  // Search modal
  if (modalType === "search") {
    if (key.escape) {
      return action("modal", "close");
    }
    if (key.upArrow) {
      return action("modal", "navigate-up");
    }
    if (key.downArrow) {
      return action("modal", "navigate-down");
    }
    if (key.return) {
      return action("modal", "select");
    }
    if (isForwardDelete || isBackspace) {
      return action("input", "backspace");
    }
    if (!key.ctrl && !key.meta && normalizedInput && !normalizedInput.includes("\u001b")) {
      return action("input", "insert", normalizedInput);
    }
    return noAction();
  }

  // Copilot OAuth modal
  if (modalType === "copilot-oauth") {
    if (key.escape) {
      return action("modal", "close");
    }
    if (key.return || normalizedInput) {
      return action("modal", "continue");
    }
    return noAction();
  }

  // Standard modal navigation
  if (key.escape) {
    return action("modal", "close");
  }
  if (key.upArrow) {
    return action("modal", "navigate-up");
  }
  if (key.downArrow) {
    return action("modal", "navigate-down");
  }
  if (key.return) {
    return action("modal", "select");
  }

  return noAction();
}

/**
 * Handles keyboard input when autocomplete is shown.
 */
function handleAutocompleteInput(
  inputKey: string,
  key: InkKey
): KeyboardAction {
  void inputKey;
  if (key.upArrow) {
    return action("autocomplete", "navigate-up");
  }
  if (key.downArrow) {
    return action("autocomplete", "navigate-down");
  }
  if (key.return) {
    return action("autocomplete", "select");
  }
  if (key.tab) {
    return action("autocomplete", "complete");
  }
  if (key.escape) {
    return action("autocomplete", "close");
  }
  return noAction();
}

/**
 * Handles keyboard input for text editing.
 */
function handleTextInput(
  inputKey: string,
  key: InkKey,
  _isThinking: boolean
): KeyboardAction {
  const normalizedInput = inputKey ?? "";
  // Submit
  if (key.return) {
    if (key.ctrl) {
      return action("input", "newline");
    }
    return action("command", "submit");
  }

  // Backspace/Delete - comprehensive detection for Mac terminals
  // IMPORTANT: Ink 6.x maps \x7f (DEL char, ASCII 127) to key.delete, but on Mac
  // the backspace key sends \x7f. So we need to treat \x7f as backspace.
  // Real forward delete sends escape sequence \x1b[3~
  const charCode = normalizedInput.length === 1 ? normalizedInput.charCodeAt(0) : -1;
  
  // Check for actual forward delete (fn+backspace on Mac)
  const isForwardDelete =
    normalizedInput === "\x1b[3~" ||
    (normalizedInput.startsWith("\x1b") && normalizedInput.includes("3~"));
  
  // Check for backspace - comprehensive detection for all terminals
  // Mac sends \x7f (DEL, ASCII 127) for backspace
  // Some terminals send \x08 (BS, ASCII 8)
  // Ink may report key.delete=true for \x7f on Mac (incorrectly)
  const isBackspace =
    key.backspace === true ||
    charCode === 127 ||  // DEL character - Mac backspace
    charCode === 8 ||    // BS character
    normalizedInput === "\x7f" ||
    normalizedInput === "\b" ||
    normalizedInput === "\u007f" || // Unicode DEL
    normalizedInput === "\u0008" || // Unicode BS
    // key.delete with single char is actually backspace on Mac
    (key.delete === true && normalizedInput.length <= 1);

  if (isForwardDelete) {
    return action("input", "delete");
  }
  if (isBackspace) {
    return action("input", "backspace");
  }

  // Cursor movement
  if (key.leftArrow) {
    return action("input", "cursor-left");
  }
  if (key.rightArrow) {
    return action("input", "cursor-right");
  }

  // Ctrl+A - beginning of line
  if (key.ctrl && normalizedInput === "a") {
    return action("input", "cursor-start");
  }

  // Ctrl+E - end of line
  if (key.ctrl && normalizedInput === "e") {
    return action("input", "cursor-end");
  }

  // Ignore escape sequences
  if (
    normalizedInput.includes("\u001b") ||
    /^\[?<\d+;\d+;\d+[mM]$/.test(normalizedInput) ||
    normalizedInput.startsWith("[<")
  ) {
    return noAction();
  }

  // Printable characters
  if (!key.ctrl && !key.meta && normalizedInput) {
    return action("input", "insert", normalizedInput);
  }

  return noAction();
}

/**
 * Main keyboard handler function.
 * Routes input to appropriate handler based on context.
 */
export function handleKeyboardInput(
  inputKey: string,
  key: InkKey,
  context: KeyboardContext
): KeyboardAction {
  // Welcome stage
  if (context.stage === "welcome") {
    return handleWelcomeStage(key);
  }

  // Bash approval prompt
  if (context.hasBashApprovalPrompt) {
    return handleBashApproval(inputKey, key);
  }

  // Ctrl+C to exit (always available)
  if (key.ctrl && inputKey === "c") {
    return action("exit", "exit");
  }

  // Ctrl+T - toggle todo list panel (always available in chat)
  if (context.stage === "chat" && key.ctrl && inputKey === "t") {
    return action("command", "toggle-todos");
  }

  // Modal input
  if (context.activeModal !== "none") {
    return handleModalInput(inputKey, key, context.activeModal);
  }

  // Tab for mode switching (when not in autocomplete)
  if (key.tab && !context.isThinking && context.autocompleteKind === "none") {
    return action("command", "switch-mode");
  }

  // Escape handling
  if (key.escape) {
    if (context.autocompleteKind !== "none") {
      return action("autocomplete", "close");
    }
    if (context.isThinking) {
      return action("cancel", "cancel");
    }
    return noAction();
  }

  // Autocomplete navigation
  if (context.autocompleteKind !== "none") {
    const autocompleteAction = handleAutocompleteInput(inputKey, key);
    if (autocompleteAction.type !== "none") {
      return autocompleteAction;
    }
  }

  // Chat scrolling (internal viewport scrolling)
  // NOTE: We handle Ctrl+Up/Down before history navigation so scrolling works
  // even while the user is typing.
  if (context.stage === "chat" && context.autocompleteKind === "none") {
    if (key.ctrl && key.upArrow) {
      return action("scroll", "page-up");
    }
    if (key.ctrl && key.downArrow) {
      return action("scroll", "page-down");
    }
  }

  // History navigation (when not in autocomplete)
  if (context.autocompleteKind === "none") {
    if (key.upArrow) {
      return action("history", "navigate-up");
    }
    if (key.downArrow) {
      return action("history", "navigate-down");
    }
  }

  // Chat scrolling (internal viewport scrolling)
  if (context.stage === "chat" && context.autocompleteKind === "none") {
    if (key.pageUp) {
      return action("scroll", "page-up");
    }
    if (key.pageDown) {
      return action("scroll", "page-down");
    }
    if (key.ctrl && (inputKey === "u" || inputKey === "d")) {
      return action("scroll", inputKey === "u" ? "half-page-up" : "half-page-down");
    }
  }

  // Text input
  return handleTextInput(inputKey, key, context.isThinking);
}

/**
 * Creates a keyboard handler instance.
 */
export function createKeyboardHandler() {
  return {
    handleInput: handleKeyboardInput,
  };
}
