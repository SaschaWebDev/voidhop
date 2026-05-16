import { useState } from "react";

/**
 * Password-protection state for the create form. Owns the toggle, the
 * password value, and the validation-error message.
 *
 * Toggling protect OFF clears the password and any error — a stale value
 * shouldn't survive a checkbox toggle and slip into a future submission.
 */
export interface UsePasswordProtectionResult {
  readonly protect: boolean;
  readonly setProtect: (next: boolean) => void;
  readonly password: string;
  readonly setPassword: (next: string) => void;
  readonly passwordError: string | null;
  readonly setPasswordError: (msg: string | null) => void;
  readonly reset: () => void;
}

export function usePasswordProtection(): UsePasswordProtectionResult {
  const [protect, setProtectState] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const setProtect = (next: boolean): void => {
    setProtectState(next);
    if (!next) {
      setPassword("");
      setPasswordError(null);
    }
  };

  const reset = (): void => {
    setProtectState(false);
    setPassword("");
    setPasswordError(null);
  };

  return {
    protect,
    setProtect,
    password,
    setPassword,
    passwordError,
    setPasswordError,
    reset,
  };
}
