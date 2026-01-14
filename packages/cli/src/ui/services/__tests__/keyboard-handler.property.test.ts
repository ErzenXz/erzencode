/**
 * Property-based tests for keyboard handler.
 * Feature: codebase-refactoring, Property 1: Keyboard Input Routing
 * Validates: Requirements 2.2, 2.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  handleKeyboardInput,
  createKeyboardHandler,
  type KeyboardContext,
  type InkKey,
} from "../keyboard-handler.js";

// Default key state (all false)
const defaultKey: InkKey = {
  return: false,
  escape: false,
  tab: false,
  backspace: false,
  delete: false,
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageUp: false,
  pageDown: false,
  ctrl: false,
  meta: false,
  shift: false,
};

// Arbitrary for keyboard context
const contextArb = fc.record({
  stage: fc.constantFrom("welcome", "chat") as fc.Arbitrary<"welcome" | "chat">,
  activeModal: fc.constantFrom(
    "none",
    "models",
    "sessions",
    "settings",
    "help",
    "provider",
    "theme",
    "thinking",
    "apikey",
    "copilot-oauth"
  ) as fc.Arbitrary<KeyboardContext["activeModal"]>,
  isThinking: fc.boolean(),
  autocompleteKind: fc.constantFrom("none", "slash", "file") as fc.Arbitrary<KeyboardContext["autocompleteKind"]>,
  hasBashApprovalPrompt: fc.boolean(),
});

// Arbitrary for key modifiers
const keyArb = fc.record({
  return: fc.boolean(),
  escape: fc.boolean(),
  tab: fc.boolean(),
  backspace: fc.boolean(),
  delete: fc.boolean(),
  upArrow: fc.boolean(),
  downArrow: fc.boolean(),
  leftArrow: fc.boolean(),
  rightArrow: fc.boolean(),
  pageUp: fc.boolean(),
  pageDown: fc.boolean(),
  ctrl: fc.boolean(),
  meta: fc.boolean(),
  shift: fc.boolean(),
});

describe("Property 1: Keyboard Input Routing", () => {
  describe("handleKeyboardInput", () => {
    it("same inputs always produce same outputs (deterministic)", () => {
      fc.assert(
        fc.property(fc.string(), keyArb, contextArb, (inputKey, key, context) => {
          const result1 = handleKeyboardInput(inputKey, key, context);
          const result2 = handleKeyboardInput(inputKey, key, context);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("always returns a valid action object", () => {
      fc.assert(
        fc.property(fc.string(), keyArb, contextArb, (inputKey, key, context) => {
          const result = handleKeyboardInput(inputKey, key, context);
          expect(result).toHaveProperty("type");
          expect(result).toHaveProperty("action");
          expect(typeof result.type).toBe("string");
          expect(typeof result.action).toBe("string");
        }),
        { numRuns: 100 }
      );
    });

    it("routes to welcome handler when stage is welcome", () => {
      const context: KeyboardContext = {
        stage: "welcome",
        activeModal: "none",
        isThinking: false,
        autocompleteKind: "none",
        hasBashApprovalPrompt: false,
      };

      // Enter key should start chat
      const enterResult = handleKeyboardInput("", { ...defaultKey, return: true }, context);
      expect(enterResult.type).toBe("navigation");
      expect(enterResult.action).toBe("start-chat");

      // Other keys should be no-op
      const otherResult = handleKeyboardInput("a", defaultKey, context);
      expect(otherResult.type).toBe("none");
    });

    it("routes to bash approval handler when bash prompt is shown", () => {
      const context: KeyboardContext = {
        stage: "chat",
        activeModal: "none",
        isThinking: false,
        autocompleteKind: "none",
        hasBashApprovalPrompt: true,
      };

      // Escape should cancel
      const escResult = handleKeyboardInput("", { ...defaultKey, escape: true }, context);
      expect(escResult.type).toBe("command");
      expect(escResult.action).toBe("bash-cancel");

      // Up/Down should navigate
      const upResult = handleKeyboardInput("", { ...defaultKey, upArrow: true }, context);
      expect(upResult.type).toBe("navigation");
      expect(upResult.action).toBe("bash-prev");

      const downResult = handleKeyboardInput("", { ...defaultKey, downArrow: true }, context);
      expect(downResult.type).toBe("navigation");
      expect(downResult.action).toBe("bash-next");

      // Enter should select
      const enterResult = handleKeyboardInput("", { ...defaultKey, return: true }, context);
      expect(enterResult.type).toBe("command");
      expect(enterResult.action).toBe("bash-select");
    });

    it("routes to modal handler when modal is open", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("models", "sessions", "settings", "help", "provider", "theme", "thinking") as fc.Arbitrary<KeyboardContext["activeModal"]>,
          (modal) => {
            const context: KeyboardContext = {
              stage: "chat",
              activeModal: modal,
              isThinking: false,
              autocompleteKind: "none",
              hasBashApprovalPrompt: false,
            };

            // Escape should close modal
            const escResult = handleKeyboardInput("", { ...defaultKey, escape: true }, context);
            expect(escResult.type).toBe("modal");
            expect(escResult.action).toBe("close");

            // Up/Down should navigate
            const upResult = handleKeyboardInput("", { ...defaultKey, upArrow: true }, context);
            expect(upResult.type).toBe("modal");
            expect(upResult.action).toBe("navigate-up");

            const downResult = handleKeyboardInput("", { ...defaultKey, downArrow: true }, context);
            expect(downResult.type).toBe("modal");
            expect(downResult.action).toBe("navigate-down");

            // Enter should select
            const enterResult = handleKeyboardInput("", { ...defaultKey, return: true }, context);
            expect(enterResult.type).toBe("modal");
            expect(enterResult.action).toBe("select");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("routes to autocomplete handler when autocomplete is shown", () => {
      const context: KeyboardContext = {
        stage: "chat",
        activeModal: "none",
        isThinking: false,
        autocompleteKind: "slash",
        hasBashApprovalPrompt: false,
      };

      // Up/Down should navigate autocomplete
      const upResult = handleKeyboardInput("", { ...defaultKey, upArrow: true }, context);
      expect(upResult.type).toBe("autocomplete");
      expect(upResult.action).toBe("navigate-up");

      const downResult = handleKeyboardInput("", { ...defaultKey, downArrow: true }, context);
      expect(downResult.type).toBe("autocomplete");
      expect(downResult.action).toBe("navigate-down");

      // Tab should complete
      const tabResult = handleKeyboardInput("", { ...defaultKey, tab: true }, context);
      expect(tabResult.type).toBe("autocomplete");
      expect(tabResult.action).toBe("complete");

      // Enter should select
      const enterResult = handleKeyboardInput("", { ...defaultKey, return: true }, context);
      expect(enterResult.type).toBe("autocomplete");
      expect(enterResult.action).toBe("select");

      // Escape should close
      const escResult = handleKeyboardInput("", { ...defaultKey, escape: true }, context);
      expect(escResult.type).toBe("autocomplete");
      expect(escResult.action).toBe("close");
    });

    it("routes to text input handler for normal input", () => {
      const context: KeyboardContext = {
        stage: "chat",
        activeModal: "none",
        isThinking: false,
        autocompleteKind: "none",
        hasBashApprovalPrompt: false,
      };

      // Printable characters should insert
      const charResult = handleKeyboardInput("a", defaultKey, context);
      expect(charResult.type).toBe("input");
      expect(charResult.action).toBe("insert");
      expect(charResult.payload).toBe("a");

      // Backspace should delete backward
      const bsResult = handleKeyboardInput("", { ...defaultKey, backspace: true }, context);
      expect(bsResult.type).toBe("input");
      expect(bsResult.action).toBe("backspace");

      // Arrow keys should move cursor
      const leftResult = handleKeyboardInput("", { ...defaultKey, leftArrow: true }, context);
      expect(leftResult.type).toBe("input");
      expect(leftResult.action).toBe("cursor-left");

      const rightResult = handleKeyboardInput("", { ...defaultKey, rightArrow: true }, context);
      expect(rightResult.type).toBe("input");
      expect(rightResult.action).toBe("cursor-right");

      // Enter should submit
      const enterResult = handleKeyboardInput("", { ...defaultKey, return: true }, context);
      expect(enterResult.type).toBe("command");
      expect(enterResult.action).toBe("submit");

      // Ctrl+Enter should insert newline
      const ctrlEnterResult = handleKeyboardInput("", { ...defaultKey, return: true, ctrl: true }, context);
      expect(ctrlEnterResult.type).toBe("input");
      expect(ctrlEnterResult.action).toBe("newline");
    });

    it("Ctrl+C always exits regardless of context", () => {
      fc.assert(
        fc.property(contextArb, (context) => {
          // Skip welcome stage as it has different handling
          if (context.stage === "welcome") return;
          // Skip bash approval as it has priority
          if (context.hasBashApprovalPrompt) return;

          const result = handleKeyboardInput("c", { ...defaultKey, ctrl: true }, context);
          expect(result.type).toBe("exit");
          expect(result.action).toBe("exit");
        }),
        { numRuns: 100 }
      );
    });

    it("routes to history navigation when up/down pressed and no modal", () => {
      const context: KeyboardContext = {
        stage: "chat",
        activeModal: "none",
        isThinking: false,
        autocompleteKind: "none",
        hasBashApprovalPrompt: false,
      };

      const upResult = handleKeyboardInput("", { ...defaultKey, upArrow: true }, context);
      expect(upResult.type).toBe("history");
      expect(upResult.action).toBe("navigate-up");

      const downResult = handleKeyboardInput("", { ...defaultKey, downArrow: true }, context);
      expect(downResult.type).toBe("history");
      expect(downResult.action).toBe("navigate-down");
    });

    it("routes to cancel action when escape pressed while thinking", () => {
      const context: KeyboardContext = {
        stage: "chat",
        activeModal: "none",
        isThinking: true,
        autocompleteKind: "none",
        hasBashApprovalPrompt: false,
      };

      const result = handleKeyboardInput("", { ...defaultKey, escape: true }, context);
      expect(result.type).toBe("cancel");
      expect(result.action).toBe("cancel");
    });
  });

  describe("createKeyboardHandler", () => {
    it("creates a handler with handleInput method", () => {
      const handler = createKeyboardHandler();
      expect(typeof handler.handleInput).toBe("function");
    });

    it("handler.handleInput is pure", () => {
      fc.assert(
        fc.property(fc.string(), keyArb, contextArb, (inputKey, key, context) => {
          const handler = createKeyboardHandler();
          const result1 = handler.handleInput(inputKey, key, context);
          const result2 = handler.handleInput(inputKey, key, context);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });
  });
});
