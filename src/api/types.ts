/**
 * API request/response types and the typed ApiError union. SRS §12.3.
 */

export interface CreateLinkRequest {
  blob: string;
  ttl: number;
}

export interface CreateLinkResponse {
  id: string;
}

export interface GetBlobResponse {
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
  | "NETWORK_ERROR";

export class ApiError extends Error {
  readonly type: ApiErrorType;
  readonly retryAfter?: number;

  constructor(type: ApiErrorType, message: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}
