/**
 * PasswordPrompt — unlock UI for v2 password-protected links. SRS §4.5.
 *
 * Stateless shell: the caller owns the password state, the busy flag, and
 * the remaining-attempts counter. That keeps strict-mode re-mounts from
 * double-submitting or resetting the input while a request is in flight.
 *
 * Supports the exponential-backoff gate (SRS §4.5.1). When `backoffUntil`
 * is set to a future epoch-ms, the submit button is disabled and a
 * per-second countdown is shown. A local effect ticks the display every
 * 500 ms until the gate lifts.
 */

import { useEffect, useState } from "react";
import { MAX_PASSWORD_ATTEMPTS } from "@/constants";

export interface PasswordPromptProps {
  /** Remaining attempts before the link self-destructs. */
  attemptsLeft: number;
  /** True while PBKDF2 + the unlock request are in flight. */
  busy: boolean;
  /** Last wrong-password message, if any. */
  errorMessage: string | null;
  /**
   * Epoch-ms until which the next unlock is rejected server-side. While
   * `now < backoffUntil` the submit button is disabled and a countdown is
   * displayed instead of the error message.
   */
  backoffUntil: number | null;
  /** Called with the submitted password on form submit. */
  onSubmit: (password: string) => void;
}

export function PasswordPrompt({
  attemptsLeft,
  busy,
  errorMessage,
  backoffUntil,
  onSubmit,
}: PasswordPromptProps) {
  const [password, setPassword] = useState("");

  // Tick to force a re-render while a backoff countdown is active. The
  // actual gating logic compares `backoffUntil` to the current time, so
  // we just need periodic renders to update the displayed seconds.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (backoffUntil === null) return;
    const remainingMs = backoffUntil - Date.now();
    if (remainingMs <= 0) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(interval);
  }, [backoffUntil]);

  const now = Date.now();
  const backoffRemainingMs =
    backoffUntil !== null && backoffUntil > now ? backoffUntil - now : 0;
  const backoffActive = backoffRemainingMs > 0;
  const backoffSeconds = Math.ceil(backoffRemainingMs / 1000);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || backoffActive || password.length === 0) return;
    onSubmit(password);
  };

  const attemptsClass =
    attemptsLeft <= 2 ? "field-help field-help-warning" : "field-help";

  return (
    <div className="card">
      <h1 className="card-title">This link is password-protected</h1>
      <p className="field-help">
        Enter the password the sender shared with you. After{" "}
        {MAX_PASSWORD_ATTEMPTS} wrong attempts the link is destroyed
        permanently.
      </p>
      <form onSubmit={onFormSubmit}>
        <div className="field">
          <label htmlFor="unlock-password" className="field-label">
            Password
          </label>
          <input
            id="unlock-password"
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy || backoffActive}
            autoComplete="off"
            autoFocus
            required
          />
          {backoffActive ? (
            <p className="field-help" style={{ color: "var(--warning-fg)" }}>
              Wait {backoffSeconds} second{backoffSeconds === 1 ? "" : "s"}{" "}
              before trying again.
            </p>
          ) : errorMessage ? (
            <p className="field-help" style={{ color: "var(--error-fg)" }}>
              {errorMessage}
            </p>
          ) : null}
          <p className={attemptsClass}>
            {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"}{" "}
            remaining.
          </p>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || backoffActive || password.length === 0}
        >
          {busy
            ? "Verifying…"
            : backoffActive
              ? `Try again in ${backoffSeconds}s`
              : "Unlock"}
        </button>
      </form>
    </div>
  );
}
