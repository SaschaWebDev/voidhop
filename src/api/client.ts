/**
 * Typed API client wrapping `fetch`. SRS §12.3.
 *
 * `getBlob` honors a single retry on the first 404 (item 5 / §12.5) to absorb
 * KV eventual-consistency lag. The retry delay is governed by
 * `KV_REPLICATION_RETRY_DELAY_MS` so the redirect hook can show a
 * "Confirming link…" status during the wait.
 */

import { API_BASE, KV_REPLICATION_RETRY_DELAY_MS } from "@/constants";
import {
  ApiError,
  type ApiErrorType,
  type CreateLinkRequest,
  type CreateLinkResponse,
  type GetBlobResponse,
  type UnlockRequest,
  type UnlockResponse,
} from "./types";

interface ErrorBody {
  error?: string;
  attemptsLeft?: number;
  retryAfterMs?: number;
}

async function parseErrorBody(res: Response): Promise<{
  code?: string;
  attemptsLeft?: number;
  retryAfterMs?: number;
}> {
  try {
    const json = (await res.json()) as ErrorBody;
    // Under `exactOptionalPropertyTypes: true` we must omit absent keys,
    // not assign `undefined` — a present key with value `undefined` does not
    // satisfy `key?: T`.
    const out: {
      code?: string;
      attemptsLeft?: number;
      retryAfterMs?: number;
    } = {};
    if (json.error !== undefined) out.code = json.error;
    if (json.attemptsLeft !== undefined) out.attemptsLeft = json.attemptsLeft;
    if (json.retryAfterMs !== undefined) out.retryAfterMs = json.retryAfterMs;
    return out;
  } catch {
    return {};
  }
}

/**
 * Build an options bag for `ApiError` that omits keys whose values are
 * undefined. Parameter types use `| undefined` so that callers can pass
 * raw `number | undefined` variables without tripping
 * `exactOptionalPropertyTypes: true`.
 */
function apiErrorOpts(
  parts: {
    retryAfter?: number | undefined;
    attemptsLeft?: number | undefined;
    retryAfterMs?: number | undefined;
  } = {},
): { retryAfter?: number; attemptsLeft?: number; retryAfterMs?: number } {
  const out: {
    retryAfter?: number;
    attemptsLeft?: number;
    retryAfterMs?: number;
  } = {};
  if (parts.retryAfter !== undefined) out.retryAfter = parts.retryAfter;
  if (parts.attemptsLeft !== undefined) out.attemptsLeft = parts.attemptsLeft;
  if (parts.retryAfterMs !== undefined) out.retryAfterMs = parts.retryAfterMs;
  return out;
}

/** Build a `RequestInit` that omits `signal` when it's undefined. */
function reqInit(base: RequestInit, signal: AbortSignal | undefined): RequestInit {
  return signal !== undefined ? { ...base, signal } : base;
}

function retryAfterFromHeader(res: Response): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function mapErrorCode(code: string | undefined): ApiErrorType {
  switch (code) {
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    case "DAILY_BUDGET_EXHAUSTED":
      return "BUDGET_EXHAUSTED";
    case "ORIGIN_BUDGET_EXHAUSTED":
      return "ORIGIN_BUDGET_EXHAUSTED";
    case "BLOB_TOO_LARGE":
      return "BLOB_TOO_LARGE";
    case "INVALID_BLOB":
    case "INVALID_TTL":
    case "INVALID_VERIFIER":
    case "INVALID_USES_LEFT":
    case "INVALID_DELETION_TOKEN":
    case "INVALID_DELETION_TOKEN_HASH":
      return "VALIDATION_ERROR";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "WRONG_PASSWORD":
      return "WRONG_PASSWORD";
    case "LINK_DESTROYED":
      return "LINK_DESTROYED";
    case "BACKOFF":
      return "BACKOFF";
    default:
      return "SERVER_ERROR";
  }
}

export async function createLink(
  req: CreateLinkRequest,
  signal?: AbortSignal,
): Promise<CreateLinkResponse> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/links`,
      reqInit(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        },
        signal,
      ),
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("NETWORK_ERROR", "Could not reach VoidHop");
  }

  if (res.status === 201) {
    return (await res.json()) as CreateLinkResponse;
  }

  const { code } = await parseErrorBody(res);
  const type = mapErrorCode(code);
  const retryAfter = retryAfterFromHeader(res);
  throw new ApiError(
    type,
    `Create failed: ${type}`,
    apiErrorOpts({ retryAfter }),
  );
}

/**
 * Fetch a blob with a single retry on 404. SRS §12.5.
 *
 * Returns either the blob directly (v1, unprotected) or a marker that the
 * link is password-protected (v2). Callers should branch on `res.protected`.
 *
 * The retry callback (if provided) is invoked between the first failure and
 * the retry, so the UI can transition to a "Confirming link…" state.
 */
export async function getBlob(
  id: string,
  options?: {
    signal?: AbortSignal;
    onRetry?: () => void;
  },
): Promise<GetBlobResponse> {
  const first = await getBlobOnce(id, options?.signal);
  if (first.status === "ok") return first.body;
  if (first.status !== "not_found") throw first.error;

  // First 404 — wait, then retry exactly once.
  options?.onRetry?.();
  await sleep(KV_REPLICATION_RETRY_DELAY_MS, options?.signal);

  const second = await getBlobOnce(id, options?.signal);
  if (second.status === "ok") return second.body;
  if (second.status === "not_found") {
    throw new ApiError("NOT_FOUND", "Link not found");
  }
  throw second.error;
}

type GetBlobOnceResult =
  | { status: "ok"; body: GetBlobResponse }
  | { status: "not_found" }
  | { status: "error"; error: ApiError };

async function getBlobOnce(
  id: string,
  signal?: AbortSignal,
): Promise<GetBlobOnceResult> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/links/${encodeURIComponent(id)}`,
      reqInit({ method: "GET" }, signal),
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return {
      status: "error",
      error: new ApiError("NETWORK_ERROR", "Could not reach VoidHop"),
    };
  }

  if (res.status === 200) {
    return { status: "ok", body: (await res.json()) as GetBlobResponse };
  }
  if (res.status === 404) {
    return { status: "not_found" };
  }

  const { code } = await parseErrorBody(res);
  const type = mapErrorCode(code);
  const retryAfter = retryAfterFromHeader(res);
  return {
    status: "error",
    error: new ApiError(
      type,
      `Get failed: ${type}`,
      apiErrorOpts({ retryAfter }),
    ),
  };
}

/**
 * Submit a verifier to unlock a password-protected link. SRS §4.5.
 *
 * On match the server returns the blob. On miss it returns 401 with the
 * remaining attempt count. At 0 attempts the server deletes the record and
 * responds 410 `LINK_DESTROYED`.
 */
export async function unlockLink(
  id: string,
  req: UnlockRequest,
  signal?: AbortSignal,
): Promise<UnlockResponse> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/links/${encodeURIComponent(id)}/unlock`,
      reqInit(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        },
        signal,
      ),
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("NETWORK_ERROR", "Could not reach VoidHop");
  }

  if (res.status === 200) {
    return (await res.json()) as UnlockResponse;
  }

  const { code, attemptsLeft, retryAfterMs } = await parseErrorBody(res);
  const type = mapErrorCode(code);
  const retryAfter = retryAfterFromHeader(res);
  throw new ApiError(
    type,
    `Unlock failed: ${type}`,
    apiErrorOpts({ retryAfter, attemptsLeft, retryAfterMs }),
  );
}

/**
 * Creator-initiated deletion via the 256-bit random token registered at
 * create time. The server recomputes SHA-256(token) and constant-time
 * compares with the stored hash. Missing or wrong token → 404 (uniform
 * error surface for privacy).
 */
export async function deleteLink(
  id: string,
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/links/${encodeURIComponent(id)}`,
      reqInit(
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        },
        signal,
      ),
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("NETWORK_ERROR", "Could not reach VoidHop");
  }
  if (res.status === 204) return;
  if (res.status === 404) throw new ApiError("NOT_FOUND", "Not found");
  throw new ApiError("SERVER_ERROR", `Delete failed: ${res.status}`);
}

export async function checkExists(
  id: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/links/${encodeURIComponent(id)}`,
      reqInit({ method: "HEAD" }, signal),
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
