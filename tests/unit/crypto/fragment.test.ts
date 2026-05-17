import { describe, expect, it } from "vitest";
import { assembleFragment, parseFragment } from "@/crypto/fragment";
import {
  AES_KEY_B64URL_LENGTH,
  FRAGMENT_SALT_SEPARATOR,
  PASSWORD_SALT_B64URL_LENGTH,
} from "@/constants";

const KEY = "A".repeat(AES_KEY_B64URL_LENGTH);
const SALT = "B".repeat(PASSWORD_SALT_B64URL_LENGTH);

describe("assembleFragment", () => {
  it("returns the key alone for v1 (no salt)", () => {
    expect(assembleFragment(KEY, null)).toBe(KEY);
  });

  it("joins key and salt with the separator for v2", () => {
    expect(assembleFragment(KEY, SALT)).toBe(
      `${KEY}${FRAGMENT_SALT_SEPARATOR}${SALT}`,
    );
  });

  it("is a pure function of its inputs", () => {
    const a = assembleFragment(KEY, null);
    const b = assembleFragment(KEY, null);
    expect(a).toBe(b);
  });
});

describe("parseFragment", () => {
  function expectV1(fragment: string): void {
    const result = parseFragment(fragment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keyB64url).toBe(KEY);
    expect(result.saltB64url).toBeNull();
  }

  it("parses v1 fragments (key only) with a leading #", () => {
    expectV1(`#${KEY}`);
  });

  it("parses v1 fragments without a leading #", () => {
    expectV1(KEY);
  });

  it("parses v2 fragments (key + salt)", () => {
    const result = parseFragment(
      `#${KEY}${FRAGMENT_SALT_SEPARATOR}${SALT}`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keyB64url).toBe(KEY);
    expect(result.saltB64url).toBe(SALT);
  });

  it("round-trips with assembleFragment for v1 and v2", () => {
    expect(parseFragment(assembleFragment(KEY, null))).toEqual({
      ok: true,
      keyB64url: KEY,
      saltB64url: null,
    });
    expect(parseFragment(assembleFragment(KEY, SALT))).toEqual({
      ok: true,
      keyB64url: KEY,
      saltB64url: SALT,
    });
  });

  it("rejects fragments with the wrong key length", () => {
    const result = parseFragment("#tooShort");
    expect(result).toEqual({ ok: false, error: "MISSING_KEY" });
  });

  it("rejects empty fragments", () => {
    expect(parseFragment("")).toEqual({ ok: false, error: "MISSING_KEY" });
    expect(parseFragment("#")).toEqual({ ok: false, error: "MISSING_KEY" });
  });

  it("rejects v2 fragments with the wrong salt length", () => {
    const result = parseFragment(`${KEY}${FRAGMENT_SALT_SEPARATOR}short`);
    expect(result).toEqual({ ok: false, error: "MISSING_SALT" });
  });

  it("strips a secondary # defensively", () => {
    expectV1(`#${KEY}#trailing-garbage`);
  });
});
