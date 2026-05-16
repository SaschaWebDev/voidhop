import { useState } from "react";

/**
 * URL-input state for the create form. Owns the raw text and the
 * validation-error message displayed beneath it.
 *
 * The `onUrlChange` callback clears any inputError on every keystroke and
 * fires the optional `onChange` callback so the parent can react to the
 * edit (e.g. clear a stale `useCreateLink` result).
 *
 * `reset()` zeroes both the value and any pending error.
 */
export interface UseUrlInputResult {
  readonly url: string;
  readonly onUrlChange: (next: string) => void;
  readonly inputError: string | null;
  readonly setInputError: (msg: string | null) => void;
  readonly reset: () => void;
}

export function useUrlInput(onChange?: () => void): UseUrlInputResult {
  const [url, setUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const onUrlChange = (next: string): void => {
    setUrl(next);
    setInputError(null);
    onChange?.();
  };

  const reset = (): void => {
    setUrl("");
    setInputError(null);
  };

  return { url, onUrlChange, inputError, setInputError, reset };
}
