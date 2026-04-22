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
  PASSWORD_SALT_B64URL_LENGTH,
  PASSWORD_SALT_BYTES,
} from "@/constants";
import { base64urlDecode, Base64UrlError } from "./encoding";
import { unpadBytesLengthPrefix, PaddingError } from "./padding";
import { deriveEncKey, deriveKPwd } from "./password";
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
      rawKeyBytes as BufferSource,
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
      { name: "AES-GCM", iv: iv as BufferSource },
      cryptoKey,
      ciphertext as BufferSource,
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

/**
 * Decrypt a password-protected blob. SRS §4.5.
 *
 * Derives the AES-GCM key from `fragment_key || PBKDF2(password, salt)`.
 * Wrong password → GCM auth failure → `CryptoError("DECRYPTION_FAILED")`.
 * Malformed salt or key → `CryptoError("KEY_INVALID" | "SALT_INVALID")`.
 */
export async function decryptBlobWithPassword(
  blob: string,
  keyB64url: string,
  saltB64url: string,
  password: string,
): Promise<string> {
  if (keyB64url.length !== AES_KEY_B64URL_LENGTH) {
    throw new CryptoError("KEY_INVALID", "Key has wrong length");
  }
  if (saltB64url.length !== PASSWORD_SALT_B64URL_LENGTH) {
    throw new CryptoError("SALT_INVALID", "Salt has wrong length");
  }
  if (password.length === 0) {
    throw new CryptoError("PASSWORD_EMPTY", "Password must not be empty");
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

  // Decode the fragment key.
  let fragmentKey: Uint8Array;
  try {
    fragmentKey = base64urlDecode(keyB64url);
  } catch {
    throw new CryptoError("KEY_INVALID", "Key is not valid base64url");
  }
  if (fragmentKey.length !== AES_KEY_BYTES) {
    throw new CryptoError("KEY_INVALID", "Key is not 32 bytes");
  }

  // Decode the salt.
  let salt: Uint8Array;
  try {
    salt = base64urlDecode(saltB64url);
  } catch {
    throw new CryptoError("SALT_INVALID", "Salt is not valid base64url");
  }
  if (salt.length !== PASSWORD_SALT_BYTES) {
    throw new CryptoError("SALT_INVALID", "Salt has wrong byte length");
  }

  const kPwd = await deriveKPwd(password, salt);

  let plaintextBytes: Uint8Array;
  try {
    const cryptoKey = await deriveEncKey(fragmentKey, kPwd, "decrypt");

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
        "Decryption failed — wrong password, tampered blob, or wrong key",
      );
    }

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
  } finally {
    // Scrub key material. Per SR-KEY-01.
    crypto.getRandomValues(fragmentKey);
    crypto.getRandomValues(kPwd);
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes);
}
