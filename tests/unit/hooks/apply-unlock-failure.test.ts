/**
 * `applyUnlockFailure` is the side-effectful half of the unlock state
 * machine: given an `UnlockOutcome` (wrong-password / backoff / destroyed
 * / not-found / network-error), it drives the corresponding React state
 * setters. The test uses `vi.fn()` spies for every setter so we can
 * assert exactly which ones fire for each outcome, without standing up
 * the full hook.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyUnlockFailure,
  type UnlockSetters,
} from "@/hooks/use-redirect";

type Mocked<T> = { [K in keyof T]: ReturnType<typeof vi.fn> };

let setters: Mocked<UnlockSetters>;
beforeEach(() => {
  setters = {
    setState: vi.fn(),
    setError: vi.fn(),
    setDestinationHref: vi.fn(),
    setAttemptsLeft: vi.fn(),
    setPasswordError: vi.fn(),
    setBackoffUntil: vi.fn(),
  };
  // Freeze Date.now so backoffUntil math is deterministic.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-17T00:00:00.000Z"));
});

describe("applyUnlockFailure: wrong-password", () => {
  it("sets attemptsLeft, passwordError, state; computes backoffUntil from retryAfterMs", () => {
    applyUnlockFailure(
      {
        kind: "wrong-password",
        attemptsLeft: 3,
        retryAfterMs: 5_000,
      },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setAttemptsLeft).toHaveBeenCalledWith(3);
    expect(setters.setPasswordError).toHaveBeenCalledWith(
      "Wrong password. Try again.",
    );
    expect(setters.setState).toHaveBeenCalledWith("password-required");
    expect(setters.setBackoffUntil).toHaveBeenCalledWith(
      Date.now() + 5_000,
    );
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("clears backoffUntil when retryAfterMs is absent", () => {
    applyUnlockFailure(
      { kind: "wrong-password", attemptsLeft: 4 },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setBackoffUntil).toHaveBeenCalledWith(null);
  });

  it("does not call setAttemptsLeft when the outcome omits attemptsLeft", () => {
    applyUnlockFailure(
      { kind: "wrong-password" },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setAttemptsLeft).not.toHaveBeenCalled();
    expect(setters.setPasswordError).toHaveBeenCalled();
  });
});

describe("applyUnlockFailure: backoff", () => {
  it("sets attemptsLeft + backoffUntil + state without setting passwordError", () => {
    applyUnlockFailure(
      {
        kind: "backoff",
        attemptsLeft: 2,
        retryAfterMs: 30_000,
      },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setAttemptsLeft).toHaveBeenCalledWith(2);
    expect(setters.setBackoffUntil).toHaveBeenCalledWith(Date.now() + 30_000);
    expect(setters.setState).toHaveBeenCalledWith("password-required");
    expect(setters.setPasswordError).not.toHaveBeenCalled();
  });

  it("skips setBackoffUntil when retryAfterMs is absent", () => {
    applyUnlockFailure(
      { kind: "backoff", attemptsLeft: 2 },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setBackoffUntil).not.toHaveBeenCalled();
  });
});

describe("applyUnlockFailure: terminal outcomes", () => {
  it("link-destroyed → setError + setState=error", () => {
    applyUnlockFailure(
      { kind: "link-destroyed" },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setError).toHaveBeenCalledWith({ type: "LINK_DESTROYED" });
    expect(setters.setState).toHaveBeenCalledWith("error");
  });

  it("not-found → setError + setState=error", () => {
    applyUnlockFailure(
      { kind: "not-found" },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setError).toHaveBeenCalledWith({ type: "NOT_FOUND" });
    expect(setters.setState).toHaveBeenCalledWith("error");
  });

  it("network-error → setError + setState=error", () => {
    applyUnlockFailure(
      { kind: "network-error" },
      setters as unknown as UnlockSetters,
    );
    expect(setters.setError).toHaveBeenCalledWith({ type: "NETWORK_ERROR" });
    expect(setters.setState).toHaveBeenCalledWith("error");
  });

  it("terminal outcomes never touch the password setters", () => {
    for (const kind of ["link-destroyed", "not-found", "network-error"] as const) {
      const local: Mocked<UnlockSetters> = {
        setState: vi.fn(),
        setError: vi.fn(),
        setDestinationHref: vi.fn(),
        setAttemptsLeft: vi.fn(),
        setPasswordError: vi.fn(),
        setBackoffUntil: vi.fn(),
      };
      applyUnlockFailure({ kind }, local as unknown as UnlockSetters);
      expect(local.setAttemptsLeft).not.toHaveBeenCalled();
      expect(local.setBackoffUntil).not.toHaveBeenCalled();
      expect(local.setPasswordError).not.toHaveBeenCalled();
    }
  });
});
