#!/usr/bin/env node
// scripts/dev.mjs — Coordinated dev runner for VoidHop.
//
// Picks free ports for the Vite frontend (starting at 5173) and the Wrangler
// worker (starting at 8787), launches them in parallel with prefixed output,
// and shuts both down cleanly on Ctrl+C.
//
// The selected worker port is passed to Vite via the WORKER_DEV_PORT env var,
// which vite.config.ts reads to configure its `/api` proxy target. This
// means you can run several VoidHop checkouts in parallel without port
// collisions.

import { createServer } from "node:net";
import { spawn } from "node:child_process";

const VITE_DEFAULT_PORT = 5173;
const WORKER_DEFAULT_PORT = 8787;
const PORT_SCAN_LIMIT = 100;

const COLORS = {
  vite: "\x1b[36m", // cyan
  worker: "\x1b[35m", // magenta
  reset: "\x1b[0m",
  dim: "\x1b[2m",
};

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(start) {
  for (let p = start; p < start + PORT_SCAN_LIMIT; p++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p)) return p;
  }
  throw new Error(
    `No free port found in range ${start}-${start + PORT_SCAN_LIMIT - 1}`,
  );
}

function pipePrefixed(stream, label, color) {
  const prefix = `${color}[${label}]${COLORS.reset}`;
  let buf = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      process.stdout.write(`${prefix} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buf.length > 0) process.stdout.write(`${prefix} ${buf}\n`);
  });
}

const vitePort = await findFreePort(VITE_DEFAULT_PORT);
const workerPort = await findFreePort(WORKER_DEFAULT_PORT);

console.log(`${COLORS.dim}[dev] auto-selected free ports${COLORS.reset}`);
console.log(
  `${COLORS.vite}[vite]${COLORS.reset}   http://localhost:${vitePort}`,
);
console.log(
  `${COLORS.worker}[worker]${COLORS.reset} http://127.0.0.1:${workerPort}`,
);
console.log("");

const childEnv = {
  ...process.env,
  WORKER_DEV_PORT: String(workerPort),
};

// shell: true so that "npx", "vite.cmd", "wrangler.cmd" resolve correctly on
// Windows via cmd.exe. The child processes still receive their stdio as
// pipes so we can prefix their output.
const vite = spawn(
  "npx",
  ["vite", "--port", String(vitePort), "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"], shell: true, env: childEnv },
);

const worker = spawn(
  "npx",
  ["wrangler", "dev", "--port", String(workerPort)],
  { stdio: ["ignore", "pipe", "pipe"], shell: true, env: childEnv },
);

pipePrefixed(vite.stdout, "vite", COLORS.vite);
pipePrefixed(vite.stderr, "vite", COLORS.vite);
pipePrefixed(worker.stdout, "worker", COLORS.worker);
pipePrefixed(worker.stderr, "worker", COLORS.worker);

let shuttingDown = false;
function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    vite.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  try {
    worker.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  // Give children a moment to exit gracefully, then force-exit.
  setTimeout(() => process.exit(exitCode), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

vite.on("exit", (code) => {
  console.log(
    `${COLORS.vite}[vite]${COLORS.reset} exited with code ${code ?? "?"}`,
  );
  shutdown(code ?? 0);
});
worker.on("exit", (code) => {
  console.log(
    `${COLORS.worker}[worker]${COLORS.reset} exited with code ${code ?? "?"}`,
  );
  shutdown(code ?? 0);
});
