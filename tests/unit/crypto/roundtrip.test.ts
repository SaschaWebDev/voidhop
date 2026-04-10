import { describe, expect, it } from "vitest";
import { encryptUrl } from "@/crypto/encrypt";
import { decryptBlob } from "@/crypto/decrypt";
import { CryptoError } from "@/crypto/types";
import { base64urlDecode, base64urlEncode } from "@/crypto/encoding";
import { PADDING_BUCKETS } from "@/constants";

describe("encrypt/decrypt round trip", () => {
  it("encrypts then decrypts a 1-character URL", async () => {
    const url = "h";
    const enc = await encryptUrl(url);
    const dec = await decryptBlob(enc.blob, enc.keyB64url);
    expect(dec).toBe(url);
  });

  it("encrypts then decrypts a typical short URL", async () => {
    const url = "https://example.com/some/long/path?query=1&another=2";
    const enc = await encryptUrl(url);
    const dec = await decryptBlob(enc.blob, enc.keyB64url);
    expect(dec).toBe(url);
  });

  it("encrypts then decrypts a 7,300-char URL (Notefade-typical)", async () => {
    const url = "https://notefade.com/#" + "a".repeat(7280);
    const enc = await encryptUrl(url);
    const dec = await decryptBlob(enc.blob, enc.keyB64url);
    expect(dec).toBe(url);
  });

  it("encrypts then decrypts a 200,000-char URL (Notefade max)", async () => {
    const url = "https://notefade.com/#" + "x".repeat(200_000 - 22);
    const enc = await encryptUrl(url);
    const dec = await decryptBlob(enc.blob, enc.keyB64url);
    expect(dec).toBe(url);
  });

  it("produces different ciphertexts for the same URL (random IV)", async () => {
    const url = "https://example.com/";
    const a = await encryptUrl(url);
    const b = await encryptUrl(url);
    expect(a.blob).not.toBe(b.blob);
    expect(a.keyB64url).not.toBe(b.keyB64url);
  });

  it("blob length equals one of the bucket sizes + IV(12) + GCM tag(16)", async () => {
    const sizes = [0, 1, 100, 1000, 5000, 50_000];
    const validLengths = PADDING_BUCKETS.map((b) => b + 12 + 16);
    for (const n of sizes) {
      const url = "x".repeat(n);
      const enc = await encryptUrl(url);
      const decoded = base64urlDecode(enc.blob);
      expect(validLengths).toContain(decoded.length);
    }
  });

  it("decrypt with wrong key throws CryptoError", async () => {
    const url = "https://example.com/";
    const enc = await encryptUrl(url);
    // Generate a different valid key
    const wrong = new Uint8Array(32);
    crypto.getRandomValues(wrong);
    const wrongKey = base64urlEncode(wrong);
    await expect(decryptBlob(enc.blob, wrongKey)).rejects.toThrow(CryptoError);
  });

  it("decrypt with truncated blob throws CryptoError", async () => {
    const url = "https://example.com/";
    const enc = await encryptUrl(url);
    // Slice a few characters off the encoded blob — corrupts ciphertext
    const truncated = enc.blob.slice(0, enc.blob.length - 4);
    await expect(decryptBlob(truncated, enc.keyB64url)).rejects.toThrow(
      CryptoError,
    );
  });

  it("decrypt with a flipped ciphertext byte throws CryptoError (GCM auth)", async () => {
    const url = "https://example.com/";
    const enc = await encryptUrl(url);
    const decoded = base64urlDecode(enc.blob);
    // Flip a byte well inside the ciphertext (past the IV)
    decoded[20] = decoded[20]! ^ 0x01;
    const tamperedBlob = base64urlEncode(decoded);
    await expect(decryptBlob(tamperedBlob, enc.keyB64url)).rejects.toThrow(
      CryptoError,
    );
  });

  it("a plaintext that legitimately ends in 0x01 + 0x00 round-trips", async () => {
    // Build a plaintext URL whose UTF-8 bytes end in 0x01 0x00 — the v1.0
    // delimiter scheme would have silently truncated this. The length-prefix
    // scheme handles it correctly.
    const plaintextBytes = new Uint8Array([
      ...new TextEncoder().encode("https://example.com/"),
      0x01,
      0x00,
      0x00,
    ]);
    // We can't represent 0x00 inside a JS string easily and still pass it to
    // encryptUrl, which TextEncoder()s a string. Use a string with embedded
    // \u0001\u0000 — TextEncoder maps \u0000 to a 0x00 byte.
    const url = "https://example.com/\u0001\u0000\u0000";
    expect(new TextEncoder().encode(url)).toEqual(plaintextBytes);
    const enc = await encryptUrl(url);
    const dec = await decryptBlob(enc.blob, enc.keyB64url);
    expect(dec).toBe(url);
  });
});
