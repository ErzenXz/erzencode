/**
 * Property-based tests for command handler.
 * Feature: codebase-refactoring, Property 3: Service Result Types
 * Validates: Requirements 8.1
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseCommand,
  getCompletions,
  isCommand,
  getCommand,
  resolveCommandName,
  validateCommandArgs,
  getCommandAction,
  createCommandHandler,
} from "../command-handler.js";
import { SLASH_COMMANDS } from "../../types/ui-state.js";

// Arbitrary for valid command names
const validCommandArb = fc.constantFrom(...SLASH_COMMANDS.map((c) => c.name));

// Arbitrary for command aliases
const validAliasArb = fc.constantFrom(
  ...SLASH_COMMANDS.flatMap((c) => c.aliases ?? [])
);

// Arbitrary for invalid command names (no spaces, no valid commands/aliases)
const invalidCommandArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => {
    // Get the first word (what would be parsed as the command)
    const firstWord = s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!firstWord) return false;
    return !SLASH_COMMANDS.some(
      (c) => c.name === firstWord || c.aliases?.some((a) => a === firstWord)
    );
  });

describe("Property 3: Service Result Types", () => {
  describe("parseCommand", () => {
    it("returns null for non-command input", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.trim().startsWith("/")),
          (input) => {
            const result = parseCommand(input);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("returns ParsedCommand for valid command format", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z]+$/.test(s)),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
          (cmd, args) => {
            const input = `/${cmd} ${args.join(" ")}`.trim();
            const result = parseCommand(input);
            expect(result).not.toBeNull();
            expect(result?.command).toBe(cmd.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result1 = parseCommand(input);
          const result2 = parseCommand(input);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("getCompletions", () => {
    it("returns all commands for single slash", () => {
      const result = getCompletions("/");
      expect(result).toEqual(SLASH_COMMANDS);
    });

    it("returns empty array for non-slash input", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.startsWith("/")),
          (input) => {
            const result = getCompletions(input);
            expect(result).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("returns matching commands for partial input", () => {
      fc.assert(
        fc.property(validCommandArb, (cmd) => {
          // Test with first 1-3 characters
          for (let i = 1; i <= Math.min(3, cmd.length); i++) {
            const partial = `/${cmd.slice(0, i)}`;
            const result = getCompletions(partial);
            // The original command should be in the results
            expect(result.some((c) => c.name === cmd)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result1 = getCompletions(input);
          const result2 = getCompletions(input);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("isCommand", () => {
    it("returns true for valid commands", () => {
      fc.assert(
        fc.property(validCommandArb, (cmd) => {
          expect(isCommand(`/${cmd}`)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("returns true for valid aliases", () => {
      fc.assert(
        fc.property(validAliasArb, (alias) => {
          expect(isCommand(`/${alias}`)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("returns false for invalid commands", () => {
      fc.assert(
        fc.property(invalidCommandArb, (cmd) => {
          expect(isCommand(`/${cmd}`)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("getCommand", () => {
    it("returns command for valid name", () => {
      fc.assert(
        fc.property(validCommandArb, (cmd) => {
          const result = getCommand(cmd);
          expect(result).toBeDefined();
          expect(result?.name).toBe(cmd);
        }),
        { numRuns: 100 }
      );
    });

    it("returns command for valid alias", () => {
      fc.assert(
        fc.property(validAliasArb, (alias) => {
          const result = getCommand(alias);
          expect(result).toBeDefined();
          expect(result?.aliases).toContain(alias);
        }),
        { numRuns: 100 }
      );
    });

    it("returns undefined for invalid name", () => {
      fc.assert(
        fc.property(invalidCommandArb, (cmd) => {
          const result = getCommand(cmd);
          expect(result).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("validateCommandArgs - Result type usage", () => {
    it("returns Result.ok for valid commands without required args", () => {
      const noArgCommands = ["help", "models", "sessions", "settings", "theme"];
      for (const cmd of noArgCommands) {
        const result = validateCommandArgs(cmd, []);
        expect(result.ok).toBe(true);
      }
    });

    it("returns Result.err for unknown commands", () => {
      fc.assert(
        fc.property(invalidCommandArb, (cmd) => {
          const result = validateCommandArgs(cmd, []);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.type).toBe("invalid_command");
            expect(typeof result.error.message).toBe("string");
          }
        }),
        { numRuns: 100 }
      );
    });

    it("returns Result.err for commands missing required args", () => {
      const result = validateCommandArgs("image", []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("missing_args");
      }
    });

    it("returns Result.ok for commands with required args provided", () => {
      const result = validateCommandArgs("image", ["/path/to/image.png"]);
      expect(result.ok).toBe(true);
    });

    it("Result type is always properly structured", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.array(fc.string(), { maxLength: 5 }),
          (cmd, args) => {
            const result = validateCommandArgs(cmd, args);
            // Result should always have 'ok' property
            expect(typeof result.ok).toBe("boolean");
            if (result.ok) {
              // Ok result should have 'value' property
              expect(result).toHaveProperty("value");
            } else {
              // Err result should have 'error' property with proper structure
              expect(result).toHaveProperty("error");
              expect(result.error).toHaveProperty("type");
              expect(result.error).toHaveProperty("message");
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("getCommandAction", () => {
    it("returns openModal action for modal commands", () => {
      const modalCommands = ["help", "models", "sessions", "settings", "theme", "thinking", "provider"];
      for (const cmd of modalCommands) {
        const action = getCommandAction(cmd);
        expect(action.type).toBe("openModal");
      }
    });

    it("returns navigate action for navigation commands", () => {
      const navCommands = ["web", "vibe"];
      for (const cmd of navCommands) {
        const action = getCommandAction(cmd);
        expect(action.type).toBe("navigate");
      }
    });

    it("returns exit action for exit command", () => {
      const action = getCommandAction("exit");
      expect(action.type).toBe("exit");
    });

    it("returns none action for unknown commands", () => {
      fc.assert(
        fc.property(invalidCommandArb, (cmd) => {
          const action = getCommandAction(cmd);
          expect(action.type).toBe("none");
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("createCommandHandler", () => {
    it("creates a handler with all required methods", () => {
      const handler = createCommandHandler();
      expect(typeof handler.parseCommand).toBe("function");
      expect(typeof handler.getCompletions).toBe("function");
      expect(typeof handler.isCommand).toBe("function");
      expect(typeof handler.getCommand).toBe("function");
    });

    it("handler methods are pure", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const handler = createCommandHandler();
          
          const parse1 = handler.parseCommand(input);
          const parse2 = handler.parseCommand(input);
          expect(parse1).toEqual(parse2);
          
          const comp1 = handler.getCompletions(input);
          const comp2 = handler.getCompletions(input);
          expect(comp1).toEqual(comp2);
          
          const is1 = handler.isCommand(input);
          const is2 = handler.isCommand(input);
          expect(is1).toBe(is2);
        }),
        { numRuns: 100 }
      );
    });
  });
});
