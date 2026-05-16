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
import { copyToClipboard } from "@/hooks/use-shorten-form";
import {
  PasswordCopyIcon,
  PasswordEyeIcon,
  PasswordRefreshIcon,
} from "@/components/icons";
import { generatePassword } from "@/utils/generate-password";

const COPY_FEEDBACK_MS = 1500;

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
  const { backoffActive, backoffSeconds } = useBackoffCountdown(backoffUntil);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || backoffActive || password.length === 0) return;
    onSubmit(password);
  };

  const disabled = busy || backoffActive;

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
          <PasswordUnlockField
            value={password}
            onChange={setPassword}
            disabled={disabled}
          />
          <UnlockStatusRow
            backoffActive={backoffActive}
            backoffSeconds={backoffSeconds}
            errorMessage={errorMessage}
            attemptsLeft={attemptsLeft}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={disabled || password.length === 0}
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

/**
 * Re-render every 500 ms while a server-imposed backoff is in effect, so
 * the countdown text in the submit button stays current. Returns
 * `backoffActive: false` and `backoffSeconds: 0` outside the gate.
 */
function useBackoffCountdown(backoffUntil: number | null): {
  backoffActive: boolean;
  backoffSeconds: number;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (backoffUntil === null) return;
    const remainingMs = backoffUntil - Date.now();
    if (remainingMs <= 0) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(interval);
  }, [backoffUntil]);

  const now = Date.now();
  const remainingMs =
    backoffUntil !== null && backoffUntil > now ? backoffUntil - now : 0;
  return {
    backoffActive: remainingMs > 0,
    backoffSeconds: Math.ceil(remainingMs / 1000),
  };
}

/**
 * Inline password input with copy / show-hide / generate buttons. Owns its
 * own show-password and copy-feedback state so the parent form doesn't
 * have to.
 */
function PasswordUnlockField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (copied || value.length === 0) return;
    if (await copyToClipboard(value)) {
      setShowPassword(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
  };

  return (
    <div className="pwd-field">
      <input
        id="unlock-password"
        type={showPassword ? "text" : "password"}
        className="pwd-field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        autoFocus
        required
      />
      <button
        type="button"
        className={`pwd-field-btn${copied ? " pwd-field-btn-copied" : ""}`}
        onClick={onCopy}
        title={copied ? "copied" : "copy password"}
        tabIndex={-1}
        disabled={disabled || value.length === 0}
      >
        <PasswordCopyIcon copied={copied} />
      </button>
      <button
        type="button"
        className="pwd-field-btn"
        onClick={() => setShowPassword((v) => !v)}
        title={showPassword ? "hide password" : "show password"}
        tabIndex={-1}
        disabled={disabled || value.length === 0}
      >
        <PasswordEyeIcon shown={showPassword} />
      </button>
      <button
        type="button"
        className="pwd-field-btn"
        onClick={() => {
          onChange(generatePassword());
          setShowPassword(true);
        }}
        title="generate random password"
        tabIndex={-1}
        disabled={disabled}
      >
        <PasswordRefreshIcon />
      </button>
    </div>
  );
}

/**
 * Status messages below the input: backoff countdown OR error message,
 * plus the remaining-attempts indicator (which warns visually at ≤ 2).
 */
function UnlockStatusRow({
  backoffActive,
  backoffSeconds,
  errorMessage,
  attemptsLeft,
}: {
  backoffActive: boolean;
  backoffSeconds: number;
  errorMessage: string | null;
  attemptsLeft: number;
}) {
  const attemptsClass =
    attemptsLeft <= 2 ? "field-help field-help-warning" : "field-help";
  return (
    <>
      {backoffActive ? (
        <p className="field-help" style={{ color: "var(--warning-fg)" }}>
          Wait {backoffSeconds} second{backoffSeconds === 1 ? "" : "s"} before
          trying again.
        </p>
      ) : errorMessage ? (
        <p className="field-help" style={{ color: "var(--error-fg)" }}>
          {errorMessage}
        </p>
      ) : null}
      <p className={attemptsClass}>
        {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} remaining.
      </p>
    </>
  );
}
