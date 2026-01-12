/**
 * Custom hook for managing session state in the Terminal UI.
 * Handles multiple sessions and message management.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import type { SessionState, ChatMessage } from "../types/index.js";
import type { ProviderType } from "../../ai-provider.js";
import {
  createSession,
  addMessage as addMessageToSession,
  updateMessage as updateMessageInSession,
  clearMessages as clearSessionMessages,
} from "../services/session-service.js";

/**
 * Return type for the useSessionState hook.
 */
export interface UseSessionStateReturn {
  /** All sessions */
  sessions: SessionState[];
  /** Current session */
  currentSession: SessionState;
  /** Current session ID */
  currentSessionId: string;
  /** Create a new session */
  createNewSession: (name?: string) => void;
  /** Switch to a different session */
  switchSession: (id: string) => void;
  /** Update a session */
  updateSession: (id: string, updates: Partial<SessionState>) => void;
  /** Delete a session */
  deleteSession: (id: string) => void;
  /** Add a message to the current session */
  addMessage: (message: ChatMessage) => void;
  /** Update a message in the current session */
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  /** Clear messages in the current session */
  clearMessages: () => void;
  /** Get messages from the current session */
  messages: ChatMessage[];
}

/**
 * Hook for managing session state.
 * @param workingDirectory - Working directory for new sessions
 * @param provider - Default AI provider
 * @param model - Default AI model
 * @returns Session state and manipulation functions
 */
export function useSessionState(
  workingDirectory: string,
  provider: ProviderType = "openai",
  model: string = "gpt-4o"
): UseSessionStateReturn {
  const sessionCounterRef = useRef(1);

  // Initialize with one session
  const [sessions, setSessions] = useState<SessionState[]>(() => {
    const initial = createSession(
      workingDirectory,
      "Session 1",
      provider,
      model
    );
    return [initial];
  });

  const [currentSessionId, setCurrentSessionId] = useState(
    () => sessions[0]?.id ?? ""
  );

  // Memoize current session lookup
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId) ?? sessions[0]!;
  }, [sessions, currentSessionId]);

  const messages = currentSession.messages;

  const createNewSession = useCallback(
    (name?: string) => {
      sessionCounterRef.current += 1;
      const sessionName = name ?? `Session ${sessionCounterRef.current}`;
      const newSession = createSession(
        workingDirectory,
        sessionName,
        provider,
        model
      );
      setSessions((prev) => [...prev, newSession]);
      setCurrentSessionId(newSession.id);
    },
    [workingDirectory, provider, model]
  );

  const switchSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const updateSession = useCallback(
    (id: string, updates: Partial<SessionState>) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
        )
      );
    },
    []
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        // Ensure at least one session exists
        if (filtered.length === 0) {
          const newSession = createSession(
            workingDirectory,
            "Session 1",
            provider,
            model
          );
          return [newSession];
        }
        return filtered;
      });
      // If deleting current session, switch to first available
      setCurrentSessionId((prevId) => {
        if (prevId === id) {
          const remaining = sessions.filter((s) => s.id !== id);
          return remaining[0]?.id ?? "";
        }
        return prevId;
      });
    },
    [sessions, workingDirectory, provider, model]
  );

  const addMessage = useCallback(
    (message: ChatMessage) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? addMessageToSession(s, message) : s
        )
      );
    },
    [currentSessionId]
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? updateMessageInSession(s, messageId, updates)
            : s
        )
      );
    },
    [currentSessionId]
  );

  const clearMessages = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId ? clearSessionMessages(s) : s
      )
    );
  }, [currentSessionId]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    createNewSession,
    switchSession,
    updateSession,
    deleteSession,
    addMessage,
    updateMessage,
    clearMessages,
    messages,
  };
}
