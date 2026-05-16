import { useState } from "react";
import { useCreateLink } from "@/hooks/use-create-link";
import { useUrlInput } from "@/hooks/use-url-input";
import { usePasswordProtection } from "@/hooks/use-password-protection";
import { useMultiUse } from "@/hooks/use-multi-use";
import { validateInputUrl } from "@/utils/url-validation";
import { DEFAULT_TTL_SECONDS } from "@/constants";
import {
  humanizeCreateError,
  humanizeInputError,
} from "@/utils/humanize-errors";

/**
 * Composition wrapper that wires the four create-form concerns together
 * (URL input, password protection, multi-use counter, server mutation)
 * into a single object suitable for the home page. The public surface is
 * stable — callers don't need to know the underlying split.
 *
 * Every shortened link comes back with a revocation URL — the deletion
 * token is no longer opt-in. The server still only ever stores the
 * SHA-256 hash of the token (the token itself lives only in the URL
 * fragment we hand back to the creator), so the privacy posture is
 * unchanged.
 */
export function useShortenForm() {
  const create = useCreateLink();
  const urlInput = useUrlInput(() => {
    // Clear a prior result/error as soon as the user edits the URL — the
    // panel below should reflect the new input, not the previous run.
    if (create.state === "success" || create.state === "error") {
      create.reset();
    }
  });
  const pwd = usePasswordProtection();
  const multiUse = useMultiUse();
  const [ttl, setTtl] = useState<number>(DEFAULT_TTL_SECONDS);

  const isBusy = create.state === "encrypting" || create.state === "uploading";

  const submit = async (): Promise<boolean> => {
    urlInput.setInputError(null);
    pwd.setPasswordError(null);
    const validation = validateInputUrl(urlInput.url);
    if (!validation.ok) {
      urlInput.setInputError(humanizeInputError(validation.error.type));
      return false;
    }
    if (pwd.protect && pwd.password.length === 0) {
      pwd.setPasswordError("Please enter a password.");
      return false;
    }
    await create.mutate(validation.value, ttl, {
      ...(pwd.protect ? { password: pwd.password } : {}),
      ...(multiUse.usesLeft !== undefined
        ? { usesLeft: multiUse.usesLeft }
        : {}),
      includeDeletionToken: true,
    });
    return true;
  };

  const reset = (): void => {
    urlInput.reset();
    pwd.reset();
    multiUse.reset();
    create.reset();
  };

  const errorMessage =
    create.state === "error" && create.error
      ? humanizeCreateError(create.error)
      : null;

  return {
    url: urlInput.url,
    onUrlChange: urlInput.onUrlChange,
    ttl,
    setTtl,
    inputError: urlInput.inputError,
    protect: pwd.protect,
    setProtect: pwd.setProtect,
    password: pwd.password,
    setPassword: pwd.setPassword,
    passwordError: pwd.passwordError,
    usesLeft: multiUse.usesLeft,
    setUsesLeft: multiUse.setUsesLeft,
    isBusy,
    state: create.state,
    result: create.result,
    errorMessage,
    submit,
    reset,
  };
}

export function copyToClipboard(text: string): Promise<boolean> {
  // `navigator.clipboard.writeText` is available in every browser we
  // target. The deprecated `document.execCommand("copy")` fallback used to
  // live here but was removed — modern browsers no longer require it and
  // the fallback was unreliable in practice. If the API is unavailable
  // (e.g. insecure context), surface `false` so callers can degrade.
  if (!navigator.clipboard?.writeText) {
    return Promise.resolve(false);
  }
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

export function formatExpiry(expiresAt: string): string {
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return expiresAt;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

