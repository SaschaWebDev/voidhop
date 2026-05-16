/**
 * Best-effort scrub for raw key material held in a Uint8Array.
 * Per SR-KEY-01: overwrite the buffer with fresh random bytes after use,
 * so any subsequent read of the same memory cells yields random data
 * instead of the secret.
 *
 * One-line wrapper around `crypto.getRandomValues` so the intent ("erase
 * this key, don't merely drop the reference") is grep-able at every call
 * site. JavaScript can't free or zero a String contents — for raw bytes,
 * this is the closest we get.
 */
export function scrubBytes(buf: Uint8Array): void {
  crypto.getRandomValues(buf);
}
