import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the bundle small and easy to audit; no manual chunking needed
        // for a two-route SPA.
      },
    },
  },
  server: {
    // The actual port is chosen by scripts/dev.mjs and passed via the CLI
    // (`vite --port <n> --strictPort`). The value here is just the fallback
    // for `vite dev` runs that bypass the dev script.
    port: 5173,
    proxy: {
      "/api": {
        // scripts/dev.mjs sets WORKER_DEV_PORT after picking a free port for
        // the wrangler worker. Falls back to 8787 for direct `vite dev` runs.
        target: `http://127.0.0.1:${process.env.WORKER_DEV_PORT ?? "8787"}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
});
