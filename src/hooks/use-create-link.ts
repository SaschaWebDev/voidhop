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
import { createLink } from "@/api/client";
import { ApiError } from "@/api/types";
import { FRAGMENT_SALT_SEPARATOR } from "@/constants";

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
    async (
      url: string,
      ttlSeconds: number,
      options?: CreateLinkOptions,
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setError(null);
      setResult(null);

      const password = options?.password;
      const usesLeft = options?.usesLeft;
      const includeDeletionToken = options?.includeDeletionToken === true;

      setState("encrypting");
      let blob: string;
      let keyB64url: string;
      let saltB64url: string | null = null;
      let verifierB64url: string | null = null;
      let deletionTokenB64url: string | null = null;
      let deletionTokenHashB64url: string | null = null;
      try {
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
        if (includeDeletionToken) {
          const tok = await generateDeletionToken();
          deletionTokenB64url = tok.tokenB64url;
          deletionTokenHashB64url = tok.hashB64url;
        }
      } catch (e) {
        if (e instanceof CryptoError) {
          setError(e);
          setState("error");
          return;
        }
        throw e;
      }

      if (ac.signal.aborted) return;

      setState("uploading");
      let id: string;
      try {
        const res = await createLink(
          {
            blob,
            ttl: ttlSeconds,
            ...(verifierB64url ? { verifier: verifierB64url } : {}),
            ...(usesLeft !== undefined ? { usesLeft } : {}),
            ...(deletionTokenHashB64url
              ? { deletionTokenHash: deletionTokenHashB64url }
              : {}),
          },
          ac.signal,
        );
        id = res.id;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e instanceof ApiError) {
          setError(e);
          setState("error");
          return;
        }
        throw e;
      }

      const fragment =
        saltB64url !== null
          ? `${keyB64url}${FRAGMENT_SALT_SEPARATOR}${saltB64url}`
          : keyB64url;
      const shortUrl = `${window.location.origin}/${id}#${fragment}`;
      const deleteUrl =
        deletionTokenB64url !== null
          ? `${window.location.origin}/delete/${id}#${deletionTokenB64url}`
          : null;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

      setResult({
        shortUrl,
        ttlSeconds,
        expiresAt,
        passwordProtected: saltB64url !== null,
        ...(usesLeft !== undefined ? { usesLeft } : {}),
        ...(deleteUrl !== null ? { deleteUrl } : {}),
      });
      setState("success");
    },
    [],
  );

  return { state, result, error, mutate, reset };
}
