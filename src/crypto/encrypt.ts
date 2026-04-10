/**
 * AES-256-GCM encryption with length-prefix padding to a tiered bucket size.
 * SRS §4.2.
 *
 * Browser-only (uses Web Crypto API). Pure function: same input + IV + key
 * produces the same blob, but the public surface always generates fresh
 * random IV and key, so two calls with the same URL produce different blobs.
 */

import {
  AES_GCM_IV_BYTES,
  AES_KEY_BYTES,
  pickBucket,
  UrlTooLongError,
} from "@/constants";
import { base64urlEncode } from "./encoding";
import { padBytesLengthPrefix } from "./padding";
import { CryptoError, type EncryptResult } from "./types";

/**
 * Encrypt a URL string into a transportable blob and a base64url-encoded key.
 *
 * @throws {CryptoError} `URL_TOO_LONG` if the plaintext exceeds the largest bucket
 */
export async function encryptUrl(url: string): Promise<EncryptResult> {
  const plaintextBytes = new TextEncoder().encode(url);

  let bucket: number;
  try {
    bucket = pickBucket(plaintextBytes.length);
  } catch (e) {
    if (e instanceof UrlTooLongError) {
      throw new CryptoError("URL_TOO_LONG", "URL is too long to shorten");
    }
    throw e;
  }

  const padded = padBytesLengthPrefix(plaintextBytes, bucket);

  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);

  const rawKey = new Uint8Array(AES_KEY_BYTES);
  crypto.getRandomValues(rawKey);

  // Import the key. We mark it extractable here only so the unit test can
  // round-trip without the import-then-scrub dance; the redirect path uses
  // `extractable: false` (see decrypt.ts).
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, padded),
  );

  // Concatenate IV || ciphertext into the transport blob.
  const payload = new Uint8Array(iv.length + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, iv.length);

  const result: EncryptResult = {
    blob: base64urlEncode(payload),
    keyB64url: base64urlEncode(rawKey),
  };

  // Scrub the raw key from our local buffer. The CryptoKey object retains
  // its own internal copy that we cannot reach. Per SR-KEY-01.
  crypto.getRandomValues(rawKey);

  return result;
}
