/**
 * File autocomplete hook for the Web UI.
 * Provides @mention file autocomplete.
 */

import { useState, useCallback, useEffect } from "react";

export interface FileAutocompleteContext {
  query: string;
  startIndex: number;
  endIndex: number;
}

export interface UseFileAutocompleteReturn {
  /** Matching file paths */
  files: string[];
  /** Current autocomplete context */
  context: FileAutocompleteContext | null;
  /** Check if a position has an @mention */
  getAtMentionAtCursor: (value: string, cursorIndex: number) => FileAutocompleteContext | null;
  /** Handle input change for autocomplete */
  handleInputChange: (value: string, cursorIndex: number) => void;
  /** Select a file */
  selectFile: (filePath: string, value: string, cursorIndex: number) => string;
  /** Navigate selection */
  navigate: (direction: "up" | "down") => void;
  /** Selected index */
  selectedIndex: number;
  /** Show autocomplete */
  showAutocomplete: boolean;
  /** Reset state */
  reset: () => void;
}

export function useFileAutocomplete(sessionId?: string): UseFileAutocompleteReturn {
  const [files, setFiles] = useState<string[]>([]);
  const [context, setContext] = useState<FileAutocompleteContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Get @mention context at cursor
  const getAtMentionAtCursor = useCallback((
    value: string,
    cursorIndex: number
  ): FileAutocompleteContext | null => {
    // Find the @ symbol before cursor
    const beforeCursor = value.slice(0, cursorIndex);
    const atMatch = beforeCursor.match(/@(\w*)$/);

    if (!atMatch) {
      return null;
    }

    const startIndex = cursorIndex - atMatch[0].length;
    return {
      query: atMatch[1],
      startIndex,
      endIndex: cursorIndex,
    };
  }, []);

  // Handle input change
  const handleInputChange = useCallback(async (
    value: string,
    cursorIndex: number
  ) => {
    const atContext = getAtMentionAtCursor(value, cursorIndex);

    if (!atContext) {
      setShowAutocomplete(false);
      setContext(null);
      setFiles([]);
      return;
    }

    setContext(atContext);
    setSelectedIndex(0);

    // Skip if query is empty
    if (!atContext.query) {
      setFiles([]);
      setShowAutocomplete(false);
      return;
    }

    // Fetch file suggestions
    try {
      const params = new URLSearchParams({
        query: atContext.query,
        ...(sessionId && { sessionId }),
      });
      const res = await fetch(`/api/files/autocomplete?${params}`);
      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);
        setShowAutocomplete(data.files.length > 0);
      }
    } catch {
      setFiles([]);
      setShowAutocomplete(false);
    }
  }, [getAtMentionAtCursor, sessionId]);

  // Select a file
  const selectFile = useCallback((
    filePath: string,
    value: string,
    cursorIndex: number
  ): string => {
    if (!context) {
      return value;
    }

    const before = value.slice(0, context.startIndex);
    const after = value.slice(context.endIndex);
    return `${before}@${filePath} ${after}`;
  }, [context]);

  // Navigate selection
  const navigate = useCallback((direction: "up" | "down") => {
    if (!showAutocomplete || files.length === 0) return;

    setSelectedIndex((prev) => {
      if (direction === "up") {
        return prev > 0 ? prev - 1 : files.length - 1;
      } else {
        return prev < files.length - 1 ? prev + 1 : 0;
      }
    });
  }, [showAutocomplete, files.length]);

  // Reset state
  const reset = useCallback(() => {
    setShowAutocomplete(false);
    setContext(null);
    setFiles([]);
    setSelectedIndex(0);
  }, []);

  return {
    files,
    context,
    getAtMentionAtCursor,
    handleInputChange,
    selectFile,
    navigate,
    selectedIndex,
    showAutocomplete,
    reset,
  };
}
