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

/**
 * Validates user-typed input at create time. Returns the trimmed input string
 * on success — the caller passes the original string to the encryptor, not
 * the parsed URL object, because the user may rely on subtle formatting
 * (trailing slash, query parameter order, etc.) that the URL canonicalizer
 * would change.
 */
export function validateInputUrl(raw: string): ValidationResult<string> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { type: "EMPTY" } };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
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

  return { ok: true, value: trimmed };
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
