/**
 * Length-prefix padding scheme. SRS §4.4.
 *
 * Layout:
 *
 *   [ length: 4 bytes BE uint32 ][ plaintext: length bytes ][ zero fill ]
 *
 * The total padded length always equals the bucket size selected via
 * `pickBucket()`. The decoder reads the first 4 bytes as a big-endian uint32
 * length N, validates `0 ≤ N ≤ buf.length - 4`, and returns the next N bytes.
 *
 * The entire padded buffer is encrypted under AES-256-GCM, so any tampering
 * (including with the length header or the zero fill) fails the GCM tag
 * verification before the unpadder ever runs. There is no padding-oracle
 * vector.
 */

import { LENGTH_HEADER_BYTES, UrlTooLongError } from "@/constants";

export class PaddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaddingError";
  }
}

/**
 * Pad `input` to exactly `bucket` bytes using the length-prefix scheme.
 * Throws `UrlTooLongError` if the header + plaintext won't fit.
 */
export function padBytesLengthPrefix(
  input: Uint8Array,
  bucket: number,
): Uint8Array {
  const required = LENGTH_HEADER_BYTES + input.length;
  if (required > bucket) throw new UrlTooLongError();

  const out = new Uint8Array(bucket); // zero-filled by spec
  // Big-endian uint32 length header
  out[0] = (input.length >>> 24) & 0xff;
  out[1] = (input.length >>> 16) & 0xff;
  out[2] = (input.length >>> 8) & 0xff;
  out[3] = input.length & 0xff;
  out.set(input, LENGTH_HEADER_BYTES);
  // Bytes from `LENGTH_HEADER_BYTES + input.length` to `bucket` are already 0.
  return out;
}

/**
 * Decode a length-prefix padded buffer back into the original plaintext bytes.
 * Throws `PaddingError` on any structural inconsistency.
 */
export function unpadBytesLengthPrefix(input: Uint8Array): Uint8Array {
  if (input.length < LENGTH_HEADER_BYTES) {
    throw new PaddingError("Padded buffer too short for length header");
  }

  const length =
    ((input[0]! << 24) >>> 0) |
    (input[1]! << 16) |
    (input[2]! << 8) |
    input[3]!;

  // Convert the unsigned 32-bit value to a non-negative number for comparison.
  const n = length >>> 0;

  if (n > input.length - LENGTH_HEADER_BYTES) {
    throw new PaddingError("Encoded length exceeds available bytes");
  }

  // Slice produces a view; copy to a fresh buffer so callers can rely on
  // independent ownership of the returned bytes.
  return input.slice(LENGTH_HEADER_BYTES, LENGTH_HEADER_BYTES + n);
}
