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
import { scrubBytes } from "./scrub";
import { CryptoError } from "./types";

interface DecodedBlob {
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly rawKeyBytes: Uint8Array;
}

/**
 * Shared prologue for both decrypt paths: validate the key's structural
 * shape, decode the blob and split into IV + ciphertext, decode the raw
 * key bytes. Returned `rawKeyBytes` is owned by the caller and MUST be
 * scrubbed after the WebCrypto import (per SR-KEY-01).
 *
 * @throws {CryptoError} `KEY_INVALID` or `BLOB_INVALID` on shape failures.
 */
function validateAndDecodeBlob(blob: string, keyB64url: string): DecodedBlob {
  if (keyB64url.length !== AES_KEY_B64URL_LENGTH) {
    throw new CryptoError("KEY_INVALID", "Key has wrong length");
  }

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

  let rawKeyBytes: Uint8Array;
  try {
    rawKeyBytes = base64urlDecode(keyB64url);
  } catch {
    throw new CryptoError("KEY_INVALID", "Key is not valid base64url");
  }
  if (rawKeyBytes.length !== AES_KEY_BYTES) {
    throw new CryptoError("KEY_INVALID", "Key is not 32 bytes");
  }

  return { iv, ciphertext, rawKeyBytes };
}

/**
 * Decode + length-check the password salt fragment for v2 links.
 *
 * @throws {CryptoError} `SALT_INVALID` on shape failures.
 */
function decodeSalt(saltB64url: string): Uint8Array {
  if (saltB64url.length !== PASSWORD_SALT_B64URL_LENGTH) {
    throw new CryptoError("SALT_INVALID", "Salt has wrong length");
  }
  let salt: Uint8Array;
  try {
    salt = base64urlDecode(saltB64url);
  } catch {
    throw new CryptoError("SALT_INVALID", "Salt is not valid base64url");
  }
  if (salt.length !== PASSWORD_SALT_BYTES) {
    throw new CryptoError("SALT_INVALID", "Salt has wrong byte length");
  }
  return salt;
}

/**
 * Run AES-GCM decrypt + length-prefix unpad. Maps the underlying errors to
 * `CryptoError("DECRYPTION_FAILED")` (GCM auth failure / wrong key) or
 * `CryptoError("PADDING_INVALID")` (decrypted bytes don't match the
 * length-prefix format).
 */
async function aesGcmDecryptAndUnpad(
  cryptoKey: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  wrongPasswordMessage = "Decryption failed — link may be tampered with or use the wrong key",
): Promise<Uint8Array> {
  let paddedPlaintext: ArrayBuffer;
  try {
    paddedPlaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      cryptoKey,
      ciphertext as BufferSource,
    );
  } catch {
    throw new CryptoError("DECRYPTION_FAILED", wrongPasswordMessage);
  }

  try {
    return unpadBytesLengthPrefix(new Uint8Array(paddedPlaintext));
  } catch (e) {
    if (e instanceof PaddingError) {
      throw new CryptoError(
        "PADDING_INVALID",
        "Decrypted payload has invalid padding",
      );
    }
    throw e;
  }
}

/**
 * Decrypt a base64url-encoded blob using a base64url-encoded key.
 *
 * @throws {CryptoError} on any failure (invalid input, GCM auth failure, padding error)
 */
export async function decryptBlob(
  blob: string,
  keyB64url: string,
): Promise<string> {
  const { iv, ciphertext, rawKeyBytes } = validateAndDecodeBlob(
    blob,
    keyB64url,
  );

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
    scrubBytes(rawKeyBytes);
  }

  const plaintextBytes = await aesGcmDecryptAndUnpad(cryptoKey, iv, ciphertext);
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
  if (password.length === 0) {
    throw new CryptoError("PASSWORD_EMPTY", "Password must not be empty");
  }

  const { iv, ciphertext, rawKeyBytes: fragmentKey } = validateAndDecodeBlob(
    blob,
    keyB64url,
  );
  const salt = decodeSalt(saltB64url);

  const kPwd = await deriveKPwd(password, salt);

  let plaintextBytes: Uint8Array;
  try {
    const cryptoKey = await deriveEncKey(fragmentKey, kPwd, "decrypt");
    plaintextBytes = await aesGcmDecryptAndUnpad(
      cryptoKey,
      iv,
      ciphertext,
      "Decryption failed — wrong password, tampered blob, or wrong key",
    );
  } finally {
    // Scrub key material. Per SR-KEY-01.
    scrubBytes(fragmentKey);
    scrubBytes(kPwd);
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes);
}
