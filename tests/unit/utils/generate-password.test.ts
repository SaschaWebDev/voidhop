/**
 * `generatePassword` returns a 16–24 character string drawn from a curated
 * charset that excludes visually-ambiguous glyphs (0/O, 1/l/I). The test
 * exercises the length and charset invariants over many samples — the
 * randomness itself is provided by Web Crypto, which we trust.
 */

import { describe, expect, it } from "vitest";
import { generatePassword } from "@/utils/generate-password";

const ALLOWED = new Set(
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*_".split(""),
);
// The charset excludes 0, O, o, 1, l, I (uppercase `L` and lowercase `i`
// are kept — they look unambiguous in most monospace fonts).
const FORBIDDEN = "0Oo1lI";

describe("generatePassword", () => {
  it("returns a string of length 16-24", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword();
      expect(pw.length).toBeGreaterThanOrEqual(16);
      expect(pw.length).toBeLessThanOrEqual(24);
    }
  });

  it("uses only chars from the curated charset", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword();
      for (const ch of pw) {
        expect(ALLOWED.has(ch)).toBe(true);
      }
    }
  });

  it("never emits visually-ambiguous chars (0, O, o, 1, l, I)", () => {
    for (let i = 0; i < 500; i++) {
      const pw = generatePassword();
      for (const ch of FORBIDDEN) {
        expect(pw.includes(ch)).toBe(false);
      }
    }
  });

  it("produces distinct outputs across calls (probabilistic)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generatePassword());
    // Even at min length 16 with 64-char alphabet, collisions in 50 draws
    // would require ~10^-23 odds.
    expect(seen.size).toBe(50);
  });

  it("covers the full length range over many samples (smoke)", () => {
    const lengths = new Set<number>();
    for (let i = 0; i < 1000; i++) lengths.add(generatePassword().length);
    expect(lengths.size).toBeGreaterThan(1);
    for (const n of lengths) {
      expect(n).toBeGreaterThanOrEqual(16);
      expect(n).toBeLessThanOrEqual(24);
    }
  });
});
