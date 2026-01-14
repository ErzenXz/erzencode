/**
 * Property-based tests for utility functions.
 * Feature: codebase-refactoring, Property 4: Utility Function Purity
 * Validates: Requirements 7.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  truncate,
  truncatePath,
  stripAnsi,
  wrapText,
  formatTokens,
  formatTime,
  clamp,
  generateId,
  formatBytes,
  formatRelativeTime,
} from "../index.js";

describe("Property 4: Utility Function Purity", () => {
  describe("truncate", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 1, max: 1000 }), (str, len) => {
          const result1 = truncate(str, len);
          const result2 = truncate(str, len);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("output length never exceeds specified length", () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 4, max: 1000 }), (str, len) => {
          const result = truncate(str, len);
          expect(result.length).toBeLessThanOrEqual(len);
        }),
        { numRuns: 100 }
      );
    });

    it("short strings are returned unchanged", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 10 }), (str) => {
          const result = truncate(str, str.length + 10);
          expect(result).toBe(str);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("truncatePath", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 })
            .map((parts) => parts.join("/")),
          fc.integer({ min: 5, max: 100 }),
          (path, maxLen) => {
            const result1 = truncatePath(path, maxLen);
            const result2 = truncatePath(path, maxLen);
            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("stripAnsi", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const result1 = stripAnsi(str);
          const result2 = stripAnsi(str);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("stripping twice is same as stripping once (idempotent)", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const once = stripAnsi(str);
          const twice = stripAnsi(once);
          expect(once).toBe(twice);
        }),
        { numRuns: 100 }
      );
    });

    it("output never contains ANSI escape sequences", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const result = stripAnsi(str);
          expect(result).not.toMatch(/\x1b\[[0-9;]*m/);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("wrapText", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 10, max: 200 }), (str, width) => {
          const result1 = wrapText(str, width);
          const result2 = wrapText(str, width);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("all output lines respect width constraint (for non-empty lines)", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 500 }),
          fc.integer({ min: 10, max: 100 }),
          (str, width) => {
            const lines = wrapText(str, width);
            for (const line of lines) {
              // Empty lines are allowed, non-empty lines should respect width
              if (line.length > 0) {
                expect(line.length).toBeLessThanOrEqual(width);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("formatTokens", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10000000 }), (n) => {
          const result1 = formatTokens(n);
          const result2 = formatTokens(n);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("output is always a non-empty string", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10000000 }), (n) => {
          const result = formatTokens(n);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("formatTime", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 3600000 }), (ms) => {
          const result1 = formatTime(ms);
          const result2 = formatTime(ms);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("output always contains time unit", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 3600000 }), (ms) => {
          const result = formatTime(ms);
          expect(result).toMatch(/[sm]/);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("clamp", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          fc.integer(),
          (n, a, b) => {
            const min = Math.min(a, b);
            const max = Math.max(a, b);
            const result1 = clamp(n, min, max);
            const result2 = clamp(n, min, max);
            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("output is always within bounds", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          fc.integer(),
          (n, a, b) => {
            const min = Math.min(a, b);
            const max = Math.max(a, b);
            const result = clamp(n, min, max);
            expect(result).toBeGreaterThanOrEqual(min);
            expect(result).toBeLessThanOrEqual(max);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("clamping twice is same as clamping once (idempotent)", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          fc.integer(),
          (n, a, b) => {
            const min = Math.min(a, b);
            const max = Math.max(a, b);
            const once = clamp(n, min, max);
            const twice = clamp(once, min, max);
            expect(once).toBe(twice);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("generateId", () => {
    it("always returns a non-empty string", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const result = generateId();
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      // With timestamp + random, collisions should be extremely rare
      expect(ids.size).toBe(100);
    });
  });

  describe("formatBytes", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000000000 }), (bytes) => {
          const result1 = formatBytes(bytes);
          const result2 = formatBytes(bytes);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("output always contains a unit", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000000000 }), (bytes) => {
          const result = formatBytes(bytes);
          expect(result).toMatch(/[BKMGT]/);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("formatRelativeTime", () => {
    it("same inputs always produce same outputs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: Date.now() }), (timestamp) => {
          const result1 = formatRelativeTime(timestamp);
          const result2 = formatRelativeTime(timestamp);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });
  });
});
