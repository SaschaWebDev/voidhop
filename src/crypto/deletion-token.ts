/**
 * Creator deletion token. SRS §4.6.
 *
 * The creator generates a 32-byte random token at create time, sends only
 * SHA-256(token) to the server as `deletionTokenHash`, and keeps the raw
 * token in a separate delete-URL fragment. To delete the link later, the
 * creator re-submits the raw token; the server re-hashes and does a
 * constant-time comparison against the stored hash.
 *
 * Why no KDF: a uniformly-random 256-bit secret has ~256 bits of entropy.
 * Offline brute-force against SHA-256(token) is infeasible without a KDF;
 * the server-dump threat model is not improved by stretching.
 */

import { DELETION_TOKEN_BYTES } from "@/constants";
import { base64urlEncode } from "./encoding";

/**
 * Generate a fresh random deletion token and return both its base64url form
 * (for the URL fragment) and its SHA-256 hash in base64url (for the server).
 *
 * The raw token bytes are scrubbed before return.
 */
export async function generateDeletionToken(): Promise<{
  tokenB64url: string;
  hashB64url: string;
}> {
  const rawToken = new Uint8Array(DELETION_TOKEN_BYTES);
  crypto.getRandomValues(rawToken);

  const tokenB64url = base64urlEncode(rawToken);
  const hashB64url = await hashTokenB64url(tokenB64url);

  // Scrub raw bytes. The base64url string remains but that's the shareable
  // form anyway; caller decides its lifetime.
  crypto.getRandomValues(rawToken);

  return { tokenB64url, hashB64url };
}

/**
 * Hash a base64url-encoded deletion token with SHA-256 and return base64url.
 * Used by both the create flow (to submit the hash) and the delete flow (to
 * submit the raw token — which the server re-hashes for comparison).
 *
 * We hash the b64url-encoded string directly, not the raw bytes, because
 * there's no cryptographic advantage to one over the other here and hashing
 * the string sidesteps a round-trip decode on both ends.
 */
export async function hashTokenB64url(tokenB64url: string): Promise<string> {
  const bytes = new TextEncoder().encode(tokenB64url);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64urlEncode(new Uint8Array(digest));
}
