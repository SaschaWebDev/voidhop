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

// ─── Public source repository ─────────────────────────────────────────────────

/**
 * Public repository URL used by the footer's "Source" and commit-SHA links.
 *
 * The privacy claims VoidHop makes are only verifiable if a visitor can
 * inspect the code their browser is running. The footer shows the git SHA of
 * the build (injected via `__BUILD_SHA__` at build time) and links here; a
 * visitor should be able to navigate from the running site to the exact
 * source commit.
 *
 * Update this when you publish your fork / deployment's repository. The
 * default value is a placeholder and will 404 if not changed.
 */
export const REPO_URL = "https://github.com/SaschaWebDev/voidhop";

// ─── Redirect retry ───────────────────────────────────────────────────────────

/** Single 404 retry delay (SRS §12.5 / item 5). Exactly one retry. */
export const KV_REPLICATION_RETRY_DELAY_MS = 1500;

// ─── Optional password protection (v2 links) ──────────────────────────────────

/**
 * PBKDF2-SHA256 iteration count for password-derived keys. OWASP 2023
 * recommendation. Web Crypto only — no Argon2id/scrypt available natively.
 * Costs ~300-600 ms on a modern laptop; the price is paid once per unlock.
 */
export const PBKDF2_ITERATIONS = 600_000;

/** Salt size for PBKDF2. 16 bytes → 22 base64url chars unpadded. */
export const PASSWORD_SALT_BYTES = 16;
export const PASSWORD_SALT_B64URL_LENGTH = 22;

/**
 * Size of the server-side access verifier (HKDF output from K_pwd).
 * Same length as an AES-256 key; encoded as 43 base64url chars.
 */
export const VERIFIER_BYTES = 32;
export const VERIFIER_B64URL_LENGTH = 43;

/**
 * How many wrong password attempts a protected link tolerates before the
 * worker deletes the record. Counter resets to this value on a successful
 * unlock so legitimate users with a typo burst are not punished.
 */
export const MAX_PASSWORD_ATTEMPTS = 5;

/**
 * HKDF `info` strings for domain separation. Both derivations start from
 * K_pwd but the distinct info strings guarantee the verifier and the
 * encryption key are cryptographically independent.
 */
export const HKDF_INFO_ENC = "voidhop-enc-v2";
export const HKDF_INFO_VERIFY = "voidhop-verify-v2";

/**
 * Fragment separator between the AES key and the salt for password-protected
 * links. Chosen because it is URL-safe and outside the base64url alphabet
 * `[A-Za-z0-9_-]`, so `fragment.includes(".")` is an unambiguous protection
 * probe.
 */
export const FRAGMENT_SALT_SEPARATOR = ".";

// ─── Multi-use counter ────────────────────────────────────────────────────────

export interface UsesLeftOption {
  /** Undefined = unlimited (TTL is the only cap). */
  readonly value: number | undefined;
  readonly label: string;
}

/**
 * Opt-in "link expires after N opens" options. Server sees the count; client
 * decrements it on each successful retrieval (v1) or successful unlock (v2).
 * At zero the server deletes the record.
 *
 * Unlimited is the default — adding `usesLeft` is an intentional privacy
 * tradeoff (server now writes to KV on every read / unlock, so read timing
 * and frequency are visible in infra logs).
 */
export const USES_LEFT_OPTIONS: readonly UsesLeftOption[] = [
  { value: undefined, label: "Unlimited (until expiry)" },
  { value: 1, label: "Once (self-destruct on read)" },
  { value: 3, label: "3 times" },
  { value: 10, label: "10 times" },
] as const;

/** Upper bound for `usesLeft` when present — keeps the field small and auditable. */
export const MAX_USES_LEFT = 100;

// ─── Creator deletion token ───────────────────────────────────────────────────

/**
 * Size of the random creator-deletion token. 32 bytes = 256 bits; no KDF is
 * needed because brute-forcing a uniformly random 256-bit secret is infeasible.
 * The token lives only in the delete-URL fragment; the server stores only
 * SHA-256(token).
 */
export const DELETION_TOKEN_BYTES = 32;
export const DELETION_TOKEN_B64URL_LENGTH = 43;
export const DELETION_TOKEN_HASH_B64URL_LENGTH = 43;

// ─── Password retry backoff ───────────────────────────────────────────────────

/**
 * Wait (milliseconds) required after the Nth wrong-password miss, indexed by
 * the value of `attemptsLeft` AFTER the miss. The schedule rises quickly so
 * that an attacker who knows a weak password must spend ~2 minutes per try
 * in the late game, while a typo-fumbling user only waits 1 second.
 *
 * Indexed so that index `k` = the delay after the miss that leaves
 * `attemptsLeft === k`.
 */
export const PASSWORD_BACKOFF_MS_BY_ATTEMPTS_LEFT: readonly number[] = [
  0, // 0 attempts left = destroyed, unreachable
  120_000, // 1 attempt left → 2 min
  30_000, // 2 attempts left → 30s
  5_000, // 3 attempts left → 5s
  1_000, // 4 attempts left → 1s
  0, // 5 attempts left → no delay (fresh state, first miss is cheap)
];
