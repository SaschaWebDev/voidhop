/**
 * Validates the hextet predicate used by the IPv6 expander. Each rejected
 * char-range matters: a single off-by-one in the charset check would let
 * malformed IPv6 strings pass and end up as a rate-limit bucket key.
 */

import { describe, expect, it } from "vitest";
import { isValidHextet } from "../../../worker/middleware/rate-limit";

describe("isValidHextet", () => {
  it("accepts 1-4 char hex strings, mixed case", () => {
    expect(isValidHextet("0")).toBe(true);
    expect(isValidHextet("a")).toBe(true);
    expect(isValidHextet("F")).toBe(true);
    expect(isValidHextet("ff")).toBe(true);
    expect(isValidHextet("dead")).toBe(true);
    expect(isValidHextet("BEEF")).toBe(true);
    expect(isValidHextet("AbCd")).toBe(true);
  });

  it("accepts zero-padded forms", () => {
    expect(isValidHextet("0000")).toBe(true);
    expect(isValidHextet("00ff")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidHextet("")).toBe(false);
  });

  it("rejects strings longer than 4 chars", () => {
    expect(isValidHextet("12345")).toBe(false);
    expect(isValidHextet("00000")).toBe(false);
  });

  it("rejects non-hex chars", () => {
    expect(isValidHextet("g")).toBe(false);
    expect(isValidHextet("z")).toBe(false);
    expect(isValidHextet("G")).toBe(false);
    expect(isValidHextet("00g0")).toBe(false);
    expect(isValidHextet("-1")).toBe(false);
    expect(isValidHextet(" 0")).toBe(false);
    expect(isValidHextet("0 ")).toBe(false);
    expect(isValidHextet("0x1")).toBe(false);
  });

  it("rejects whitespace and punctuation in any position", () => {
    expect(isValidHextet(":")).toBe(false);
    expect(isValidHextet("a:b")).toBe(false);
    expect(isValidHextet(".")).toBe(false);
  });

  it("rejects unicode digits and letters", () => {
    expect(isValidHextet("０")).toBe(false); // full-width zero
    expect(isValidHextet("á")).toBe(false);
  });
});
