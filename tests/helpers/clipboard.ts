/**
 * Shared test helper: install a `vi.fn()`-backed `navigator.clipboard.writeText`
 * stub and return the spy so callers can assert what was copied.
 *
 * `ok = false` makes the writeText reject — useful for testing the
 * "copy failed, show no feedback" branch.
 *
 * Used across the password-field / result-panel component tests; before
 * extraction each file had its own ~6-line definition.
 */

import { vi } from "vitest";

export function withClipboard(ok = true): ReturnType<typeof vi.fn> {
  const writeText = vi.fn(
    ok ? () => Promise.resolve() : () => Promise.reject(new Error("denied")),
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}
