/**
 * base64url encoding (RFC 4648 §5) without padding.
 *
 * Pure functions, no allocations beyond the output. Used for both the AES key
 * (in the URL fragment) and the encrypted blob (in API transport). Per SRS §4.1.
 */

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Reverse lookup: char code → 6-bit value, or -1 for invalid characters.
const BASE64URL_INVERSE: Int8Array = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE64URL_ALPHABET.length; i++) {
    table[BASE64URL_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export class Base64UrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Base64UrlError";
  }
}

/**
 * Encode bytes as base64url with no padding. Output contains only the
 * URL-safe alphabet `[A-Za-z0-9_-]`.
 */
export function base64urlEncode(bytes: Uint8Array): string {
  const len = bytes.length;
  if (len === 0) return "";

  let out = "";
  let i = 0;

  // Process full 3-byte groups → 4 base64url chars
  const wholeGroups = len - (len % 3);
  for (; i < wholeGroups; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    out += BASE64URL_ALPHABET[b0 >> 2]!;
    out += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]!;
    out += BASE64URL_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]!;
    out += BASE64URL_ALPHABET[b2 & 0x3f]!;
  }

  // Tail (1 or 2 leftover bytes) — produces 2 or 3 chars, no `=` padding.
  const remaining = len - i;
  if (remaining === 1) {
    const b0 = bytes[i]!;
    out += BASE64URL_ALPHABET[b0 >> 2]!;
    out += BASE64URL_ALPHABET[(b0 & 0x03) << 4]!;
  } else if (remaining === 2) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    out += BASE64URL_ALPHABET[b0 >> 2]!;
    out += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]!;
    out += BASE64URL_ALPHABET[(b1 & 0x0f) << 2]!;
  }

  return out;
}

/**
 * Decode a base64url string (no padding) into bytes.
 *
 * Throws `Base64UrlError` if any character is outside the alphabet or the
 * length is structurally impossible (length ≡ 1 mod 4 has no valid encoding).
 */
export function base64urlDecode(input: string): Uint8Array {
  const len = input.length;
  if (len === 0) return new Uint8Array(0);
  if (len % 4 === 1) {
    throw new Base64UrlError("Invalid base64url length");
  }

  // Output length: every 4 input chars → 3 bytes; remainder of 2 → 1 byte; 3 → 2 bytes.
  const fullGroups = Math.floor(len / 4);
  const remainder = len % 4;
  const outLen = fullGroups * 3 + (remainder === 0 ? 0 : remainder - 1);
  const out = new Uint8Array(outLen);

  let outIdx = 0;
  let i = 0;

  for (let g = 0; g < fullGroups; g++) {
    const c0 = decodeChar(input.charCodeAt(i++));
    const c1 = decodeChar(input.charCodeAt(i++));
    const c2 = decodeChar(input.charCodeAt(i++));
    const c3 = decodeChar(input.charCodeAt(i++));
    out[outIdx++] = (c0 << 2) | (c1 >> 4);
    out[outIdx++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    out[outIdx++] = ((c2 & 0x03) << 6) | c3;
  }

  if (remainder === 2) {
    const c0 = decodeChar(input.charCodeAt(i++));
    const c1 = decodeChar(input.charCodeAt(i++));
    out[outIdx++] = (c0 << 2) | (c1 >> 4);
  } else if (remainder === 3) {
    const c0 = decodeChar(input.charCodeAt(i++));
    const c1 = decodeChar(input.charCodeAt(i++));
    const c2 = decodeChar(input.charCodeAt(i++));
    out[outIdx++] = (c0 << 2) | (c1 >> 4);
    out[outIdx++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
  }

  return out;
}

function decodeChar(charCode: number): number {
  if (charCode >= 128) throw new Base64UrlError("Invalid base64url character");
  const v = BASE64URL_INVERSE[charCode]!;
  if (v < 0) throw new Base64UrlError("Invalid base64url character");
  return v;
}
