/**
 * Vitest config — kept separate from `vite.config.ts` so the latter stays on
 * vite's `defineConfig` (which doesn't know about the `test` field) without
 * type gymnastics. Vitest picks this file up automatically when present.
 */

import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "happy-dom",
      include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    },
  }),
);
