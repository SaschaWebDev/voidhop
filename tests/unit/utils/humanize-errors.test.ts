/**
 * Unit tests for `humanizeInputError` and `humanizeCreateError`.
 *
 * Both are pure mapping functions over the URL-validation /
 * CryptoError / ApiError discriminated unions. Exercising every branch
 * guards against silent regressions when the unions are extended.
 */

import { describe, expect, it } from "vitest";
import { ApiError, type ApiErrorType } from "@/api/types";
import { CryptoError } from "@/crypto";
import {
  humanizeInputError,
  humanizeCreateError,
} from "@/utils/humanize-errors";

describe("humanizeInputError", () => {
  it.each([
    ["EMPTY", "Please enter a URL."],
    ["PARSE_FAILED", "That doesn't look like a valid URL."],
    ["UNSUPPORTED_SCHEME", "Only http:// and https:// URLs are supported."],
  ])("maps %s to a stable message", (type, msg) => {
    expect(humanizeInputError(type)).toBe(msg);
  });

  it("falls back to a generic message for unknown types", () => {
    expect(humanizeInputError("???")).toBe("Invalid URL.");
    expect(humanizeInputError("")).toBe("Invalid URL.");
  });
});

describe("humanizeCreateError", () => {
  describe("CryptoError branches", () => {
    it("URL_TOO_LONG → specific message", () => {
      expect(humanizeCreateError(new CryptoError("URL_TOO_LONG", "x"))).toBe(
        "This URL is too long to shorten.",
      );
    });

    it("PASSWORD_EMPTY → specific message", () => {
      expect(humanizeCreateError(new CryptoError("PASSWORD_EMPTY", "x"))).toBe(
        "Password must not be empty.",
      );
    });

    it.each([
      ["DECRYPTION_FAILED"],
      ["PADDING_INVALID"],
      ["KEY_INVALID"],
      ["BLOB_INVALID"],
      ["SALT_INVALID"],
    ] as const)("other CryptoError types fall through to generic (%s)", (t) => {
      expect(humanizeCreateError(new CryptoError(t, "x"))).toBe(
        "Encryption failed in your browser.",
      );
    });
  });

  describe("ApiError branches", () => {
    const expectations: ReadonlyArray<readonly [ApiErrorType, string]> = [
      ["RATE_LIMITED", "You've created too many links recently. Try again in a few minutes."],
      ["BUDGET_EXHAUSTED", "VoidHop has reached its daily link creation limit. Try again tomorrow."],
      ["ORIGIN_BUDGET_EXHAUSTED", "This service has reached today's quota for your origin."],
      ["BLOB_TOO_LARGE", "This URL is too long to shorten."],
      ["VALIDATION_ERROR", "The server rejected the request. This usually means the URL is malformed."],
      ["NETWORK_ERROR", "Could not reach VoidHop. Check your connection."],
      ["SERVER_ERROR", "Something went wrong on the server."],
    ];

    for (const [type, msg] of expectations) {
      it(`${type} → mapped message`, () => {
        expect(humanizeCreateError(new ApiError(type, "x"))).toBe(msg);
      });
    }

    it("NOT_FOUND → misconfigured-endpoint guidance", () => {
      const out = humanizeCreateError(new ApiError("NOT_FOUND", "x"));
      expect(out).toMatch(/misconfigured/i);
      expect(out).toMatch(/create endpoint is unreachable/i);
    });

    it.each([
      ["WRONG_PASSWORD"],
      ["LINK_DESTROYED"],
      ["BACKOFF"],
    ] as const)(
      "unlock-flow %s falls through to generic server error",
      (type) => {
        expect(humanizeCreateError(new ApiError(type, "x"))).toBe(
          "Something went wrong on the server.",
        );
      },
    );
  });
});
