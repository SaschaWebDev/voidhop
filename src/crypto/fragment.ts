/**
 * URL fragment format for short links.
 *
 *   v1 (no password):  #<key-b64url-43chars>
 *   v2 (password):     #<key-b64url-43chars>.<salt-b64url-22chars>
 *
 * The separator `.` is outside the base64url alphabet (A–Z, a–z, 0–9, `-`,
 * `_`) so the two halves are unambiguous. The fragment lives only in the
 * client's URL; servers never see it (HTTP spec §3.5).
 *
 * Both halves are validated by exact length up-front so the redirect flow
 * fails fast on a mangled fragment rather than prompting the user to type a
 * password against a link that can never unlock.
 */

import {
  AES_KEY_B64URL_LENGTH,
  FRAGMENT_SALT_SEPARATOR,
  PASSWORD_SALT_B64URL_LENGTH,
} from "@/constants";

export type ParseFragmentResult =
  | { ok: true; keyB64url: string; saltB64url: string | null }
  | { ok: false; error: "MISSING_KEY" | "MISSING_SALT" };

/**
 * Build a v1 or v2 fragment from the key (required) and optional salt.
 * Pure: no DOM, no globals, no I/O.
 */
export function assembleFragment(
  keyB64url: string,
  saltB64url: string | null,
): string {
  return saltB64url !== null
    ? `${keyB64url}${FRAGMENT_SALT_SEPARATOR}${saltB64url}`
    : keyB64url;
}

/**
 * Parse a URL fragment (with or without leading `#`) and validate its shape.
 * Pure: no DOM, no globals, no I/O.
 *
 * A secondary `#` is stripped defensively — no legitimate producer emits
 * one, but a tampered URL or browser quirk could.
 */
export function parseFragment(rawHashOrFragment: string): ParseFragmentResult {
  const withoutHash = rawHashOrFragment.startsWith("#")
    ? rawHashOrFragment.slice(1)
    : rawHashOrFragment;

  const firstHashStripped = withoutHash.split("#")[0] ?? "";

  const separatorIdx = firstHashStripped.indexOf(FRAGMENT_SALT_SEPARATOR);
  const keyPart =
    separatorIdx === -1
      ? firstHashStripped
      : firstHashStripped.slice(0, separatorIdx);
  const saltPart =
    separatorIdx === -1 ? "" : firstHashStripped.slice(separatorIdx + 1);

  if (keyPart.length !== AES_KEY_B64URL_LENGTH) {
    return { ok: false, error: "MISSING_KEY" };
  }

  const isProtected = separatorIdx !== -1;
  if (isProtected && saltPart.length !== PASSWORD_SALT_B64URL_LENGTH) {
    return { ok: false, error: "MISSING_SALT" };
  }

  return {
    ok: true,
    keyB64url: keyPart,
    saltB64url: isProtected ? saltPart : null,
  };
}
