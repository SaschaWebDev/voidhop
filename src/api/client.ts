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
} from "./types";

interface ErrorBody {
  error?: string;
}

async function parseErrorBody(res: Response): Promise<string | undefined> {
  try {
    const json = (await res.json()) as ErrorBody;
    return json.error;
  } catch {
    return undefined;
  }
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
      return "VALIDATION_ERROR";
    case "NOT_FOUND":
      return "NOT_FOUND";
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
    res = await fetch(`${API_BASE}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("NETWORK_ERROR", "Could not reach VoidHop");
  }

  if (res.status === 201) {
    return (await res.json()) as CreateLinkResponse;
  }

  const code = await parseErrorBody(res);
  const type = mapErrorCode(code);
  const retryAfter = retryAfterFromHeader(res);
  throw new ApiError(type, `Create failed: ${type}`, retryAfter);
}

/**
 * Fetch a blob with a single retry on 404. SRS §12.5.
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
    res = await fetch(`${API_BASE}/links/${encodeURIComponent(id)}`, {
      method: "GET",
      signal,
    });
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

  const code = await parseErrorBody(res);
  const type = mapErrorCode(code);
  const retryAfter = retryAfterFromHeader(res);
  return {
    status: "error",
    error: new ApiError(type, `Get failed: ${type}`, retryAfter),
  };
}

export async function deleteLink(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/links/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal,
    });
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
    const res = await fetch(`${API_BASE}/links/${encodeURIComponent(id)}`, {
      method: "HEAD",
      signal,
    });
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
