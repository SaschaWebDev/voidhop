/**
 * Crypto module discriminated union types. SRS §12.2.
 */

export interface EncryptResult {
  /** base64url(IV + ciphertext) — what gets POSTed to the API */
  readonly blob: string;
  /** base64url(rawKey) — exactly 43 chars; goes into the URL fragment */
  readonly keyB64url: string;
}

export type CryptoErrorType =
  | "DECRYPTION_FAILED"
  | "PADDING_INVALID"
  | "KEY_INVALID"
  | "BLOB_INVALID"
  | "URL_TOO_LONG";

export class CryptoError extends Error {
  readonly type: CryptoErrorType;
  constructor(type: CryptoErrorType, message: string) {
    super(message);
    this.name = "CryptoError";
    this.type = type;
  }
}
