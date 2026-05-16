/**
 * Cryptographically random password generator for the create-form's
 * "generate" button. 16–24 character output using a curated charset that
 * excludes visually-ambiguous glyphs (0/O, 1/l/I).
 *
 * Side effect: consumes entropy from `crypto.getRandomValues`. The function
 * itself is otherwise pure — no I/O, no DOM, no state.
 */
export function generatePassword(): string {
  const charset =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*_";
  const lenByte = new Uint8Array(1);
  crypto.getRandomValues(lenByte);
  const len = 16 + ((lenByte[0] ?? 0) % 9);
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}
