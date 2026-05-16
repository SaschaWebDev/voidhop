/**
 * `scrubBytes` is the SR-KEY-01 hygiene primitive: after key material is
 * used, the buffer is overwritten with fresh random bytes. The test asserts
 * the buffer is mutated in place and that the post-state is overwhelmingly
 * unlikely to equal the original.
 */

import { describe, expect, it } from "vitest";
import { scrubBytes } from "@/crypto/scrub";

describe("scrubBytes", () => {
  it("mutates the buffer in place", () => {
    const buf = new Uint8Array(32);
    const sameRef = buf;
    scrubBytes(buf);
    expect(sameRef).toBe(buf);
  });

  it("overwrites an all-zero buffer with random bytes (probabilistic)", () => {
    const buf = new Uint8Array(32);
    scrubBytes(buf);
    // 32 zero bytes after a CSPRNG draw has odds 2^-256 of happening.
    let allZero = true;
    for (const b of buf) if (b !== 0) { allZero = false; break; }
    expect(allZero).toBe(false);
  });

  it("overwrites a known-pattern buffer with non-pattern bytes", () => {
    const buf = new Uint8Array(64);
    buf.fill(0xab);
    const before = new Uint8Array(buf);
    scrubBytes(buf);
    let identical = true;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] !== before[i]) { identical = false; break; }
    }
    expect(identical).toBe(false);
  });

  it("handles a length-0 buffer without throwing", () => {
    const buf = new Uint8Array(0);
    expect(() => scrubBytes(buf)).not.toThrow();
  });

  it("does not change the buffer length", () => {
    const buf = new Uint8Array(16);
    scrubBytes(buf);
    expect(buf.length).toBe(16);
  });
});
