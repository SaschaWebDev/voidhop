/**
 * useCreateLink — Create flow state machine. SRS §12.4.
 *
 * Granular state values reinforce that encryption happens locally before
 * the network call.
 */

import { useCallback, useRef, useState } from "react";
import { encryptUrl, CryptoError } from "@/crypto";
import { createLink } from "@/api/client";
import { ApiError } from "@/api/types";

export type CreateState =
  | "idle"
  | "encrypting"
  | "uploading"
  | "success"
  | "error";

export interface ShortLinkResult {
  /** Full short URL with `#key` fragment, ready to share */
  shortUrl: string;
  /** Selected TTL in seconds (echoed for the result panel) */
  ttlSeconds: number;
  /** Computed expiry timestamp in ISO-8601 UTC */
  expiresAt: string;
}

export interface UseCreateLinkResult {
  state: CreateState;
  result: ShortLinkResult | null;
  error: CryptoError | ApiError | null;
  mutate: (url: string, ttlSeconds: number) => Promise<void>;
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

  const mutate = useCallback(async (url: string, ttlSeconds: number) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setError(null);
    setResult(null);

    setState("encrypting");
    let blob: string;
    let keyB64url: string;
    try {
      const enc = await encryptUrl(url);
      blob = enc.blob;
      keyB64url = enc.keyB64url;
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
      const res = await createLink({ blob, ttl: ttlSeconds }, ac.signal);
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

    const shortUrl = `${window.location.origin}/${id}#${keyB64url}`;
    const expiresAt = new Date(
      Date.now() + ttlSeconds * 1000,
    ).toISOString();

    setResult({ shortUrl, ttlSeconds, expiresAt });
    setState("success");
  }, []);

  return { state, result, error, mutate, reset };
}
