/**
 * API request/response types and the typed ApiError union. SRS §12.3.
 */

export interface CreateLinkRequest {
  blob: string;
  ttl: number;
  /** Present only for v2 password-protected links. 43-char base64url. */
  verifier?: string;
  /** Opt-in: link expires after this many successful retrievals. */
  usesLeft?: number;
  /** SHA-256 of the 32-byte creator deletion token, base64url, 43 chars. */
  deletionTokenHash?: string;
}

export interface CreateLinkResponse {
  id: string;
}

/** Unprotected v1 response: the blob is returned directly. */
export interface GetBlobResponseOpen {
  blob: string;
  protected?: false;
}

/** Protected v2 response: the blob is withheld until a successful unlock. */
export interface GetBlobResponseProtected {
  protected: true;
  /** Current remaining attempts before the link is destroyed. */
  attemptsLeft: number;
  /** Current remaining multi-use counter, if opt-in at create time. */
  usesLeft?: number;
}

export type GetBlobResponse = GetBlobResponseOpen | GetBlobResponseProtected;

export interface UnlockRequest {
  /** 43-char base64url verifier — HKDF of PBKDF2(password, salt) */
  verifier: string;
}

export interface UnlockResponse {
  blob: string;
}

export type ApiErrorType =
  | "RATE_LIMITED"
  | "BUDGET_EXHAUSTED"
  | "ORIGIN_BUDGET_EXHAUSTED"
  | "BLOB_TOO_LARGE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "WRONG_PASSWORD"
  | "LINK_DESTROYED"
  | "BACKOFF";

export class ApiError extends Error {
  readonly type: ApiErrorType;
  readonly retryAfter?: number;
  /** Set for `WRONG_PASSWORD` / `BACKOFF` — how many attempts the caller has left. */
  readonly attemptsLeft?: number;
  /** Milliseconds the caller must wait before retrying an unlock. */
  readonly retryAfterMs?: number;

  constructor(
    type: ApiErrorType,
    message: string,
    options?: {
      retryAfter?: number;
      attemptsLeft?: number;
      retryAfterMs?: number;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    if (options?.retryAfter !== undefined) this.retryAfter = options.retryAfter;
    if (options?.attemptsLeft !== undefined)
      this.attemptsLeft = options.attemptsLeft;
    if (options?.retryAfterMs !== undefined)
      this.retryAfterMs = options.retryAfterMs;
  }
}
