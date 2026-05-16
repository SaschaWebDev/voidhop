/**
 * `statusLabel` is the pure string-mapper that the redirect route uses to
 * pick the splash text for each transient state. Exhaustively covered so
 * a future state-machine variant either gets a label or visibly falls
 * through to the ellipsis default.
 */

import { describe, expect, it } from "vitest";
import { statusLabel } from "@/routes/$id";

describe("statusLabel", () => {
  it.each([
    ["loading", "Loading…"],
    ["confirming", "Confirming link…"],
    ["verifying", "Verifying password…"],
    ["decrypting", "Decrypting in your browser…"],
    ["validating", "Validating destination…"],
    ["redirecting", "Redirecting…"],
  ])("maps %s → %s", (state, expected) => {
    expect(statusLabel(state)).toBe(expected);
  });

  it("falls back to ellipsis for unknown states", () => {
    expect(statusLabel("password-required")).toBe("…");
    expect(statusLabel("success")).toBe("…");
    expect(statusLabel("")).toBe("…");
    expect(statusLabel("anything-else")).toBe("…");
  });
});
