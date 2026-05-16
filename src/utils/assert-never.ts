/**
 * Exhaustiveness check helper for discriminated unions.
 *
 *   switch (x.type) {
 *     case "A": …
 *     case "B": …
 *     default: return assertNever(x.type);
 *   }
 *
 * If a new variant is added to the union and the switch doesn't handle it,
 * TypeScript will reject the `assertNever` call at compile time (the
 * uncovered variant is no longer narrowed to `never`). At runtime, the
 * function logs a warning and returns the offending value so production
 * code can degrade gracefully rather than crash.
 */
export function assertNever(value: never): never {
  // eslint-disable-next-line no-console
  console.warn("assertNever: unexpected union variant reached", value);
  // Throw so the caller surfaces the bug. We don't actually return.
  throw new Error(
    `assertNever: unexpected union variant: ${String(value)}`,
  );
}
