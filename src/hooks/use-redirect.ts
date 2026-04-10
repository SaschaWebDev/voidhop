/**
 * useRedirect — Redirect flow state machine. SRS §12.5.
 *
 * Implements the security-critical mount sequence:
 *   1. Read the hash, structurally validate (43 chars exactly).
 *   2. `window.history.replaceState(...)` to scrub the hash from the address
 *      bar BEFORE any further code runs (SR-FRAG-04, item 9).
 *   3. Fetch the blob with a single retry on 404 (item 5).
 *   4. Decrypt (which scrubs the raw key bytes per SR-KEY-01).
 *   5. Validate the decrypted URL via the URL constructor.
 *   6. Navigate via `validated.href` — never the raw decrypted string
 *      (SR-INPUT-07, item 14).
 *
 * Missing-key errors run a User-Agent check against IN_APP_BROWSER_UA_PATTERNS
 * to provide a targeted "your in-app browser broke this link" message
 * (item 16).
 */

import { useEffect, useRef, useState } from "react";
import { AES_KEY_B64URL_LENGTH } from "@/constants";
import { decryptBlob, CryptoError } from "@/crypto";
import { getBlob } from "@/api/client";
import { ApiError } from "@/api/types";
import { isInAppBrowser } from "@/utils/ua-detection";
import { validateRedirectTarget } from "@/utils/url-validation";

export type RedirectState =
  | "loading"
  | "confirming" // KV replication retry in progress
  | "decrypting"
  | "validating"
  | "redirecting"
  | "error";

export type RedirectErrorType =
  | "MISSING_KEY"
  | "NOT_FOUND"
  | "DECRYPTION_FAILED"
  | "TAMPERED"
  | "UNSAFE_SCHEME"
  | "NETWORK_ERROR";

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
}

export function useRedirect(id: string): UseRedirectResult {
  const [state, setState] = useState<RedirectState>("loading");
  const [error, setError] = useState<RedirectError | null>(null);
  const [destinationHref, setDestinationHref] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // React 19 strict mode mounts effects twice in development. Guard so we
    // do not double-fetch and double-replaceState.
    if (startedRef.current) return;
    startedRef.current = true;

    const ac = new AbortController();
    void run(id, ac.signal, setState, setError, setDestinationHref);
    return () => ac.abort();
    // We deliberately depend only on `id`. State setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { state, error, destinationHref };
}

async function run(
  id: string,
  signal: AbortSignal,
  setState: (s: RedirectState) => void,
  setError: (e: RedirectError) => void,
  setDestinationHref: (h: string) => void,
): Promise<void> {
  // ── 1. Read & structurally validate the hash ──────────────────────────────
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const keyB64url = rawHash.split("#")[0] ?? "";

  if (keyB64url.length !== AES_KEY_B64URL_LENGTH) {
    setError({
      type: "MISSING_KEY",
      inAppBrowser: isInAppBrowser(navigator.userAgent),
    });
    setState("error");
    return;
  }

  // ── 2. Scrub the hash from the address bar IMMEDIATELY ────────────────────
  // Per SR-FRAG-04 — do this before any subsequent navigation, fetch, or
  // render so no browser quirk can inherit the fragment into the destination.
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    // history.replaceState can throw in highly unusual sandboxed contexts.
    // Continue anyway — the rest of the flow does not depend on this succeeding.
  }

  // ── 3. Fetch the blob with single 404 retry ───────────────────────────────
  let blob: string;
  try {
    const res = await getBlob(id, {
      signal,
      onRetry: () => setState("confirming"),
    });
    blob = res.blob;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof ApiError) {
      if (e.type === "NOT_FOUND") {
        setError({ type: "NOT_FOUND" });
      } else if (e.type === "NETWORK_ERROR") {
        setError({ type: "NETWORK_ERROR" });
      } else {
        setError({ type: "NETWORK_ERROR" });
      }
      setState("error");
      return;
    }
    setError({ type: "NETWORK_ERROR" });
    setState("error");
    return;
  }

  if (signal.aborted) return;

  // ── 4. Decrypt ────────────────────────────────────────────────────────────
  setState("decrypting");
  let decryptedString: string;
  try {
    decryptedString = await decryptBlob(blob, keyB64url);
  } catch (e) {
    if (e instanceof CryptoError) {
      // GCM tag failure or padding error → tampered
      setError({
        type:
          e.type === "DECRYPTION_FAILED" || e.type === "PADDING_INVALID"
            ? "TAMPERED"
            : "DECRYPTION_FAILED",
      });
    } else {
      setError({ type: "DECRYPTION_FAILED" });
    }
    setState("error");
    return;
  }

  if (signal.aborted) return;

  // ── 5. Validate the decrypted URL ─────────────────────────────────────────
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

  // ── 6. Navigate via the canonical URL.href ────────────────────────────────
  // SR-INPUT-07 — never pass the raw decrypted string anywhere.
  const href = validation.value.href;
  setDestinationHref(href);
  setState("redirecting");
  // Schedule the navigation on the next macrotask so the redirecting splash
  // has a chance to render and the manual fallback link is wired up.
  window.setTimeout(() => {
    window.location.replace(href);
  }, 50);
}
