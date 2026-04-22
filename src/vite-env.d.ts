/// <reference types="vite/client" />

/**
 * Injected at build time by `vite.config.ts` via the `define` option. Value
 * is the output of `git rev-parse HEAD` on the build host, or the literal
 * string `"dev"` when running the dev server or when git is unavailable.
 */
declare const __BUILD_SHA__: string;

/** First 7 characters of `__BUILD_SHA__` for display. `"dev"` in development. */
declare const __BUILD_SHA_SHORT__: string;
