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
  PASSWORD_SALT_BYTES,
  pickBucket,
  UrlTooLongError,
} from "@/constants";
import { base64urlEncode } from "./encoding";
import { padBytesLengthPrefix } from "./padding";
import { deriveEncKey, deriveKPwd, deriveVerifier } from "./password";
import {
  CryptoError,
  type EncryptResult,
  type PasswordEncryptResult,
} from "./types";

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
    rawKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      cryptoKey,
      padded as BufferSource,
    ),
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

/**
 * Encrypt a URL with the additional password factor. Result carries the
 * fragment key, a fresh salt (also destined for the fragment), and the
 * server-visible verifier. SRS §4.5.
 *
 * @throws {CryptoError} `URL_TOO_LONG` if the plaintext exceeds the largest bucket
 * @throws {CryptoError} `PASSWORD_EMPTY` if `password` is an empty string
 */
export async function encryptUrlWithPassword(
  url: string,
  password: string,
): Promise<PasswordEncryptResult> {
  if (password.length === 0) {
    throw new CryptoError("PASSWORD_EMPTY", "Password must not be empty");
  }

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

  const fragmentKey = new Uint8Array(AES_KEY_BYTES);
  crypto.getRandomValues(fragmentKey);

  const salt = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(salt);

  // Slow step — PBKDF2. Everything downstream is cheap.
  const kPwd = await deriveKPwd(password, salt);

  let result: PasswordEncryptResult;
  try {
    const [encKey, verifier] = await Promise.all([
      deriveEncKey(fragmentKey, kPwd, "encrypt"),
      deriveVerifier(kPwd),
    ]);

    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        encKey,
        padded as BufferSource,
      ),
    );

    const payload = new Uint8Array(iv.length + ciphertext.length);
    payload.set(iv, 0);
    payload.set(ciphertext, iv.length);

    result = {
      blob: base64urlEncode(payload),
      keyB64url: base64urlEncode(fragmentKey),
      saltB64url: base64urlEncode(salt),
      verifierB64url: base64urlEncode(verifier),
    };

    // Scrub the verifier buffer — not a secret exactly, but no reason to
    // linger. The base64url copy is what the caller uses.
    crypto.getRandomValues(verifier);
  } finally {
    // Scrub raw key material from our local buffers. Per SR-KEY-01.
    crypto.getRandomValues(fragmentKey);
    crypto.getRandomValues(kPwd);
  }

  return result;
}
