import { useState } from "react";

/**
 * Multi-use counter (opt-in self-destruct after N retrievals) for the
 * create form. `undefined` means unlimited (until expiry).
 */
export interface UseMultiUseResult {
  readonly usesLeft: number | undefined;
  readonly setUsesLeft: (next: number | undefined) => void;
  readonly reset: () => void;
}

export function useMultiUse(): UseMultiUseResult {
  const [usesLeft, setUsesLeft] = useState<number | undefined>(undefined);
  const reset = (): void => setUsesLeft(undefined);
  return { usesLeft, setUsesLeft, reset };
}
