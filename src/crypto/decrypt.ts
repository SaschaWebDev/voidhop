/**
 * AES-256-GCM decryption with length-prefix unpadding. SRS §4.3.
 *
 * Browser-only. Imports the key as `extractable: false` and immediately
 * scrubs the raw key bytes in place per SR-KEY-01 (item 15).
 */

import {
  AES_GCM_IV_BYTES,
  AES_KEY_B64URL_LENGTH,
  AES_KEY_BYTES,
} from "@/constants";
import { base64urlDecode, Base64UrlError } from "./encoding";
import { unpadBytesLengthPrefix, PaddingError } from "./padding";
import { CryptoError } from "./types";

/**
 * Decrypt a base64url-encoded blob using a base64url-encoded key.
 *
 * @throws {CryptoError} on any failure (invalid input, GCM auth failure, padding error)
 */
export async function decryptBlob(
  blob: string,
  keyB64url: string,
): Promise<string> {
  // Structural pre-check on the key — caller should already have done this,
  // but we re-assert here so this function is independently safe.
  if (keyB64url.length !== AES_KEY_B64URL_LENGTH) {
    throw new CryptoError("KEY_INVALID", "Key has wrong length");
  }

  // Decode the blob.
  let payload: Uint8Array;
  try {
    payload = base64urlDecode(blob);
  } catch (e) {
    if (e instanceof Base64UrlError) {
      throw new CryptoError("BLOB_INVALID", "Blob is not valid base64url");
    }
    throw e;
  }

  if (payload.length < AES_GCM_IV_BYTES + 1) {
    throw new CryptoError("BLOB_INVALID", "Blob is too short");
  }

  const iv = payload.slice(0, AES_GCM_IV_BYTES);
  const ciphertext = payload.slice(AES_GCM_IV_BYTES);

  // Decode the key.
  let rawKeyBytes: Uint8Array;
  try {
    rawKeyBytes = base64urlDecode(keyB64url);
  } catch {
    throw new CryptoError("KEY_INVALID", "Key is not valid base64url");
  }
  if (rawKeyBytes.length !== AES_KEY_BYTES) {
    throw new CryptoError("KEY_INVALID", "Key is not 32 bytes");
  }

  // Import the key as non-extractable, then immediately scrub the raw bytes.
  // Per SR-KEY-01: any concurrent or subsequent read of the same memory
  // cells will yield random data, not the key.
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawKeyBytes,
      { name: "AES-GCM" },
      false, // extractable: false
      ["decrypt"],
    );
  } finally {
    crypto.getRandomValues(rawKeyBytes);
  }

  // Decrypt. AES-GCM auth-tag failure surfaces as a thrown OperationError.
  let paddedPlaintext: ArrayBuffer;
  try {
    paddedPlaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext,
    );
  } catch {
    throw new CryptoError(
      "DECRYPTION_FAILED",
      "Decryption failed — link may be tampered with or use the wrong key",
    );
  }

  // Unpad. PaddingError → mapped to CryptoError.
  let plaintextBytes: Uint8Array;
  try {
    plaintextBytes = unpadBytesLengthPrefix(new Uint8Array(paddedPlaintext));
  } catch (e) {
    if (e instanceof PaddingError) {
      throw new CryptoError(
        "PADDING_INVALID",
        "Decrypted payload has invalid padding",
      );
    }
    throw e;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes);
}
