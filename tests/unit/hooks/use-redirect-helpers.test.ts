/**
 * `mapUnlockApiError` translates `ApiError` instances thrown by `unlockLink`
 * into the `UnlockOutcome` discriminated union the unlock state machine
 * acts on. Pure, file-local helper that we exported solely so this test
 * can exercise every branch without driving the full hook lifecycle.
 */

import { describe, expect, it } from "vitest";
import { mapUnlockApiError, type UnlockOutcome } from "@/hooks/use-redirect";
import { ApiError } from "@/api/types";

describe("mapUnlockApiError", () => {
  it("returns network-error for non-ApiError throwables", () => {
    expect(mapUnlockApiError(new Error("boom"))).toEqual({
      kind: "network-error",
    });
    expect(mapUnlockApiError("string")).toEqual({ kind: "network-error" });
    expect(mapUnlockApiError(null)).toEqual({ kind: "network-error" });
  });

  it("WRONG_PASSWORD carries attemptsLeft and retryAfterMs when present", () => {
    const err = new ApiError("WRONG_PASSWORD", "x", {
      attemptsLeft: 3,
      retryAfterMs: 5000,
    });
    const out = mapUnlockApiError(err);
    expect(out).toEqual<UnlockOutcome>({
      kind: "wrong-password",
      attemptsLeft: 3,
      retryAfterMs: 5000,
    });
  });

  it("WRONG_PASSWORD without metadata omits the optional fields", () => {
    const err = new ApiError("WRONG_PASSWORD", "x");
    const out = mapUnlockApiError(err);
    expect(out.kind).toBe("wrong-password");
    expect("attemptsLeft" in out).toBe(false);
    expect("retryAfterMs" in out).toBe(false);
  });

  it("BACKOFF carries attemptsLeft and retryAfterMs", () => {
    const err = new ApiError("BACKOFF", "x", {
      attemptsLeft: 2,
      retryAfterMs: 30_000,
    });
    expect(mapUnlockApiError(err)).toEqual<UnlockOutcome>({
      kind: "backoff",
      attemptsLeft: 2,
      retryAfterMs: 30_000,
    });
  });

  it("BACKOFF drops a non-positive retryAfterMs", () => {
    const err = new ApiError("BACKOFF", "x", {
      attemptsLeft: 2,
      retryAfterMs: 0,
    });
    const out = mapUnlockApiError(err);
    expect("retryAfterMs" in out).toBe(false);
  });

  it("LINK_DESTROYED → kind=link-destroyed (no metadata)", () => {
    expect(mapUnlockApiError(new ApiError("LINK_DESTROYED", "x"))).toEqual({
      kind: "link-destroyed",
    });
  });

  it("NOT_FOUND → kind=not-found", () => {
    expect(mapUnlockApiError(new ApiError("NOT_FOUND", "x"))).toEqual({
      kind: "not-found",
    });
  });

  it("any other ApiError type falls through to network-error", () => {
    expect(mapUnlockApiError(new ApiError("SERVER_ERROR", "x"))).toEqual({
      kind: "network-error",
    });
    expect(mapUnlockApiError(new ApiError("RATE_LIMITED", "x"))).toEqual({
      kind: "network-error",
    });
  });
});
