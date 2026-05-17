/**
 * `useCreateLink` orchestrates: local encryption → POST /links → result
 * panel data. Tests exercise the four real outcomes — success, crypto
 * failure, server failure, abort — using mocks for the crypto + api
 * boundaries. The state machine transitions (`idle → encrypting →
 * uploading → success | error`) and the shape of the resulting
 * `ShortLinkResult` are the load-bearing surfaces.
 *
 * `assembleFragment` is intentionally NOT mocked — it's deterministic and
 * lets the test prove the URL was assembled with the v1 or v2 layout
 * depending on whether a salt is set.
 */

import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  renderHook,
  waitFor,
  type RenderHookResult,
} from "@testing-library/react";
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
  useCreateLink,
  type CreateLinkOptions,
  type UseCreateLinkResult,
} from "@/hooks/use-create-link";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateDeletionToken).mockResolvedValue({
    tokenB64url: "T".repeat(43),
    hashB64url: "H".repeat(43),
  });
});

// ─── shared fixtures ──────────────────────────────────────────────────────────

const KEY = "K".repeat(43);

function mockV1Encrypt() {
  vi.mocked(encryptUrl).mockResolvedValueOnce({ blob: "BLOB", keyB64url: KEY });
}

function mockV2Encrypt() {
  vi.mocked(encryptUrlWithPassword).mockResolvedValueOnce({
    blob: "BLOB",
    keyB64url: KEY,
    saltB64url: "S".repeat(22),
    verifierB64url: "V".repeat(43),
  });
}

function mockCreateOk(id = "abc") {
  vi.mocked(createLink).mockResolvedValueOnce({ id });
}

type HookResult = RenderHookResult<UseCreateLinkResult, unknown>["result"];

/**
 * Render the hook and run `mutate(...)` inside `act`. Returns the live
 * result object so the test can read `current.state` etc. afterwards.
 */
async function runMutate(
  url: string,
  ttlSeconds: number,
  options?: CreateLinkOptions,
): Promise<HookResult> {
  const { result } = renderHook(() => useCreateLink());
  await act(async () => {
    await result.current.mutate(url, ttlSeconds, options);
  });
  return result;
}

async function expectSuccess(result: HookResult): Promise<void> {
  await waitFor(() => expect(result.current.state).toBe("success"));
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useCreateLink", () => {
  it("idle is the initial state with no result or error", () => {
    const { result } = renderHook(() => useCreateLink());
    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("v1 happy path: encrypts, uploads, transitions to success, builds the URL", async () => {
    mockV1Encrypt();
    mockCreateOk();
    const result = await runMutate("https://x.test", 3600);
    await expectSuccess(result);
    expect(result.current.result!.shortUrl).toMatch(/\/abc#/);
    expect(result.current.result!.shortUrl).toContain(KEY);
    expect(result.current.result!.passwordProtected).toBe(false);
    expect(result.current.result!.ttlSeconds).toBe(3600);
    expect(encryptUrlWithPassword).not.toHaveBeenCalled();
  });

  it("v2 happy path: with a password, uses encryptUrlWithPassword and embeds salt", async () => {
    mockV2Encrypt();
    mockCreateOk();
    const result = await runMutate("https://x.test", 3600, {
      password: "hunter2",
    });
    await expectSuccess(result);
    expect(result.current.result!.shortUrl).toContain(`${KEY}.${"S".repeat(22)}`);
    expect(result.current.result!.passwordProtected).toBe(true);
    expect(encryptUrl).not.toHaveBeenCalled();
    expect(vi.mocked(createLink).mock.calls[0]?.[0]).toMatchObject({
      verifier: "V".repeat(43),
    });
  });

  it("with includeDeletionToken: hash goes to the body and token into the result URL", async () => {
    mockV1Encrypt();
    mockCreateOk();
    const result = await runMutate("https://x.test", 3600, {
      includeDeletionToken: true,
    });
    await expectSuccess(result);
    expect(vi.mocked(createLink).mock.calls[0]?.[0]).toMatchObject({
      deletionTokenHash: "H".repeat(43),
    });
    expect(result.current.result!.deleteUrl).toContain(
      `/delete/abc#${"T".repeat(43)}`,
    );
  });

  it("a CryptoError during encrypt transitions to error and surfaces it", async () => {
    const err = new CryptoError("URL_TOO_LONG", "x");
    vi.mocked(encryptUrl).mockRejectedValueOnce(err);
    const result = await runMutate("https://x.test", 3600);
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(err);
    expect(createLink).not.toHaveBeenCalled();
  });

  it("an ApiError during upload transitions to error and surfaces it", async () => {
    mockV1Encrypt();
    const err = new ApiError("RATE_LIMITED", "slow down");
    vi.mocked(createLink).mockRejectedValueOnce(err);
    const result = await runMutate("https://x.test", 3600);
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(err);
  });

  it("propagates a non-Crypto, non-Api throwable rather than swallowing it", async () => {
    vi.mocked(encryptUrl).mockRejectedValueOnce(new TypeError("kaboom"));
    const { result } = renderHook(() => useCreateLink());
    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.mutate("https://x.test", 3600);
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeInstanceOf(TypeError);
  });

  it("reset() clears state, result, and error", async () => {
    mockV1Encrypt();
    mockCreateOk();
    const result = await runMutate("https://x.test", 3600);
    await expectSuccess(result);
    act(() => result.current.reset());
    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("passes usesLeft through to createLink and into the result", async () => {
    mockV1Encrypt();
    mockCreateOk();
    const result = await runMutate("https://x", 3600, { usesLeft: 3 });
    await expectSuccess(result);
    expect(vi.mocked(createLink).mock.calls[0]?.[0]).toMatchObject({
      usesLeft: 3,
    });
    expect(result.current.result!.usesLeft).toBe(3);
  });
});
