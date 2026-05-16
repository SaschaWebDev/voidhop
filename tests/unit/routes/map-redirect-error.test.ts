/**
 * `mapRedirectErrorToContent` returns the user-facing `{ title, message }`
 * pair that `<ErrorDisplay>` renders. Pure — the JSX wrapper is a
 * one-liner so this exhaustive map test is the actual coverage for the
 * branch logic.
 */

import { describe, expect, it } from "vitest";
import { mapRedirectErrorToContent } from "@/routes/$id";
import type { RedirectError } from "@/hooks/use-redirect";

describe("mapRedirectErrorToContent", () => {
  it("MISSING_KEY default (browser ok) — incomplete-link message", () => {
    const out = mapRedirectErrorToContent({
      type: "MISSING_KEY",
      inAppBrowser: false,
    });
    expect(out.title).toBe("This link is incomplete.");
    expect(out.message).toMatch(/decryption key is missing/i);
  });

  it("MISSING_KEY with inAppBrowser=true — in-app guidance", () => {
    const out = mapRedirectErrorToContent({
      type: "MISSING_KEY",
      inAppBrowser: true,
    });
    expect(out.title).toMatch(/in-app browser/i);
    expect(out.message).toMatch(/Open in Safari/);
    expect(out.message).toMatch(/Instagram, TikTok/);
  });

  it.each([
    ["MISSING_SALT", /password salt is missing/i],
    ["NOT_FOUND", /VoidHop links automatically expire/i],
    ["LINK_DESTROYED", /Too many wrong password attempts/i],
    ["TAMPERED", /failed integrity verification/i],
    ["DECRYPTION_FAILED", /decryption key may be wrong/i],
    ["UNSAFE_SCHEME", /http:\/\/ and https:\/\//],
    ["NETWORK_ERROR", /Check your connection/i],
  ] as const)("%s → mapped message", (type, msgPattern) => {
    const out = mapRedirectErrorToContent({ type } as RedirectError);
    expect(out.title).toBeTruthy();
    expect(out.message).toMatch(msgPattern);
  });

  it("unknown error type → generic fallback (no message)", () => {
    const out = mapRedirectErrorToContent({
      type: "WHATEVER_NEW",
    } as unknown as RedirectError);
    expect(out.title).toBe("Something went wrong.");
    expect(out.message).toBeUndefined();
  });
});
