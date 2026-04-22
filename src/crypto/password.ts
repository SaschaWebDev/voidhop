/**
 * Password-derived key material for optional v2 protection. SRS §4.5.
 *
 * Chain:
 *
 *   K_pwd    = PBKDF2-SHA256(password, salt, PBKDF2_ITERATIONS, 32 bytes)
 *   verifier = HKDF-SHA256(ikm=K_pwd,                 info=HKDF_INFO_VERIFY, length=32)
 *   K_enc    = HKDF-SHA256(ikm=fragment_key || K_pwd, info=HKDF_INFO_ENC,    length=32)
 *
 * `verifier` is an opaque access-control token that the worker stores and
 * compares against submissions. `K_enc` is the AES-GCM key that actually
 * locks the blob — it depends on both the fragment and the password, so a
 * server compromise (which reveals only the verifier) cannot recover a URL.
 *
 * All primitives are Web Crypto native: PBKDF2 and HKDF with SHA-256 are
 * supported in both browsers and Cloudflare Workers.
 */

import {
  HKDF_INFO_ENC,
  HKDF_INFO_VERIFY,
  PBKDF2_ITERATIONS,
  VERIFIER_BYTES,
} from "@/constants";

const UTF8 = new TextEncoder();

/**
 * Derive the 32-byte password-stretched secret via PBKDF2-SHA256. This is the
 * slow step (~300-600 ms on a modern laptop with PBKDF2_ITERATIONS) and the
 * cost attackers must pay per guess.
 */
export async function deriveKPwd(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const passwordBytes = UTF8.encode(password);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    256, // 32 bytes
  );
  return new Uint8Array(bits);
}

/**
 * Derive the server-side verifier from K_pwd. HKDF `info` string provides
 * domain separation from the encryption key.
 */
export async function deriveVerifier(kPwd: Uint8Array): Promise<Uint8Array> {
  return hkdf(kPwd, HKDF_INFO_VERIFY, VERIFIER_BYTES);
}

/**
 * Derive the AES-GCM CryptoKey that encrypts/decrypts the blob. The input key
 * material is `fragment_key || K_pwd`, so both factors are required.
 *
 * Returned as a non-extractable CryptoKey because callers never need the raw
 * bytes — they pass this directly into `crypto.subtle.encrypt` / `.decrypt`.
 */
export async function deriveEncKey(
  fragmentKey: Uint8Array,
  kPwd: Uint8Array,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  const ikm = new Uint8Array(fragmentKey.length + kPwd.length);
  ikm.set(fragmentKey, 0);
  ikm.set(kPwd, fragmentKey.length);

  const prk = await crypto.subtle.importKey(
    "raw",
    ikm as BufferSource,
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0) as BufferSource,
      info: UTF8.encode(HKDF_INFO_ENC) as BufferSource,
    },
    prk,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/** Internal HKDF-SHA256 expand helper with empty salt. */
async function hkdf(
  ikm: Uint8Array,
  info: string,
  lengthBytes: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    ikm as BufferSource,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0) as BufferSource,
      info: UTF8.encode(info) as BufferSource,
    },
    baseKey,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}
