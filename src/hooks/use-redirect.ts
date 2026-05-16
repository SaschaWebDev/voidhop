/**
 * useRedirect — Redirect flow state machine. SRS §12.5 + §4.5.
 *
 * Unprotected (v1) mount sequence:
 *   1. Read the hash; structurally validate the key (43 chars).
 *   2. `history.replaceState` to scrub the fragment IMMEDIATELY (SR-FRAG-04).
 *   3. Fetch the blob with a single retry on 404 (SRS §12.5 item 5).
 *   4. Decrypt (key is scrubbed per SR-KEY-01).
 *   5. Validate the decrypted URL via the URL constructor.
 *   6. Navigate via `validated.href` (SR-INPUT-07).
 *
 * Protected (v2) mount sequence diverges after step 3: the GET returns
 * `{ protected: true }`, the hook transitions to `password-required`, and the
 * UI collects a password. `submitPassword` then:
 *   a. PBKDF2(password, salt) → K_pwd             (~300–600 ms)
 *   b. HKDF(K_pwd, "verify") → verifier
 *   c. POST /unlock { verifier }
 *      • 200 { blob }         → decrypt with HKDF(key ‖ K_pwd) → validate → navigate
 *      • 401 WRONG_PASSWORD   → decrement counter, stay on password-required
 *      • 410 LINK_DESTROYED   → error state
 *
 * StrictMode considerations: `startedRef` guards the initial effect so the
 * hash is scrubbed exactly once. The hook intentionally does NOT abort
 * in-flight work on cleanup — see the comment inside the effect below.
 * `submitPassword` is user-driven and guarded by the UI's `busy` state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PASSWORD_ATTEMPTS } from "@/constants";
import { parseFragment } from "@/crypto/fragment";
import {
  base64urlDecode,
  base64urlEncode,
  CryptoError,
  decryptBlob,
  decryptBlobWithPassword,
  deriveKPwd,
  deriveVerifier,
} from "@/crypto";
import { scrubBytes } from "@/crypto/scrub";
import { getBlob, unlockLink } from "@/api/client";
import { ApiError } from "@/api/types";
import { isInAppBrowser } from "@/utils/ua-detection";
import { validateRedirectTarget } from "@/utils/url-validation";

export type RedirectState =
  | "loading"
  | "confirming" // KV replication retry in progress
  | "password-required"
  | "verifying" // PBKDF2 + unlock request in flight
  | "decrypting"
  | "validating"
  | "redirecting"
  | "error";

export type RedirectErrorType =
  | "MISSING_KEY"
  | "MISSING_SALT"
  | "NOT_FOUND"
  | "DECRYPTION_FAILED"
  | "TAMPERED"
  | "UNSAFE_SCHEME"
  | "NETWORK_ERROR"
  | "LINK_DESTROYED";

export interface RedirectError {
  readonly type: RedirectErrorType;
  /** True for MISSING_KEY when the User-Agent matches a known in-app browser */
  readonly inAppBrowser?: boolean;
  /** Set for UNSAFE_SCHEME to surface in the error message */
  readonly scheme?: string;
}

export interface UseRedirectResult {
  state: RedirectState;
  error: RedirectError | null;
  /** Set during the 'redirecting' state for the manual fallback link */
  destinationHref: string | null;
  /** Non-null during `password-required` / `verifying`. */
  attemptsLeft: number | null;
  /** Most recent wrong-password message, or `null` while in a fresh state. */
  passwordError: string | null;
  /**
   * Wall-clock epoch ms at which a new unlock attempt is permitted. Null
   * when the UI should allow a submission immediately.
   */
  backoffUntil: number | null;
  /** Non-null only during `password-required`. UI disables itself via `busy`. */
  submitPassword: ((password: string) => void) | null;
}

export interface UnlockSetters {
  setState: (s: RedirectState) => void;
  setError: (e: RedirectError) => void;
  setDestinationHref: (h: string) => void;
  setAttemptsLeft: (n: number) => void;
  setPasswordError: (s: string | null) => void;
  setBackoffUntil: (ms: number | null) => void;
}

export function useRedirect(id: string): UseRedirectResult {
  const [state, setState] = useState<RedirectState>("loading");
  const [error, setError] = useState<RedirectError | null>(null);
  const [destinationHref, setDestinationHref] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(
    MAX_PASSWORD_ATTEMPTS,
  );
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [backoffUntil, setBackoffUntil] = useState<number | null>(null);

  const startedRef = useRef(false);
  // Captured from the fragment on first mount. Kept in refs so we retain them
  // across the StrictMode double-effect even though the hash itself is scrubbed.
  const keyB64urlRef = useRef<string | null>(null);
  const saltB64urlRef = useRef<string | null>(null);

  useEffect(() => {
    // React 19 strict mode mounts effects twice in development. `startedRef`
    // makes initial run idempotent — crucially because we scrub the fragment
    // via replaceState, so a second run would read an empty hash.
    //
    // We intentionally do NOT abort in-flight work on cleanup. Cleanup fires
    // synchronously between strict-mode's two mounts, and the ref guard blocks
    // the second mount, so aborting here would kill the only fetch. The final
    // `window.location.replace` is guarded by a pathname check to avoid
    // "ghost redirects" on real unmount.
    if (startedRef.current) return;
    startedRef.current = true;
    void runInitial(
      id,
      setState,
      setError,
      setDestinationHref,
      setAttemptsLeft,
      keyB64urlRef,
      saltB64urlRef,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitPassword = useCallback(
    (password: string) => {
      const keyB64url = keyB64urlRef.current;
      const saltB64url = saltB64urlRef.current;
      if (keyB64url === null || saltB64url === null) return;
      if (password.length === 0) return;
      // UI should prevent clicks while `backoffUntil > now`, but guard here
      // too so a racing call can't slip past.
      if (backoffUntil !== null && backoffUntil > Date.now()) return;
      void runUnlock(id, password, keyB64url, saltB64url, {
        setState,
        setError,
        setDestinationHref,
        setAttemptsLeft,
        setPasswordError,
        setBackoffUntil,
      });
    },
    [id, backoffUntil],
  );

  const isPasswordState =
    state === "password-required" || state === "verifying";

  return {
    state,
    error,
    destinationHref,
    attemptsLeft: isPasswordState ? attemptsLeft : null,
    passwordError: isPasswordState ? passwordError : null,
    backoffUntil: isPasswordState ? backoffUntil : null,
    submitPassword: state === "password-required" ? submitPassword : null,
  };
}

// ─── Initial run: hash parse → replaceState → GET → branch ────────────────────

async function runInitial(
  id: string,
  setState: (s: RedirectState) => void,
  setError: (e: RedirectError) => void,
  setDestinationHref: (h: string) => void,
  setAttemptsLeft: (n: number) => void,
  keyB64urlRef: React.MutableRefObject<string | null>,
  saltB64urlRef: React.MutableRefObject<string | null>,
): Promise<void> {
  const parsed = parseFragment(window.location.hash);
  if (!parsed.ok) {
    setError(parseFragmentErrorToRedirectError(parsed.error));
    setState("error");
    return;
  }

  keyB64urlRef.current = parsed.keyB64url;
  saltB64urlRef.current = parsed.saltB64url;
  const isProtected = parsed.saltB64url !== null;

  // Scrub the hash from the address bar IMMEDIATELY (SR-FRAG-04).
  scrubFragmentFromAddressBar();

  // Fetch with single 404 retry.
  let body: Awaited<ReturnType<typeof getBlob>>;
  try {
    body = await getBlob(id, { onRetry: () => setState("confirming") });
  } catch (e) {
    setError(fetchErrorToRedirectError(e));
    setState("error");
    return;
  }

  // Branch on protected vs. open.
  if ("protected" in body && body.protected === true) {
    if (!isProtected) {
      // Server says protected but the URL has no salt — this link was created
      // as v2 but the sharer truncated the fragment before the separator.
      setError({ type: "MISSING_SALT" });
      setState("error");
      return;
    }
    // Seed the UI counter from the server so fresh tabs show the truth.
    setAttemptsLeft(body.attemptsLeft);
    setState("password-required");
    return;
  }

  // Unprotected — the blob is in the response body. Mismatch (URL had a salt
  // but server returned v1) falls back to the open flow rather than erroring.
  if (!("blob" in body)) {
    setError({ type: "NETWORK_ERROR" });
    setState("error");
    return;
  }
  await finishOpenRedirect(
    id,
    body.blob,
    parsed.keyB64url,
    setState,
    setError,
    setDestinationHref,
  );
}

function parseFragmentErrorToRedirectError(
  error: "MISSING_KEY" | "MISSING_SALT",
): RedirectError {
  if (error === "MISSING_KEY") {
    return {
      type: "MISSING_KEY",
      inAppBrowser: isInAppBrowser(navigator.userAgent),
    };
  }
  return { type: "MISSING_SALT" };
}

function fetchErrorToRedirectError(err: unknown): RedirectError {
  if (err instanceof ApiError) {
    return { type: err.type === "NOT_FOUND" ? "NOT_FOUND" : "NETWORK_ERROR" };
  }
  return { type: "NETWORK_ERROR" };
}

function scrubFragmentFromAddressBar(): void {
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    // replaceState can throw in highly unusual sandboxed contexts; harmless.
  }
}

// ─── Unlock + decrypt path (v2 protected) ─────────────────────────────────────

export type UnlockOutcome =
  | { kind: "ok"; blob: string }
  | { kind: "wrong-password"; attemptsLeft?: number; retryAfterMs?: number }
  | { kind: "backoff"; attemptsLeft?: number; retryAfterMs?: number }
  | { kind: "link-destroyed" }
  | { kind: "not-found" }
  | { kind: "network-error" };

async function runUnlock(
  id: string,
  password: string,
  keyB64url: string,
  saltB64url: string,
  setters: UnlockSetters,
): Promise<void> {
  const {
    setState,
    setError,
    setPasswordError,
    setBackoffUntil,
  } = setters;
  setState("verifying");
  setPasswordError(null);
  setBackoffUntil(null);

  // Derive K_pwd and compute the verifier. K_pwd stays alive past this point
  // so the subsequent decrypt can reuse it; it's scrubbed in the finally.
  const derived = await deriveKPwdAndVerifier(password, saltB64url);
  if (!derived.ok) {
    setError({ type: derived.error });
    setState("error");
    return;
  }
  const { kPwd, verifierB64url } = derived;

  try {
    const outcome = await submitVerifier(id, verifierB64url);
    if (outcome.kind !== "ok") {
      applyUnlockFailure(outcome, setters);
      return;
    }
    await decryptAndFinish(
      id,
      outcome.blob,
      keyB64url,
      saltB64url,
      password,
      setters,
    );
  } finally {
    // K_pwd is no longer needed regardless of which path we took.
    scrubBytes(kPwd);
  }
}

async function deriveKPwdAndVerifier(
  password: string,
  saltB64url: string,
): Promise<
  | { ok: true; kPwd: Uint8Array; verifierB64url: string }
  | { ok: false; error: "MISSING_SALT" | "DECRYPTION_FAILED" }
> {
  let salt: Uint8Array;
  try {
    salt = base64urlDecode(saltB64url);
  } catch {
    return { ok: false, error: "MISSING_SALT" };
  }

  try {
    const kPwd = await deriveKPwd(password, salt);
    const verifier = await deriveVerifier(kPwd);
    const verifierB64url = base64urlEncode(verifier);
    scrubBytes(verifier);
    return { ok: true, kPwd, verifierB64url };
  } catch {
    return { ok: false, error: "DECRYPTION_FAILED" };
  }
}

async function submitVerifier(
  id: string,
  verifierB64url: string,
): Promise<UnlockOutcome> {
  try {
    const res = await unlockLink(id, { verifier: verifierB64url });
    return { kind: "ok", blob: res.blob };
  } catch (e) {
    return mapUnlockApiError(e);
  }
}

export function mapUnlockApiError(err: unknown): UnlockOutcome {
  if (!(err instanceof ApiError)) return { kind: "network-error" };
  switch (err.type) {
    case "WRONG_PASSWORD":
      return { kind: "wrong-password", ...attemptMetadata(err) };
    case "BACKOFF":
      return { kind: "backoff", ...attemptMetadata(err) };
    case "LINK_DESTROYED":
      return { kind: "link-destroyed" };
    case "NOT_FOUND":
      return { kind: "not-found" };
    default:
      return { kind: "network-error" };
  }
}

function attemptMetadata(
  err: ApiError,
): { attemptsLeft?: number; retryAfterMs?: number } {
  const out: { attemptsLeft?: number; retryAfterMs?: number } = {};
  if (typeof err.attemptsLeft === "number") {
    out.attemptsLeft = err.attemptsLeft;
  }
  if (typeof err.retryAfterMs === "number" && err.retryAfterMs > 0) {
    out.retryAfterMs = err.retryAfterMs;
  }
  return out;
}

export function applyUnlockFailure(
  outcome: Exclude<UnlockOutcome, { kind: "ok" }>,
  setters: UnlockSetters,
): void {
  const {
    setState,
    setError,
    setAttemptsLeft,
    setPasswordError,
    setBackoffUntil,
  } = setters;
  switch (outcome.kind) {
    case "wrong-password":
      if (outcome.attemptsLeft !== undefined) {
        setAttemptsLeft(outcome.attemptsLeft);
      }
      setBackoffUntil(
        outcome.retryAfterMs !== undefined
          ? Date.now() + outcome.retryAfterMs
          : null,
      );
      setPasswordError("Wrong password. Try again.");
      setState("password-required");
      return;
    case "backoff":
      if (outcome.attemptsLeft !== undefined) {
        setAttemptsLeft(outcome.attemptsLeft);
      }
      if (outcome.retryAfterMs !== undefined) {
        setBackoffUntil(Date.now() + outcome.retryAfterMs);
      }
      // Don't show a wrong-password message — the user didn't submit a new
      // guess, they just hit the gate too early.
      setState("password-required");
      return;
    case "link-destroyed":
      setError({ type: "LINK_DESTROYED" });
      setState("error");
      return;
    case "not-found":
      setError({ type: "NOT_FOUND" });
      setState("error");
      return;
    case "network-error":
      setError({ type: "NETWORK_ERROR" });
      setState("error");
      return;
  }
}

async function decryptAndFinish(
  id: string,
  blob: string,
  keyB64url: string,
  saltB64url: string,
  password: string,
  setters: UnlockSetters,
): Promise<void> {
  const { setState, setError, setDestinationHref } = setters;
  setState("decrypting");
  let decryptedString: string;
  try {
    decryptedString = await decryptBlobWithPassword(
      blob,
      keyB64url,
      saltB64url,
      password,
    );
  } catch (e) {
    setError(cryptoErrorToRedirectError(e));
    setState("error");
    return;
  }
  await finishWithPlaintext(
    id,
    decryptedString,
    setState,
    setError,
    setDestinationHref,
  );
}

// ─── Shared tail: validate + navigate (v1 path) ───────────────────────────────

async function finishOpenRedirect(
  id: string,
  blob: string,
  keyB64url: string,
  setState: (s: RedirectState) => void,
  setError: (e: RedirectError) => void,
  setDestinationHref: (h: string) => void,
): Promise<void> {
  setState("decrypting");
  let decryptedString: string;
  try {
    decryptedString = await decryptBlob(blob, keyB64url);
  } catch (e) {
    setError(cryptoErrorToRedirectError(e));
    setState("error");
    return;
  }
  await finishWithPlaintext(
    id,
    decryptedString,
    setState,
    setError,
    setDestinationHref,
  );
}

function cryptoErrorToRedirectError(err: unknown): RedirectError {
  if (err instanceof CryptoError) {
    return {
      type:
        err.type === "DECRYPTION_FAILED" || err.type === "PADDING_INVALID"
          ? "TAMPERED"
          : "DECRYPTION_FAILED",
    };
  }
  return { type: "DECRYPTION_FAILED" };
}

async function finishWithPlaintext(
  id: string,
  decryptedString: string,
  setState: (s: RedirectState) => void,
  setError: (e: RedirectError) => void,
  setDestinationHref: (h: string) => void,
): Promise<void> {
  setState("validating");
  const validation = validateRedirectTarget(decryptedString);
  if (!validation.ok) {
    if (validation.error.type === "UNSUPPORTED_SCHEME") {
      setError({
        type: "UNSAFE_SCHEME",
        scheme: validation.error.scheme,
      });
    } else {
      setError({ type: "UNSAFE_SCHEME", scheme: "unknown" });
    }
    setState("error");
    return;
  }

  // SR-INPUT-07 — never pass the raw decrypted string anywhere.
  const href = validation.value.href;
  setDestinationHref(href);
  setState("redirecting");
  // Defer navigation so the splash paints and the manual fallback link
  // is wired up. Pathname guard prevents ghost redirects if the user
  // navigated away while the async chain was running.
  window.setTimeout(() => {
    if (window.location.pathname !== `/${id}`) return;
    window.location.replace(href);
  }, 50);
}
