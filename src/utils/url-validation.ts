/**
 * URL validation. SRS §12.8.
 *
 * Two distinct entry points:
 *  - `validateInputUrl` runs at create time on user input (FR-CREATE-02).
 *  - `validateRedirectTarget` runs at redirect time on the decrypted plaintext.
 *    It returns the parsed `URL` object so the caller navigates via the
 *    canonical `href` form (SR-INPUT-07 / item 14).
 */

import { SUPPORTED_REDIRECT_SCHEMES } from "@/constants";

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ValidationError };

export type ValidationError =
  | { readonly type: "EMPTY" }
  | { readonly type: "PARSE_FAILED"; readonly message: string }
  | { readonly type: "UNSUPPORTED_SCHEME"; readonly scheme: string };

function tryParseUrl(s: string): URL | null {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

/**
 * Non-hierarchical schemes whose bodies do not start with `//`. We list
 * them explicitly because, with no `://` in the input, we otherwise can't
 * distinguish `mailto:foo@bar.com` from a `host:port` form like
 * `localhost:3000` — both look like `<word>:<rest>`. Members of this set
 * are surfaced as UNSUPPORTED_SCHEME errors before any auto-prepend logic
 * runs, so the user gets the right message and we never glue `https://` in
 * front of a `javascript:` payload.
 */
const NON_HIERARCHICAL_DANGEROUS_SCHEMES: ReadonlySet<string> = new Set([
  "javascript",
  "data",
  "vbscript",
  "file",
  "blob",
  "mailto",
  "tel",
  "sms",
  "fax",
]);

const SCHEME_NO_SLASHES_RE = /^([a-z][a-z0-9+.-]*):(?!\/\/)/i;

/**
 * Validates user-typed input at create time. Returns the (possibly
 * https-prefixed) input string on success — the caller passes that string to
 * the encryptor, not the parsed URL object, because the user may rely on
 * subtle formatting (trailing slash, query parameter order, etc.) that the
 * URL canonicalizer would change.
 *
 * If the input has no explicit scheme (e.g. `google.com`,
 * `example.com/path?q=v`, `localhost:3000`, `192.168.1.1/admin`), `https://`
 * is prepended so casual paste-from-the-address-bar input works without the
 * user having to think about protocols.
 */
export function validateInputUrl(raw: string): ValidationResult<string> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { type: "EMPTY" } };
  }

  if (trimmed.includes("://")) {
    const parsed = tryParseUrl(trimmed);
    if (!parsed) {
      return {
        ok: false,
        error: { type: "PARSE_FAILED", message: "could not parse as a URL" },
      };
    }
    if (!SUPPORTED_REDIRECT_SCHEMES.includes(parsed.protocol)) {
      return {
        ok: false,
        error: { type: "UNSUPPORTED_SCHEME", scheme: parsed.protocol },
      };
    }
    return { ok: true, value: trimmed };
  }

  // No `://`. Reject known non-hierarchical schemes up-front so we never
  // turn `mailto:foo@bar.com` into `https://mailto:foo@bar.com` (which the
  // URL parser would happily accept as a redirect to bar.com).
  const schemeMatch = SCHEME_NO_SLASHES_RE.exec(trimmed);
  if (schemeMatch && schemeMatch[1]) {
    const scheme = schemeMatch[1].toLowerCase();
    if (NON_HIERARCHICAL_DANGEROUS_SCHEMES.has(scheme)) {
      return {
        ok: false,
        error: { type: "UNSUPPORTED_SCHEME", scheme: `${scheme}:` },
      };
    }
    // Otherwise it's most likely a `host:port` form (localhost:3000) — fall
    // through to the prepend path.
  }

  const prefixed = `https://${trimmed}`;
  const parsed = tryParseUrl(prefixed);
  if (!parsed) {
    return {
      ok: false,
      error: { type: "PARSE_FAILED", message: "could not parse as a URL" },
    };
  }
  // The scheme is now `https:` by construction, so it's always supported.
  return { ok: true, value: prefixed };
}

/**
 * Validates a decrypted URL at redirect time. Returns the parsed `URL`
 * object on success. The caller MUST navigate using `result.value.href`,
 * never the raw decrypted string. SR-INPUT-04, SR-INPUT-07.
 */
export function validateRedirectTarget(
  decryptedUrl: string,
): ValidationResult<URL> {
  if (decryptedUrl.length === 0) {
    return { ok: false, error: { type: "EMPTY" } };
  }

  let parsed: URL;
  try {
    parsed = new URL(decryptedUrl);
  } catch (e) {
    return {
      ok: false,
      error: {
        type: "PARSE_FAILED",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  if (!SUPPORTED_REDIRECT_SCHEMES.includes(parsed.protocol)) {
    return {
      ok: false,
      error: { type: "UNSUPPORTED_SCHEME", scheme: parsed.protocol },
    };
  }

  return { ok: true, value: parsed };
}
