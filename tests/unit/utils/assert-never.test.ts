/**
 * `assertNever` is the runtime guard backing every exhaustive switch in the
 * codebase. Its compile-time job is to fail TS narrowing if a new variant is
 * added; its runtime job is to throw a useful error if a stray value ever
 * sneaks past type-checking (e.g. from `JSON.parse`-shaped input).
 */

import { describe, expect, it, vi } from "vitest";
import { assertNever } from "@/utils/assert-never";

describe("assertNever", () => {
  it("throws when called with any value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(() => assertNever("surprise" as never)).toThrowError(
        /unexpected union variant: surprise/,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("includes a String() of the offending value in the message", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(() => assertNever(42 as never)).toThrowError(
        /unexpected union variant: 42/,
      );
      expect(() => assertNever(null as never)).toThrowError(
        /unexpected union variant: null/,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("logs a console.warn before throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(() => assertNever("oops" as never)).toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/assertNever/);
    } finally {
      warn.mockRestore();
    }
  });
});
