/**
 * Centralized constants for VoidHop. Per SRS §12.7.
 *
 * Anything that controls a security boundary, a network limit, or a UX quota
 * lives here so it has exactly one source of truth and is trivial to audit.
 */

// ─── TTL options ──────────────────────────────────────────────────────────────

export interface TtlOption {
  readonly label: string;
  readonly seconds: number;
}

/**
 * Per SRS §6.2 / FR-CREATE-03 — three options, 7 days is the universal max.
 * The 30-day and 1-year options were removed in v1.1.1 because the universal
 * cap bounds the storage exhaustion window to a self-healing 7-day window.
 */
export const TTL_OPTIONS: readonly TtlOption[] = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
] as const;

export const DEFAULT_TTL_SECONDS = 604800;
export const MAX_TTL_SECONDS = 604800; // universal 7-day cap

export const ALLOWED_TTL_SECONDS: readonly number[] = TTL_OPTIONS.map(
  (o) => o.seconds,
);

// ─── Blob size & padding ──────────────────────────────────────────────────────

export const MAX_BLOB_SIZE_BYTES = 256 * 1024; // 256 KB
export const MAX_BLOB_SIZE_B64 = Math.ceil((MAX_BLOB_SIZE_BYTES * 4) / 3); // ~349,526

/**
 * Tiered padding buckets per SRS §4.4a. Plaintexts are padded to the smallest
 * bucket that can hold the 4-byte length header plus the plaintext bytes.
 */
export const PADDING_BUCKETS: readonly number[] = [
  1024, // 1 KB
  10240, // 10 KB
  51200, // 50 KB
  102400, // 100 KB
  262144, // 256 KB
] as const;

/** Length-prefix header size — see SRS §4.4 */
export const LENGTH_HEADER_BYTES = 4;

export class UrlTooLongError extends Error {
  constructor() {
    super("URL is too long to shorten");
    this.name = "UrlTooLongError";
  }
}

/**
 * Returns the smallest bucket that can hold the length header plus `plaintextLen`.
 * Throws `UrlTooLongError` if no bucket fits.
 */
export function pickBucket(plaintextLen: number): number {
  for (const bucket of PADDING_BUCKETS) {
    if (LENGTH_HEADER_BYTES + plaintextLen <= bucket) return bucket;
  }
  throw new UrlTooLongError();
}

// (v1.1.0 had a TTL_CEILINGS_BY_SIZE table here. Removed in v1.1.1 because
// the universal MAX_TTL_SECONDS cap subsumes per-size ceilings.)

// ─── URL schemes ──────────────────────────────────────────────────────────────

export const SUPPORTED_REDIRECT_SCHEMES: readonly string[] = [
  "http:",
  "https:",
] as const;

// ─── Link IDs ─────────────────────────────────────────────────────────────────

export const ID_MIN_LENGTH = 6;
export const ID_MAX_LENGTH = 12;
export const ID_DEFAULT_LENGTH = 8; // 6 random bytes → 8 base64url chars

// ─── AES key encoding ─────────────────────────────────────────────────────────

/**
 * Exact base64url length of a 32-byte AES-256 key with no padding.
 * SR-FRAG-05 requires the redirect page to short-circuit on any other length.
 */
export const AES_KEY_B64URL_LENGTH = 43;
export const AES_KEY_BYTES = 32;
export const AES_GCM_IV_BYTES = 12;
export const AES_GCM_TAG_BYTES = 16;

// ─── In-app browser detection ─────────────────────────────────────────────────

/**
 * User-Agent substrings for in-app browsers known to mangle URL fragments.
 * Substring match (not regex) for speed and obvious auditability.
 * SRS FR-REDIRECT-02.
 */
export const IN_APP_BROWSER_UA_PATTERNS: readonly string[] = [
  "Instagram",
  "FBAN",
  "FBAV",
  "FB_IAB",
  "Messenger",
  "TikTok",
  "musical_ly",
  "MicroMessenger", // WeChat
  "Line/",
  "KAKAOTALK",
  "Twitter",
  "LinkedInApp",
] as const;

// ─── Per-origin daily write sub-quotas ────────────────────────────────────────

/**
 * Fraction of the global DAILY_WRITE_BUDGET that each CORS-allowed origin
 * may consume. Per SRS §9.3 (item 20). Origins not in this map default to 0
 * (deny) — but unlisted origins are already rejected by CORS.
 */
export const PER_ORIGIN_BUDGET_FRACTION: Readonly<Record<string, number>> = {
  "https://voidhop.com": 1.0,
  "https://notefade.com": 0.6,
};

// ─── API ──────────────────────────────────────────────────────────────────────

export const API_BASE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) ??
  "/api/v1";

// ─── Redirect retry ───────────────────────────────────────────────────────────

/** Single 404 retry delay (SRS §12.5 / item 5). Exactly one retry. */
export const KV_REPLICATION_RETRY_DELAY_MS = 1500;
