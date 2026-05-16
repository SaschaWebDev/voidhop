/**
 * Direct unit tests for the two pure step functions composed by
 * `useCreateLink.mutate`: `runEncryptStep` and `runUploadStep`. Each is
 * thin orchestration over the crypto / api modules; the value of the
 * tests is enumerating every error-branch outcome so the state machine
 * stays well-defined.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CryptoError } from "@/crypto";
import { ApiError } from "@/api/types";

vi.mock("@/crypto", async () => {
  const actual =
    await vi.importActual<typeof import("@/crypto")>("@/crypto");
  return {
    ...actual,
    encryptUrl: vi.fn(),
    encryptUrlWithPassword: vi.fn(),
    generateDeletionToken: vi.fn(),
  };
});

vi.mock("@/api/client", () => ({
  createLink: vi.fn(),
}));

import {
  encryptUrl,
  encryptUrlWithPassword,
  generateDeletionToken,
} from "@/crypto";
import { createLink } from "@/api/client";
import {
  runEncryptStep,
  runUploadStep,
  type EncryptedPayload,
} from "@/hooks/use-create-link";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateDeletionToken).mockResolvedValue({
    tokenB64url: "T".repeat(43),
    hashB64url: "H".repeat(43),
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("runEncryptStep", () => {
  it("v1 path: returns a payload with no verifier/salt when no password", async () => {
    vi.mocked(encryptUrl).mockResolvedValueOnce({
      blob: "B",
      keyB64url: "K".repeat(43),
    });
    const out = await runEncryptStep("https://x", undefined, false);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload.blob).toBe("B");
      expect(out.payload.saltB64url).toBeNull();
      expect(out.payload.verifierB64url).toBeNull();
      expect(out.payload.deletionTokenB64url).toBeNull();
    }
    expect(encryptUrlWithPassword).not.toHaveBeenCalled();
  });

  it("v2 path: with a password, uses encryptUrlWithPassword and embeds salt+verifier", async () => {
    vi.mocked(encryptUrlWithPassword).mockResolvedValueOnce({
      blob: "B",
      keyB64url: "K".repeat(43),
      saltB64url: "S".repeat(22),
      verifierB64url: "V".repeat(43),
    });
    const out = await runEncryptStep("https://x", "hunter2", false);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload.saltB64url).toBe("S".repeat(22));
      expect(out.payload.verifierB64url).toBe("V".repeat(43));
    }
    expect(encryptUrl).not.toHaveBeenCalled();
  });

  it("empty password falls back to v1 (no encryptUrlWithPassword call)", async () => {
    vi.mocked(encryptUrl).mockResolvedValueOnce({
      blob: "B",
      keyB64url: "K".repeat(43),
    });
    const out = await runEncryptStep("https://x", "", false);
    expect(out.ok).toBe(true);
    expect(encryptUrlWithPassword).not.toHaveBeenCalled();
    expect(encryptUrl).toHaveBeenCalled();
  });

  it("includes a deletion token when opted in", async () => {
    vi.mocked(encryptUrl).mockResolvedValueOnce({
      blob: "B",
      keyB64url: "K".repeat(43),
    });
    const out = await runEncryptStep("https://x", undefined, true);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload.deletionTokenB64url).toBe("T".repeat(43));
      expect(out.payload.deletionTokenHashB64url).toBe("H".repeat(43));
    }
  });

  it("returns ok:false with a CryptoError instead of throwing", async () => {
    const err = new CryptoError("URL_TOO_LONG", "x");
    vi.mocked(encryptUrl).mockRejectedValueOnce(err);
    const out = await runEncryptStep("https://x", undefined, false);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe(err);
  });

  it("re-throws non-CryptoError throwables (programmer errors stay loud)", async () => {
    vi.mocked(encryptUrl).mockRejectedValueOnce(new TypeError("boom"));
    await expect(
      runEncryptStep("https://x", undefined, false),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

const emptyPayload: EncryptedPayload = {
  blob: "B",
  keyB64url: "K".repeat(43),
  saltB64url: null,
  verifierB64url: null,
  deletionTokenB64url: null,
  deletionTokenHashB64url: null,
};

describe("runUploadStep", () => {
  it("returns {ok: true, id} when createLink resolves", async () => {
    vi.mocked(createLink).mockResolvedValueOnce({ id: "abc123" });
    const out = await runUploadStep(
      emptyPayload,
      3600,
      undefined,
      new AbortController().signal,
    );
    expect(out).toEqual({ ok: true, id: "abc123" });
  });

  it("forwards verifier, usesLeft and deletionTokenHash to createLink only when present", async () => {
    vi.mocked(createLink).mockResolvedValueOnce({ id: "abc" });
    const payload: EncryptedPayload = {
      ...emptyPayload,
      verifierB64url: "V".repeat(43),
      deletionTokenHashB64url: "H".repeat(43),
    };
    await runUploadStep(payload, 3600, 7, new AbortController().signal);
    expect(vi.mocked(createLink).mock.calls[0]?.[0]).toMatchObject({
      blob: "B",
      ttl: 3600,
      verifier: "V".repeat(43),
      usesLeft: 7,
      deletionTokenHash: "H".repeat(43),
    });
  });

  it("returns kind=aborted on an AbortError", async () => {
    vi.mocked(createLink).mockRejectedValueOnce(
      new DOMException("Aborted", "AbortError"),
    );
    const out = await runUploadStep(
      emptyPayload,
      3600,
      undefined,
      new AbortController().signal,
    );
    expect(out).toEqual({ ok: false, kind: "aborted" });
  });

  it("returns kind=api-error with the ApiError on a server failure", async () => {
    const err = new ApiError("RATE_LIMITED", "slow");
    vi.mocked(createLink).mockRejectedValueOnce(err);
    const out = await runUploadStep(
      emptyPayload,
      3600,
      undefined,
      new AbortController().signal,
    );
    expect(out.ok).toBe(false);
    if (!out.ok && out.kind === "api-error") {
      expect(out.error).toBe(err);
    } else {
      throw new Error("expected api-error");
    }
  });

  it("re-throws other throwables (programmer errors stay loud)", async () => {
    vi.mocked(createLink).mockRejectedValueOnce(new TypeError("boom"));
    await expect(
      runUploadStep(
        emptyPayload,
        3600,
        undefined,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
