import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

/**
 * Resolve the git commit SHA of the current build. Falls back to "dev" when
 * run outside a git work tree or when `git` is unavailable (e.g. on a
 * stripped-down CI image). This is consumed by the footer so visitors can
 * verify the running code matches a specific public commit.
 */
function resolveBuildSha(): string {
  try {
    const sha = execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return /^[a-f0-9]{40}$/.test(sha) ? sha : "dev";
  } catch {
    return "dev";
  }
}

const BUILD_SHA = resolveBuildSha();
const BUILD_SHA_SHORT = BUILD_SHA === "dev" ? "dev" : BUILD_SHA.slice(0, 7);

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
    __BUILD_SHA_SHORT__: JSON.stringify(BUILD_SHA_SHORT),
  },
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
});
