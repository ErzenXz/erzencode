/**
 * Property-based tests for tool formatters.
 * Feature: codebase-refactoring, Property 2: Tool Formatter Purity
 * Validates: Requirements 7.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  formatToolInputSummary,
  formatToolOutput,
  getToolDisplayInfo,
  createToolFormatter,
} from "../tool-formatters.js";

// Arbitrary for tool names
const toolNameArb = fc.constantFrom(
  "read",
  "read_file",
  "write",
  "write_file",
  "edit",
  "edit_file",
  "bash",
  "execute_command",
  "grep",
  "glob",
  "task",
  "todowrite",
  "webfetch",
  "unknown_tool"
);

// Arbitrary for tool arguments
const toolArgsArb = fc.oneof(
  fc.constant(undefined),
  fc.record({
    path: fc.option(fc.string(), { nil: undefined }),
    filePath: fc.option(fc.string(), { nil: undefined }),
    content: fc.option(fc.string(), { nil: undefined }),
    command: fc.option(fc.string(), { nil: undefined }),
    pattern: fc.option(fc.string(), { nil: undefined }),
    description: fc.option(fc.string(), { nil: undefined }),
    url: fc.option(fc.webUrl(), { nil: undefined }),
  })
);

// Arbitrary for tool output
const toolOutputArb = fc.oneof(
  fc.constant(""),
  fc.string(),
  fc.json().map((j) => JSON.stringify(j)),
  fc.record({
    success: fc.boolean(),
    error: fc.option(fc.string(), { nil: undefined }),
    lines: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
    linesAdded: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    linesRemoved: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    patch: fc.option(fc.string(), { nil: undefined }),
    stdout: fc.option(fc.string(), { nil: undefined }),
    exit_code: fc.option(fc.integer({ min: 0, max: 255 }), { nil: undefined }),
    totalLines: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    matches: fc.option(
      fc.array(fc.record({ file: fc.string() }), { maxLength: 10 }),
      { nil: undefined }
    ),
    files: fc.option(fc.array(fc.string(), { maxLength: 10 }), { nil: undefined }),
    message: fc.option(fc.string(), { nil: undefined }),
  }).map((obj) => JSON.stringify(obj))
);

describe("Property 2: Tool Formatter Purity", () => {
  describe("formatToolInputSummary", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(toolNameArb, toolArgsArb, fc.option(fc.string(), { nil: undefined }), (name, args, workspace) => {
          const result1 = formatToolInputSummary(name, args, workspace ?? undefined);
          const result2 = formatToolInputSummary(name, args, workspace ?? undefined);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("always returns a string", () => {
      fc.assert(
        fc.property(toolNameArb, toolArgsArb, (name, args) => {
          const result = formatToolInputSummary(name, args);
          expect(typeof result).toBe("string");
        }),
        { numRuns: 100 }
      );
    });

    it("handles undefined args gracefully", () => {
      fc.assert(
        fc.property(toolNameArb, (name) => {
          const result = formatToolInputSummary(name, undefined);
          expect(result).toBe("");
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("formatToolOutput", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(toolNameArb, toolOutputArb, (name, output) => {
          const result1 = formatToolOutput(name, output);
          const result2 = formatToolOutput(name, output);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("always returns a FormattedOutput object", () => {
      fc.assert(
        fc.property(toolNameArb, toolOutputArb, (name, output) => {
          const result = formatToolOutput(name, output);
          expect(result).toHaveProperty("lines");
          expect(result).toHaveProperty("isError");
          expect(Array.isArray(result.lines)).toBe(true);
          expect(typeof result.isError).toBe("boolean");
        }),
        { numRuns: 100 }
      );
    });

    it("handles empty output gracefully", () => {
      fc.assert(
        fc.property(toolNameArb, (name) => {
          const result = formatToolOutput(name, "");
          expect(result.lines).toEqual([]);
          expect(result.isError).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("limits output lines", () => {
      fc.assert(
        fc.property(toolNameArb, fc.string({ minLength: 1000, maxLength: 5000 }), (name, output) => {
          const result = formatToolOutput(name, output);
          // Should not exceed MAX_OUTPUT_LINES + 1 (for the "more" indicator)
          expect(result.lines.length).toBeLessThanOrEqual(11);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("getToolDisplayInfo", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.string(), (name) => {
          const result1 = getToolDisplayInfo(name);
          const result2 = getToolDisplayInfo(name);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("always returns an object with label and icon", () => {
      fc.assert(
        fc.property(fc.string(), (name) => {
          const result = getToolDisplayInfo(name);
          expect(result).toHaveProperty("label");
          expect(result).toHaveProperty("icon");
          expect(typeof result.label).toBe("string");
          expect(typeof result.icon).toBe("string");
        }),
        { numRuns: 100 }
      );
    });

    it("returns known config for known tools", () => {
      const knownTools = ["read", "write", "edit", "bash", "grep", "glob"];
      for (const tool of knownTools) {
        const result = getToolDisplayInfo(tool);
        expect(result.label).not.toBe(tool); // Should have a friendly label
      }
    });
  });

  describe("createToolFormatter", () => {
    it("creates a formatter with all required methods", () => {
      const formatter = createToolFormatter();
      expect(typeof formatter.formatInputSummary).toBe("function");
      expect(typeof formatter.formatOutput).toBe("function");
      expect(typeof formatter.getDisplayInfo).toBe("function");
    });

    it("formatter methods are pure", () => {
      fc.assert(
        fc.property(
          fc.option(fc.string(), { nil: undefined }),
          toolNameArb,
          toolArgsArb,
          toolOutputArb,
          (workspace, name, args, output) => {
            const formatter = createToolFormatter(workspace ?? undefined);
            
            // Test formatInputSummary purity
            const input1 = formatter.formatInputSummary(name, args);
            const input2 = formatter.formatInputSummary(name, args);
            expect(input1).toBe(input2);
            
            // Test formatOutput purity
            const out1 = formatter.formatOutput(name, output);
            const out2 = formatter.formatOutput(name, output);
            expect(out1).toEqual(out2);
            
            // Test getDisplayInfo purity
            const info1 = formatter.getDisplayInfo(name);
            const info2 = formatter.getDisplayInfo(name);
            expect(info1).toEqual(info2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
