/**
 * Local UI state for an inline password input: a show/hide toggle and a
 * transient "copied" flag that auto-clears after ~1.5 s. Copy also hides
 * the password (shoulder-surf safety — same posture as notefade) and is
 * a no-op while the copied feedback is still showing.
 *
 * Used by both the create-form's `PasswordField` and the unlock screen's
 * `PasswordUnlockField`; the two had identical hand-rolled copies of
 * this state machine before extraction.
 */

import { useState } from "react";
import { copyToClipboard } from "@/hooks/use-shorten-form";

const COPY_FEEDBACK_MS = 1500;

export interface PasswordCopyControls {
  readonly showPassword: boolean;
  readonly copied: boolean;
  toggleShow(): void;
  reveal(): void;
  /** Copy `value` to clipboard. No-op while feedback is showing or value is empty. */
  onCopy(value: string): Promise<void>;
}

export function usePasswordCopy(): PasswordCopyControls {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = async (value: string): Promise<void> => {
    if (copied || value.length === 0) return;
    if (await copyToClipboard(value)) {
      setShowPassword(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
  };

  return {
    showPassword,
    copied,
    toggleShow: () => setShowPassword((v) => !v),
    reveal: () => setShowPassword(true),
    onCopy,
  };
}
