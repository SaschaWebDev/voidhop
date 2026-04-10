/**
 * ID generation. SRS §11.5.
 *
 * `generateAndReserveId` always existence-checks before returning, so the
 * same code path safely handles v1.4's user-supplied custom IDs.
 */

import { IdCollisionError } from "./types";
import type { LinkStore } from "./store/link-store";

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * 6 random bytes → 8 base64url chars (48 bits of entropy).
 * Inlined base64url encoding to avoid pulling the frontend constants module
 * into the worker bundle.
 */
export function generateId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  // 6 bytes = 48 bits = 8 base64url chars exactly, no padding needed.
  const out = new Array<string>(8);
  out[0] = BASE64URL_ALPHABET[bytes[0]! >> 2]!;
  out[1] = BASE64URL_ALPHABET[((bytes[0]! & 0x03) << 4) | (bytes[1]! >> 4)]!;
  out[2] = BASE64URL_ALPHABET[((bytes[1]! & 0x0f) << 2) | (bytes[2]! >> 6)]!;
  out[3] = BASE64URL_ALPHABET[bytes[2]! & 0x3f]!;
  out[4] = BASE64URL_ALPHABET[bytes[3]! >> 2]!;
  out[5] = BASE64URL_ALPHABET[((bytes[3]! & 0x03) << 4) | (bytes[4]! >> 4)]!;
  out[6] = BASE64URL_ALPHABET[((bytes[4]! & 0x0f) << 2) | (bytes[5]! >> 6)]!;
  out[7] = BASE64URL_ALPHABET[bytes[5]! & 0x3f]!;
  return out.join("");
}

/**
 * Generate a fresh random ID and confirm it does not collide. Up to 3
 * attempts before throwing IdCollisionError.
 */
export async function generateAndReserveId(store: LinkStore): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateId();
    if (!(await store.exists(id))) return id;
  }
  throw new IdCollisionError();
}
