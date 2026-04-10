import { describe, expect, it } from "vitest";
import {
  padBytesLengthPrefix,
  unpadBytesLengthPrefix,
  PaddingError,
} from "@/crypto/padding";
import {
  PADDING_BUCKETS,
  pickBucket,
  UrlTooLongError,
} from "@/constants";

describe("pickBucket", () => {
  it("picks 1 KB for the smallest plaintexts", () => {
    expect(pickBucket(0)).toBe(1024);
    expect(pickBucket(1)).toBe(1024);
    expect(pickBucket(1020)).toBe(1024); // 4 + 1020 == 1024
  });

  it("rolls over to the next bucket when the header + plaintext spills past", () => {
    expect(pickBucket(1021)).toBe(10240); // 4 + 1021 > 1024
    expect(pickBucket(10236)).toBe(10240); // 4 + 10236 == 10240
    expect(pickBucket(10237)).toBe(51200);
    expect(pickBucket(51196)).toBe(51200);
    expect(pickBucket(51197)).toBe(102400);
    expect(pickBucket(102396)).toBe(102400);
    expect(pickBucket(102397)).toBe(262144);
    expect(pickBucket(262140)).toBe(262144); // 4 + 262140 == 262144
  });

  it("throws UrlTooLongError once the largest bucket can't fit", () => {
    expect(() => pickBucket(262141)).toThrow(UrlTooLongError);
  });
});

describe("length-prefix padding", () => {
  it("pads empty input to a 1024-byte zero buffer", () => {
    const out = padBytesLengthPrefix(new Uint8Array(0), 1024);
    expect(out.length).toBe(1024);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(0);
    for (let i = 4; i < 1024; i++) expect(out[i]).toBe(0);
  });

  it("encodes the length as big-endian uint32", () => {
    const input = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const out = padBytesLengthPrefix(input, 1024);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(3);
    expect(out[4]).toBe(0xaa);
    expect(out[5]).toBe(0xbb);
    expect(out[6]).toBe(0xcc);
    // Trailing bytes are zero
    for (let i = 7; i < 1024; i++) expect(out[i]).toBe(0);
  });

  it("round-trips for many sizes", () => {
    const sizes = [0, 1, 100, 1020, 1021, 5000, 10236, 100000];
    for (const len of sizes) {
      const input = new Uint8Array(len);
      for (let i = 0; i < len; i++) input[i] = (i * 13 + 5) & 0xff;
      const bucket = pickBucket(len);
      const padded = padBytesLengthPrefix(input, bucket);
      expect(padded.length).toBe(bucket);
      const recovered = unpadBytesLengthPrefix(padded);
      expect(Array.from(recovered)).toEqual(Array.from(input));
    }
  });

  it("round-trips a plaintext that ends in 0x01 followed by zero bytes (the v1.0 footgun case)", () => {
    const input = new Uint8Array([
      0x68, 0x74, 0x74, 0x70, 0x73, 0x3a, 0x2f, 0x2f, 0x01, 0x00, 0x00,
    ]);
    const bucket = pickBucket(input.length);
    const padded = padBytesLengthPrefix(input, bucket);
    const recovered = unpadBytesLengthPrefix(padded);
    expect(Array.from(recovered)).toEqual(Array.from(input));
  });

  it("padBytesLengthPrefix throws UrlTooLongError when the header + plaintext won't fit", () => {
    const input = new Uint8Array(1021);
    expect(() => padBytesLengthPrefix(input, 1024)).toThrow(UrlTooLongError);
  });

  it("unpadBytesLengthPrefix throws on impossibly short input", () => {
    expect(() => unpadBytesLengthPrefix(new Uint8Array(3))).toThrow(
      PaddingError,
    );
  });

  it("unpadBytesLengthPrefix throws when the encoded length exceeds available bytes", () => {
    const buf = new Uint8Array(1024);
    // Encode length = 5000 — clearly larger than buf.length - 4
    buf[0] = 0;
    buf[1] = 0;
    buf[2] = 0x13;
    buf[3] = 0x88;
    expect(() => unpadBytesLengthPrefix(buf)).toThrow(PaddingError);
  });

  it("works for every defined bucket size", () => {
    for (const bucket of PADDING_BUCKETS) {
      const maxLen = bucket - 4;
      const input = new Uint8Array(maxLen);
      for (let i = 0; i < maxLen; i++) input[i] = i & 0xff;
      const padded = padBytesLengthPrefix(input, bucket);
      expect(padded.length).toBe(bucket);
      const recovered = unpadBytesLengthPrefix(padded);
      expect(Array.from(recovered)).toEqual(Array.from(input));
    }
  });
});
