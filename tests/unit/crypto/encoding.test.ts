import { describe, expect, it } from "vitest";
import {
  base64urlEncode,
  base64urlDecode,
  Base64UrlError,
} from "@/crypto/encoding";

describe("base64url encoding", () => {
  it("encodes empty input to empty string", () => {
    expect(base64urlEncode(new Uint8Array(0))).toBe("");
  });

  it("round-trips for 0..6 byte inputs (all padding variants)", () => {
    for (let len = 0; len <= 6; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 31 + 7) & 0xff;
      const encoded = base64urlEncode(bytes);
      const decoded = base64urlDecode(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    }
  });

  it("round-trips for 32-byte AES key length and produces exactly 43 chars", () => {
    const key = new Uint8Array(32);
    for (let i = 0; i < 32; i++) key[i] = i * 7;
    const encoded = base64urlEncode(key);
    expect(encoded.length).toBe(43);
    const decoded = base64urlDecode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(key));
  });

  it("output uses only the URL-safe alphabet", () => {
    const bytes = new Uint8Array(1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff;
    const encoded = base64urlEncode(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("rejects invalid characters", () => {
    expect(() => base64urlDecode("abc!")).toThrow(Base64UrlError);
    expect(() => base64urlDecode("abc=")).toThrow(Base64UrlError);
    expect(() => base64urlDecode("abc/")).toThrow(Base64UrlError);
  });

  it("rejects structurally impossible lengths", () => {
    // Length ≡ 1 mod 4 has no valid base64url encoding
    expect(() => base64urlDecode("a")).toThrow(Base64UrlError);
    expect(() => base64urlDecode("abcde")).toThrow(Base64UrlError);
  });
});
