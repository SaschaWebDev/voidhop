import { useState } from "react";
import { useCreateLink } from "@/hooks/use-create-link";
import { validateInputUrl } from "@/utils/url-validation";
import { DEFAULT_TTL_SECONDS } from "@/constants";
import {
  humanizeCreateError,
  humanizeInputError,
} from "@/utils/humanize-errors";

/**
 * Shared URL-shortener form state + submit handler. The ten design variants
 * at /1-/10 all consume this so their submit logic is identical to the
 * canonical CreatePage; only the rendering differs.
 */
export function useShortenForm() {
  const [url, setUrl] = useState("");
  const [ttl, setTtl] = useState<number>(DEFAULT_TTL_SECONDS);
  const [inputError, setInputError] = useState<string | null>(null);
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [usesLeft, setUsesLeft] = useState<number | undefined>(undefined);
  const [includeDeletionToken, setIncludeDeletionToken] = useState(false);
  const create = useCreateLink();

  const isBusy = create.state === "encrypting" || create.state === "uploading";

  const submit = async () => {
    setInputError(null);
    setPasswordError(null);
    const validation = validateInputUrl(url);
    if (!validation.ok) {
      setInputError(humanizeInputError(validation.error.type));
      return false;
    }
    if (protect) {
      if (password.length === 0) {
        setPasswordError("Please enter a password.");
        return false;
      }
      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return false;
      }
    }
    await create.mutate(validation.value, ttl, {
      ...(protect ? { password } : {}),
      ...(usesLeft !== undefined ? { usesLeft } : {}),
      ...(includeDeletionToken ? { includeDeletionToken: true } : {}),
    });
    return true;
  };

  const reset = () => {
    setUrl("");
    setProtect(false);
    setPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setUsesLeft(undefined);
    setIncludeDeletionToken(false);
    create.reset();
  };

  const onUrlChange = (next: string) => {
    setUrl(next);
    setInputError(null);
    if (create.state === "success" || create.state === "error") {
      create.reset();
    }
  };

  const errorMessage =
    create.state === "error" && create.error
      ? humanizeCreateError(create.error)
      : null;

  return {
    url,
    onUrlChange,
    ttl,
    setTtl,
    inputError,
    protect,
    setProtect,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    passwordError,
    usesLeft,
    setUsesLeft,
    includeDeletionToken,
    setIncludeDeletionToken,
    isBusy,
    state: create.state,
    result: create.result,
    errorMessage,
    submit,
    reset,
  };
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

export function formatExpiry(expiresAt: string): string {
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return expiresAt;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

