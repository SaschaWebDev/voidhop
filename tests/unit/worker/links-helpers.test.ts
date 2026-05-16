/**
 * Unit tests for the pure helpers in `worker/routes/links.ts`.
 *
 * Each helper is a validator, builder, refresher, or constant-time
 * comparator that the request handlers compose into the POST/GET/UNLOCK/
 * DELETE flows. Exercising them in isolation keeps the integration tests
 * focused on routing/store wiring and lets us guard the per-field
 * security gates (ID/verifier/blob/uses-left/deletion-hash charset and
 * length) without standing up Hono or Miniflare.
 */

import { describe, expect, it } from "vitest";
import type { LinkRecordV2 } from "../../../worker/types";
import {
  buildLinkRecord,
  checkBackoffGate,
  constantTimeEqual,
  isBase64UrlString,
  isValidDeletionTokenHash,
  isValidId,
  isValidUsesLeft,
  isValidVerifier,
  parseCreateInput,
  refreshRecord,
  validateBlob,
  type CreateInput,
} from "../../../worker/routes/links";

const VALID_VERIFIER = "a".repeat(43);
const VALID_DELETION_HASH = "b".repeat(43);
const VALID_BLOB = "AAAA"; // tiny base64url-charset blob; the validator
// only checks shape, not crypto correctness.

describe("isValidId", () => {
  it.each([
    ["6-char alnum", "abc123"],
    ["12-char alnum", "abcDEF123456"],
    ["dashes allowed", "abc-d_f"],
    ["underscores allowed", "abc_def_ghi"],
  ])("accepts %s", (_, id) => {
    expect(isValidId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short (5)", "abcde"],
    ["too long (13)", "abcdefghijklm"],
    ["plus sign", "abc+ef"],
    ["slash", "abc/ef"],
    ["space", "abc def"],
    ["unicode", "abcdéf"],
  ])("rejects %s", (_, id) => {
    expect(isValidId(id)).toBe(false);
  });
});

describe("isBase64UrlString", () => {
  it("accepts exact-length base64url strings", () => {
    expect(isBase64UrlString("a".repeat(43), 43)).toBe(true);
    expect(isBase64UrlString("Aa0-_", 5)).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(isBase64UrlString(123, 3)).toBe(false);
    expect(isBase64UrlString(null, 0)).toBe(false);
    expect(isBase64UrlString(undefined, 0)).toBe(false);
    expect(isBase64UrlString({}, 0)).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isBase64UrlString("a".repeat(42), 43)).toBe(false);
    expect(isBase64UrlString("a".repeat(44), 43)).toBe(false);
  });

  it("rejects out-of-alphabet characters", () => {
    expect(isBase64UrlString("aaa+", 4)).toBe(false); // standard base64 only
    expect(isBase64UrlString("aaa/", 4)).toBe(false);
    expect(isBase64UrlString("aaa=", 4)).toBe(false); // no padding in base64url
    expect(isBase64UrlString("aaa.", 4)).toBe(false);
    expect(isBase64UrlString("aaá ", 4)).toBe(false);
  });
});

describe("isValidVerifier", () => {
  it("requires exactly 43 base64url chars", () => {
    expect(isValidVerifier(VALID_VERIFIER)).toBe(true);
    expect(isValidVerifier("a".repeat(42))).toBe(false);
    expect(isValidVerifier("a".repeat(44))).toBe(false);
    expect(isValidVerifier("/".repeat(43))).toBe(false);
    expect(isValidVerifier(42)).toBe(false);
  });
});

describe("isValidDeletionTokenHash", () => {
  it("requires exactly 43 base64url chars", () => {
    expect(isValidDeletionTokenHash(VALID_DELETION_HASH)).toBe(true);
    expect(isValidDeletionTokenHash("b".repeat(42))).toBe(false);
    expect(isValidDeletionTokenHash(null)).toBe(false);
  });
});

describe("isValidUsesLeft", () => {
  it.each([1, 5, 50, 99, 100])("accepts %i", (n) => {
    expect(isValidUsesLeft(n)).toBe(true);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["over ceiling", 101],
    ["float", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["string '5'", "5"],
    ["boolean true", true],
    ["null", null],
  ])("rejects %s", (_, n) => {
    expect(isValidUsesLeft(n)).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("returns false for length mismatches", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("abc", "ab")).toBe(false);
  });

  it("returns false for same-length mismatches", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("xbc", "abc")).toBe(false);
    expect(constantTimeEqual("a".repeat(43), "b".repeat(43))).toBe(false);
  });
});

describe("validateBlob", () => {
  it("accepts a small base64url blob", () => {
    expect(validateBlob(VALID_BLOB)).toEqual({ ok: true });
  });

  it("rejects non-string blob with INVALID_BLOB", () => {
    expect(validateBlob(42)).toEqual({
      ok: false,
      status: 400,
      body: { error: "INVALID_BLOB" },
    });
    expect(validateBlob(null)).toMatchObject({
      ok: false,
      body: { error: "INVALID_BLOB" },
    });
  });

  it("rejects empty string with BLOB_TOO_LARGE", () => {
    expect(validateBlob("")).toMatchObject({
      ok: false,
      body: { error: "BLOB_TOO_LARGE" },
    });
  });

  it("rejects oversize blob with BLOB_TOO_LARGE", () => {
    // MAX_BLOB_SIZE_BYTES = 256 KiB ⇒ MAX_B64 = ~349525
    const huge = "A".repeat(350_000);
    expect(validateBlob(huge)).toMatchObject({
      ok: false,
      body: { error: "BLOB_TOO_LARGE" },
    });
  });

  it("rejects out-of-charset chars with INVALID_BLOB", () => {
    expect(validateBlob("AAA+")).toMatchObject({
      ok: false,
      body: { error: "INVALID_BLOB" },
    });
    expect(validateBlob("AAA=")).toMatchObject({
      ok: false,
      body: { error: "INVALID_BLOB" },
    });
  });
});

describe("parseCreateInput", () => {
  const okBody = (extra: Record<string, unknown> = {}) => ({
    blob: VALID_BLOB,
    ttl: 3600,
    ...extra,
  });

  it("accepts a minimal v1 body", () => {
    const r = parseCreateInput(okBody());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input).toEqual({
        blob: VALID_BLOB,
        ttl: 3600,
        verifier: null,
        usesLeft: undefined,
        deletionTokenHash: undefined,
      });
    }
  });

  it("accepts a full v2 body with verifier + usesLeft + deletion hash", () => {
    const r = parseCreateInput(
      okBody({
        verifier: VALID_VERIFIER,
        usesLeft: 5,
        deletionTokenHash: VALID_DELETION_HASH,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.verifier).toBe(VALID_VERIFIER);
      expect(r.input.usesLeft).toBe(5);
      expect(r.input.deletionTokenHash).toBe(VALID_DELETION_HASH);
    }
  });

  it.each([3600, 86400, 604800])("accepts ttl %i", (ttl) => {
    expect(parseCreateInput(okBody({ ttl })).ok).toBe(true);
  });

  it.each([
    ["INVALID_BLOB on missing blob", { ttl: 3600 }, "INVALID_BLOB"],
    ["INVALID_TTL on non-allowed ttl", { blob: VALID_BLOB, ttl: 60 }, "INVALID_TTL"],
    ["INVALID_TTL on non-int ttl", { blob: VALID_BLOB, ttl: 3600.5 }, "INVALID_TTL"],
    ["INVALID_TTL on string ttl", { blob: VALID_BLOB, ttl: "3600" }, "INVALID_TTL"],
    [
      "INVALID_VERIFIER on bad verifier",
      { blob: VALID_BLOB, ttl: 3600, verifier: "short" },
      "INVALID_VERIFIER",
    ],
    [
      "INVALID_USES_LEFT on zero",
      { blob: VALID_BLOB, ttl: 3600, usesLeft: 0 },
      "INVALID_USES_LEFT",
    ],
    [
      "INVALID_USES_LEFT on over-ceiling",
      { blob: VALID_BLOB, ttl: 3600, usesLeft: 1000 },
      "INVALID_USES_LEFT",
    ],
    [
      "INVALID_DELETION_TOKEN_HASH on bad hash",
      { blob: VALID_BLOB, ttl: 3600, deletionTokenHash: "nope" },
      "INVALID_DELETION_TOKEN_HASH",
    ],
  ])("rejects: %s", (_, body, expectedError) => {
    const r = parseCreateInput(body as Record<string, unknown>);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.body.error).toBe(expectedError);
    }
  });

  it("treats undefined verifier as v1 (verifier=null)", () => {
    const r = parseCreateInput(okBody());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.verifier).toBeNull();
  });
});

describe("buildLinkRecord", () => {
  const createdAt = "2026-05-17T00:00:00.000Z";
  const baseV1: CreateInput = {
    blob: VALID_BLOB,
    ttl: 3600,
    verifier: null,
    usesLeft: undefined,
    deletionTokenHash: undefined,
  };

  it("builds a minimal v1 record", () => {
    const r = buildLinkRecord(baseV1, createdAt);
    expect(r).toEqual({
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt,
      version: 1,
    });
  });

  it("includes usesLeft on v1 when provided", () => {
    const r = buildLinkRecord({ ...baseV1, usesLeft: 3 }, createdAt);
    expect(r).toMatchObject({ version: 1, usesLeft: 3 });
  });

  it("includes deletionTokenHash on v1 when provided", () => {
    const r = buildLinkRecord(
      { ...baseV1, deletionTokenHash: VALID_DELETION_HASH },
      createdAt,
    );
    expect(r).toMatchObject({
      version: 1,
      deletionTokenHash: VALID_DELETION_HASH,
    });
  });

  it("builds a v2 record with attemptsLeft=5 when a verifier is set", () => {
    const r = buildLinkRecord(
      { ...baseV1, verifier: VALID_VERIFIER },
      createdAt,
    );
    expect(r).toMatchObject({
      version: 2,
      verifier: VALID_VERIFIER,
      attemptsLeft: 5,
    });
  });

  it("omits undefined optional fields rather than emitting `undefined` (exactOptionalPropertyTypes)", () => {
    const r = buildLinkRecord(baseV1, createdAt);
    expect("usesLeft" in r).toBe(false);
    expect("deletionTokenHash" in r).toBe(false);
  });
});

describe("refreshRecord", () => {
  const base: LinkRecordV2 = {
    blob: VALID_BLOB,
    ttl: 3600,
    createdAt: "2026-05-17T00:00:00.000Z",
    version: 2,
    verifier: VALID_VERIFIER,
    attemptsLeft: 3,
    usesLeft: 2,
    backoffUntil: 1_700_000_000_000,
  };

  it("overrides attemptsLeft", () => {
    const r = refreshRecord(base, { attemptsLeft: 5 });
    expect(r.attemptsLeft).toBe(5);
  });

  it("overrides usesLeft", () => {
    const r = refreshRecord(base, { usesLeft: 1 });
    expect(r.usesLeft).toBe(1);
  });

  it("clearBackoff removes backoffUntil", () => {
    const r = refreshRecord(base, { clearBackoff: true });
    expect("backoffUntil" in r).toBe(false);
  });

  it("preserves backoffUntil when not cleared", () => {
    const r = refreshRecord(base, { attemptsLeft: 4 });
    expect(r.backoffUntil).toBe(base.backoffUntil);
  });

  it("sets a new backoffUntil if supplied", () => {
    const r = refreshRecord(base, { backoffUntil: 9_999 });
    expect(r.backoffUntil).toBe(9_999);
  });

  it("preserves deletionTokenHash on the new record", () => {
    const r = refreshRecord(
      { ...base, deletionTokenHash: VALID_DELETION_HASH },
      { attemptsLeft: 5 },
    );
    expect(r.deletionTokenHash).toBe(VALID_DELETION_HASH);
  });

  it("omits deletionTokenHash on the new record when source omits it", () => {
    const noHash: LinkRecordV2 = { ...base };
    delete (noHash as { deletionTokenHash?: string }).deletionTokenHash;
    const r = refreshRecord(noHash, { attemptsLeft: 5 });
    expect("deletionTokenHash" in r).toBe(false);
  });

  it("omits usesLeft on the new record when source omits it and opts don't set it", () => {
    const noUses: LinkRecordV2 = { ...base };
    delete (noUses as { usesLeft?: number }).usesLeft;
    const r = refreshRecord(noUses, { attemptsLeft: 5 });
    expect("usesLeft" in r).toBe(false);
  });
});

describe("checkBackoffGate", () => {
  const base: LinkRecordV2 = {
    blob: VALID_BLOB,
    ttl: 3600,
    createdAt: "2026-05-17T00:00:00.000Z",
    version: 2,
    verifier: VALID_VERIFIER,
    attemptsLeft: 3,
  };

  it("returns null when backoffUntil is absent", () => {
    expect(checkBackoffGate(base, Date.now())).toBeNull();
  });

  it("returns null when backoffUntil is already past", () => {
    const r = { ...base, backoffUntil: 1000 };
    expect(checkBackoffGate(r, 2000)).toBeNull();
  });

  it("returns null when backoffUntil equals now (boundary)", () => {
    const r = { ...base, backoffUntil: 5000 };
    expect(checkBackoffGate(r, 5000)).toBeNull();
  });

  it("returns BACKOFF body + Retry-After when within window", () => {
    const now = 1_000_000;
    const backoffUntil = now + 12_345;
    const r = { ...base, backoffUntil, attemptsLeft: 2 };
    const result = checkBackoffGate(r, now);
    expect(result).not.toBeNull();
    expect(result!.body).toEqual({
      error: "BACKOFF",
      attemptsLeft: 2,
      retryAfterMs: 12_345,
    });
    // ceil(12345/1000) = 13
    expect(result!.headers["Retry-After"]).toBe("13");
  });
});
