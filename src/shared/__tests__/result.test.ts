import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  isOk,
  isErr,
  all,
  tryCatch,
  tryCatchAsync,
  type Result,
} from "../result.js";

describe("Result type", () => {
  describe("ok", () => {
    it("creates an Ok result with the given value", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it("works with different types", () => {
      expect(ok("hello").value).toBe("hello");
      expect(ok({ a: 1 }).value).toEqual({ a: 1 });
      expect(ok([1, 2, 3]).value).toEqual([1, 2, 3]);
      expect(ok(null).value).toBe(null);
      expect(ok(undefined).value).toBe(undefined);
    });
  });

  describe("err", () => {
    it("creates an Err result with the given error", () => {
      const error = new Error("test error");
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });

    it("works with different error types", () => {
      expect(err("string error").error).toBe("string error");
      expect(err({ code: 404 }).error).toEqual({ code: 404 });
      expect(err(42).error).toBe(42);
    });
  });

  describe("map", () => {
    it("applies function to Ok value", () => {
      const result = ok(5);
      const mapped = map(result, (x) => x * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(10);
      }
    });

    it("passes through Err unchanged", () => {
      const error = new Error("test");
      const result: Result<number, Error> = err(error);
      const mapped = map(result, (x: number) => x * 2);
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe(error);
      }
    });

    it("can change the type", () => {
      const result = ok(42);
      const mapped = map(result, (x) => x.toString());
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe("42");
      }
    });
  });

  describe("flatMap", () => {
    it("chains Ok results", () => {
      const result = ok(5);
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe(10);
      }
    });

    it("short-circuits on first Err", () => {
      const result = ok(5);
      const error = new Error("failed");
      const chained = flatMap(result, () => err(error));
      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe(error);
      }
    });

    it("passes through initial Err", () => {
      const error = new Error("initial");
      const result: Result<number, Error> = err(error);
      const chained = flatMap(result, (x: number) => ok(x * 2));
      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe(error);
      }
    });
  });

  describe("unwrap", () => {
    it("returns value for Ok", () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it("throws error for Err", () => {
      const error = new Error("test");
      expect(() => unwrap(err(error))).toThrow(error);
    });
  });

  describe("unwrapOr", () => {
    it("returns value for Ok", () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it("returns default for Err", () => {
      const result: Result<number, Error> = err(new Error("test"));
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe("isOk", () => {
    it("returns true for Ok", () => {
      expect(isOk(ok(42))).toBe(true);
    });

    it("returns false for Err", () => {
      expect(isOk(err(new Error()))).toBe(false);
    });

    it("narrows type correctly", () => {
      const result: Result<number, Error> = ok(42);
      if (isOk(result)) {
        // TypeScript should know result.value exists here
        expect(result.value).toBe(42);
      }
    });
  });

  describe("isErr", () => {
    it("returns false for Ok", () => {
      expect(isErr(ok(42))).toBe(false);
    });

    it("returns true for Err", () => {
      expect(isErr(err(new Error()))).toBe(true);
    });

    it("narrows type correctly", () => {
      const result: Result<number, Error> = err(new Error("test"));
      if (isErr(result)) {
        // TypeScript should know result.error exists here
        expect(result.error.message).toBe("test");
      }
    });
  });

  describe("all", () => {
    it("combines all Ok results into array", () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = all(results);
      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it("returns first Err encountered", () => {
      const error = new Error("second failed");
      const results: Result<number, Error>[] = [
        ok(1),
        err(error),
        ok(3),
      ];
      const combined = all(results);
      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toBe(error);
      }
    });

    it("handles empty array", () => {
      const combined = all([]);
      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toEqual([]);
      }
    });
  });

  describe("tryCatch", () => {
    it("returns Ok for successful function", () => {
      const safeDivide = tryCatch((a: number, b: number) => {
        if (b === 0) throw new Error("Division by zero");
        return a / b;
      });

      const result = safeDivide(10, 2);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5);
      }
    });

    it("returns Err for throwing function", () => {
      const safeDivide = tryCatch((a: number, b: number) => {
        if (b === 0) throw new Error("Division by zero");
        return a / b;
      });

      const result = safeDivide(10, 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Division by zero");
      }
    });

    it("converts non-Error throws to Error", () => {
      const throwString = tryCatch(() => {
        throw "string error";
      });

      const result = throwString();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe("string error");
      }
    });
  });

  describe("tryCatchAsync", () => {
    it("returns Ok for successful async function", async () => {
      const safeAsync = tryCatchAsync(async (x: number) => {
        return x * 2;
      });

      const result = await safeAsync(5);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(10);
      }
    });

    it("returns Err for rejecting async function", async () => {
      const safeAsync = tryCatchAsync(async () => {
        throw new Error("async error");
      });

      const result = await safeAsync();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("async error");
      }
    });

    it("converts non-Error rejects to Error", async () => {
      const safeAsync = tryCatchAsync(async () => {
        throw "string rejection";
      });

      const result = await safeAsync();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe("string rejection");
      }
    });
  });
});
