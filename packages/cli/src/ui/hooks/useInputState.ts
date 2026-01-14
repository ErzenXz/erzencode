/**
 * Custom hook for managing input state in the Terminal UI.
 * Handles text input, cursor position, and command history.
 */

import { useState, useCallback, useRef } from "react";

/**
 * Return type for the useInputState hook.
 */
export interface UseInputStateReturn {
  /** Current input value */
  value: string;
  /** Current cursor position */
  cursorIndex: number;
  /** Set the input value */
  setValue: (value: string) => void;
  /** Set the cursor position */
  setCursorIndex: (index: number) => void;
  /** Set both value and cursor at once */
  setValueAndCursor: (value: string, cursor?: number) => void;
  /** Insert text at cursor position */
  insertText: (text: string) => void;
  /** Delete character at cursor */
  deleteChar: (direction: "forward" | "backward") => void;
  /** Move cursor */
  moveCursor: (direction: "left" | "right" | "start" | "end") => void;
  /** Clear input */
  clear: () => void;
  /** Command history */
  history: string[];
  /** Current history index (-1 means not browsing history) */
  historyIndex: number;
  /** Navigate through history */
  navigateHistory: (direction: "up" | "down") => void;
  /** Add to history */
  addToHistory: (command: string) => void;
  /** Reset history navigation */
  resetHistoryIndex: () => void;
}

/**
 * Hook for managing input state with cursor and history support.
 * @param initialValue - Initial input value
 * @returns Input state and manipulation functions
 */
export function useInputState(initialValue: string = ""): UseInputStateReturn {
  const [value, setValueState] = useState(initialValue);
  const [cursorIndex, setCursorIndexState] = useState(initialValue.length);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Use ref for cursor to avoid stale closures
  const cursorRef = useRef(cursorIndex);

  const setValue = useCallback((newValue: string) => {
    setValueState(newValue);
  }, []);

  const setCursorIndex = useCallback((index: number) => {
    cursorRef.current = index;
    setCursorIndexState(index);
  }, []);

  const setValueAndCursor = useCallback((newValue: string, cursor?: number) => {
    setValueState(newValue);
    const newCursor = cursor ?? newValue.length;
    cursorRef.current = newCursor;
    setCursorIndexState(newCursor);
  }, []);

  const insertText = useCallback((text: string) => {
    setValueState((prev) => {
      const cur = cursorRef.current;
      const next = prev.slice(0, cur) + text + prev.slice(cur);
      const nextCursor = cur + text.length;
      cursorRef.current = nextCursor;
      setCursorIndexState(nextCursor);
      return next;
    });
  }, []);

  const deleteChar = useCallback((direction: "forward" | "backward") => {
    setValueState((prev) => {
      const cur = cursorRef.current;
      if (direction === "backward") {
        if (cur <= 0) return prev;
        const next = prev.slice(0, cur - 1) + prev.slice(cur);
        const nextCursor = cur - 1;
        cursorRef.current = nextCursor;
        setCursorIndexState(nextCursor);
        return next;
      } else {
        if (cur >= prev.length) return prev;
        const next = prev.slice(0, cur) + prev.slice(cur + 1);
        // Cursor stays in place for forward delete
        return next;
      }
    });
  }, []);

  const moveCursor = useCallback((direction: "left" | "right" | "start" | "end") => {
    setValueState((prev) => {
      let newCursor: number;
      switch (direction) {
        case "left":
          newCursor = Math.max(0, cursorRef.current - 1);
          break;
        case "right":
          newCursor = Math.min(prev.length, cursorRef.current + 1);
          break;
        case "start":
          newCursor = 0;
          break;
        case "end":
          newCursor = prev.length;
          break;
      }
      cursorRef.current = newCursor;
      setCursorIndexState(newCursor);
      return prev; // Value doesn't change
    });
  }, []);

  const clear = useCallback(() => {
    setValueState("");
    cursorRef.current = 0;
    setCursorIndexState(0);
    setHistoryIndex(-1);
  }, []);

  const navigateHistory = useCallback((direction: "up" | "down") => {
    if (history.length === 0) return;

    setHistoryIndex((prevIndex) => {
      let newIndex: number;
      if (direction === "up") {
        if (prevIndex === -1) {
          newIndex = history.length - 1;
        } else if (prevIndex > 0) {
          newIndex = prevIndex - 1;
        } else {
          newIndex = prevIndex;
        }
      } else {
        if (prevIndex === -1) {
          return -1;
        } else if (prevIndex < history.length - 1) {
          newIndex = prevIndex + 1;
        } else {
          // At the end, clear input
          setValueState("");
          cursorRef.current = 0;
          setCursorIndexState(0);
          return -1;
        }
      }

      const historyValue = history[newIndex] ?? "";
      setValueState(historyValue);
      cursorRef.current = historyValue.length;
      setCursorIndexState(historyValue.length);
      return newIndex;
    });
  }, [history]);

  const addToHistory = useCallback((command: string) => {
    if (!command.trim()) return;
    setHistory((prev) => {
      // Don't add duplicates of the last command
      if (prev[prev.length - 1] === command) return prev;
      return [...prev, command];
    });
    setHistoryIndex(-1);
  }, []);

  const resetHistoryIndex = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  return {
    value,
    cursorIndex,
    setValue,
    setCursorIndex,
    setValueAndCursor,
    insertText,
    deleteChar,
    moveCursor,
    clear,
    history,
    historyIndex,
    navigateHistory,
    addToHistory,
    resetHistoryIndex,
  };
}
