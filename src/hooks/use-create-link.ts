/**
 * useCreateLink — Create flow state machine. SRS §12.4.
 *
 * Granular state values reinforce that encryption happens locally before
 * the network call. When `password` is passed to `mutate`, the encryption
 * path is `encryptUrlWithPassword` and the short URL fragment gets the
 * salt appended as `#<key>.<salt>`.
 */

import { useCallback, useRef, useState } from "react";
import {
  encryptUrl,
  encryptUrlWithPassword,
  generateDeletionToken,
  CryptoError,
} from "@/crypto";
import { assembleFragment } from "@/crypto/fragment";
import { createLink } from "@/api/client";
import { ApiError } from "@/api/types";

export type CreateState =
  | "idle"
  | "encrypting"
  | "uploading"
  | "success"
  | "error";

export interface CreateLinkOptions {
  password?: string;
  /** Opt-in max retrievals before self-destruct. Undefined = unlimited. */
  usesLeft?: number;
  /** Opt-in: generate a creator deletion token and include it in the result. */
  includeDeletionToken?: boolean;
}

export interface ShortLinkResult {
  /** Full short URL with `#key` or `#key.salt` fragment, ready to share */
  shortUrl: string;
  /** Selected TTL in seconds (echoed for the result panel) */
  ttlSeconds: number;
  /** Computed expiry timestamp in ISO-8601 UTC */
  expiresAt: string;
  /** True if the link was created with a password. */
  passwordProtected: boolean;
  /** Remaining uses at creation time, if opt-in. */
  usesLeft?: number;
  /**
   * Delete URL with the 256-bit token in the fragment. Only set when the
   * creator opted in to `includeDeletionToken`. Never leaves the browser
   * unsolicited; the user must save this themselves.
   */
  deleteUrl?: string;
}

export interface UseCreateLinkResult {
  state: CreateState;
  result: ShortLinkResult | null;
  error: CryptoError | ApiError | null;
  mutate: (
    url: string,
    ttlSeconds: number,
    options?: CreateLinkOptions,
  ) => Promise<void>;
  reset: () => void;
}

/** Local-side encrypt result, neutral over v1/v2 + opt-in deletion token. */
export interface EncryptedPayload {
  blob: string;
  keyB64url: string;
  saltB64url: string | null;
  verifierB64url: string | null;
  deletionTokenB64url: string | null;
  deletionTokenHashB64url: string | null;
}

/**
 * Outcome of the local-encrypt step. Either succeeds with a payload or
 * surfaces a typed `CryptoError`. Non-CryptoError throwables are
 * re-thrown — they're programmer errors, not flow control.
 */
export type EncryptStepResult =
  | { ok: true; payload: EncryptedPayload }
  | { ok: false; error: CryptoError };

/**
 * Run the local encrypt step. Pure orchestration over the crypto module —
 * exported so the mutate state machine can compose it instead of
 * inlining a try/catch and so the unit suite can hit every branch
 * directly.
 */
export async function runEncryptStep(
  url: string,
  password: string | undefined,
  includeDeletionToken: boolean,
): Promise<EncryptStepResult> {
  try {
    const payload = await encryptForUpload(url, password, includeDeletionToken);
    return { ok: true, payload };
  } catch (e) {
    if (e instanceof CryptoError) return { ok: false, error: e };
    throw e;
  }
}

/**
 * Outcome of the network upload step. `aborted` is its own variant
 * because callers must distinguish "user navigated away" (silent return)
 * from "server said no" (surface the error).
 */
export type UploadStepResult =
  | { ok: true; id: string }
  | { ok: false; kind: "aborted" }
  | { ok: false; kind: "api-error"; error: ApiError };

export async function runUploadStep(
  payload: EncryptedPayload,
  ttlSeconds: number,
  usesLeft: number | undefined,
  signal: AbortSignal,
): Promise<UploadStepResult> {
  try {
    const id = await uploadEncrypted(payload, ttlSeconds, usesLeft, signal);
    return { ok: true, id };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, kind: "aborted" };
    }
    if (e instanceof ApiError) return { ok: false, kind: "api-error", error: e };
    throw e;
  }
}

export function useCreateLink(): UseCreateLinkResult {
  const [state, setState] = useState<CreateState>("idle");
  const [result, setResult] = useState<ShortLinkResult | null>(null);
  const [error, setError] = useState<CryptoError | ApiError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setResult(null);
    setError(null);
  }, []);

  const mutate = useCallback(
    async (url: string, ttlSeconds: number, options?: CreateLinkOptions) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setError(null);
      setResult(null);

      const password = options?.password;
      const usesLeft = options?.usesLeft;
      const includeDeletionToken = options?.includeDeletionToken === true;

      setState("encrypting");
      const enc = await runEncryptStep(url, password, includeDeletionToken);
      if (!enc.ok) {
        setError(enc.error);
        setState("error");
        return;
      }
      if (ac.signal.aborted) return;

      setState("uploading");
      const up = await runUploadStep(
        enc.payload,
        ttlSeconds,
        usesLeft,
        ac.signal,
      );
      if (!up.ok) {
        if (up.kind === "aborted") return;
        setError(up.error);
        setState("error");
        return;
      }

      setResult(buildShortLinkResult(enc.payload, up.id, ttlSeconds, usesLeft));
      setState("success");
    },
    [],
  );

  return { state, result, error, mutate, reset };
}

/**
 * Encrypt the URL (v1 or v2 depending on `password`) and optionally mint a
 * creator deletion token. Returns a neutral payload object.
 */
async function encryptForUpload(
  url: string,
  password: string | undefined,
  includeDeletionToken: boolean,
): Promise<EncryptedPayload> {
  let blob: string;
  let keyB64url: string;
  let saltB64url: string | null = null;
  let verifierB64url: string | null = null;

  if (password && password.length > 0) {
    const enc = await encryptUrlWithPassword(url, password);
    blob = enc.blob;
    keyB64url = enc.keyB64url;
    saltB64url = enc.saltB64url;
    verifierB64url = enc.verifierB64url;
  } else {
    const enc = await encryptUrl(url);
    blob = enc.blob;
    keyB64url = enc.keyB64url;
  }

  let deletionTokenB64url: string | null = null;
  let deletionTokenHashB64url: string | null = null;
  if (includeDeletionToken) {
    const tok = await generateDeletionToken();
    deletionTokenB64url = tok.tokenB64url;
    deletionTokenHashB64url = tok.hashB64url;
  }

  return {
    blob,
    keyB64url,
    saltB64url,
    verifierB64url,
    deletionTokenB64url,
    deletionTokenHashB64url,
  };
}

/**
 * POST the encrypted payload to /links and return the assigned id. Passes
 * the abort signal so cancellation propagates.
 */
async function uploadEncrypted(
  payload: EncryptedPayload,
  ttlSeconds: number,
  usesLeft: number | undefined,
  signal: AbortSignal,
): Promise<string> {
  const res = await createLink(
    {
      blob: payload.blob,
      ttl: ttlSeconds,
      ...(payload.verifierB64url ? { verifier: payload.verifierB64url } : {}),
      ...(usesLeft !== undefined ? { usesLeft } : {}),
      ...(payload.deletionTokenHashB64url
        ? { deletionTokenHash: payload.deletionTokenHashB64url }
        : {}),
    },
    signal,
  );
  return res.id;
}

/**
 * Pure assembly of the user-facing result object. The short URL embeds the
 * v1 or v2 fragment via assembleFragment; the delete URL carries the raw
 * creator token in its own fragment so the server never sees it.
 */
function buildShortLinkResult(
  payload: EncryptedPayload,
  id: string,
  ttlSeconds: number,
  usesLeft: number | undefined,
): ShortLinkResult {
  const fragment = assembleFragment(payload.keyB64url, payload.saltB64url);
  const shortUrl = `${window.location.origin}/${id}#${fragment}`;
  const deleteUrl =
    payload.deletionTokenB64url !== null
      ? `${window.location.origin}/delete/${id}#${payload.deletionTokenB64url}`
      : null;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  return {
    shortUrl,
    ttlSeconds,
    expiresAt,
    passwordProtected: payload.saltB64url !== null,
    ...(usesLeft !== undefined ? { usesLeft } : {}),
    ...(deleteUrl !== null ? { deleteUrl } : {}),
  };
}
