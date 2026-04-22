/**
 * Crypto module discriminated union types. SRS §12.2.
 */

export interface EncryptResult {
  /** base64url(IV + ciphertext) — what gets POSTed to the API */
  readonly blob: string;
  /** base64url(rawKey) — exactly 43 chars; goes into the URL fragment */
  readonly keyB64url: string;
}

/**
 * Output of `encryptUrlWithPassword`. Adds the password-flow fields alongside
 * the base `EncryptResult`. `saltB64url` goes into the URL fragment after the
 * key; `verifierB64url` goes to the server in the POST body.
 */
export interface PasswordEncryptResult extends EncryptResult {
  /** base64url(salt) — exactly 22 chars; appended to the fragment as `.<salt>` */
  readonly saltB64url: string;
  /** base64url(verifier) — 43 chars; sent to the server for access gating */
  readonly verifierB64url: string;
}

export type CryptoErrorType =
  | "DECRYPTION_FAILED"
  | "PADDING_INVALID"
  | "KEY_INVALID"
  | "BLOB_INVALID"
  | "URL_TOO_LONG"
  | "SALT_INVALID"
  | "PASSWORD_EMPTY";

export class CryptoError extends Error {
  readonly type: CryptoErrorType;
  constructor(type: CryptoErrorType, message: string) {
    super(message);
    this.name = "CryptoError";
    this.type = type;
  }
}
