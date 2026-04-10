# VoidHop

**Zero-knowledge URL shortener.** The destination URL is encrypted in your browser before it leaves; the server stores only opaque ciphertext. The decryption key lives in the URL fragment, which the browser never transmits to any server.

```
https://voidhop.com/aBcD1234#dW5BUlhwbXFBLW8xUlBxNHpyN1AwYUw3WkpqTjBabXM
                  ^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                  link ID    AES-256 key — never sent to the server
```

If our server is compromised, subpoenaed, or curious, the only thing it can produce is a pile of opaque ciphertexts.

## Features

- AES-256-GCM client-side encryption (browser-native Web Crypto, no npm crypto deps)
- Length-prefix padding to 5 size buckets — observers see at most one of 5 discrete sizes, never the exact length
- 3 TTL options (1h / 24h / 7d) — 7 days is the universal maximum, bounding storage to a self-healing 7-day rolling window
- Per-IP rate limiting with IPv6 /64 subnet bucketing
- Per-origin daily write sub-quotas (CORS allowlist + containment of allowed-origin compromise)
- No analytics, no tracking, no click counters, no referrer logging
- Light/dark theme
- Built for the Cloudflare free tier — 100 % zero hosting cost at expected volumes

The full spec, threat model, and design rationale live in [`docs/voidhop-SRS-v2.md`](./docs/voidhop-SRS-v2.md).

## Quick start

```bash
npm install
npm run dev   # starts both the Vite frontend and the Wrangler worker
```

`npm run dev` is a small Node script (`scripts/dev.mjs`) that:

- Picks the first free port at or after **5173** for Vite
- Picks the first free port at or after **8787** for the Wrangler worker
- Launches both processes in parallel with prefixed, colored output (`vite` in cyan, `worker` in magenta)
- Tells Vite about the worker's chosen port via the `WORKER_DEV_PORT` env var so the `/api/*` proxy points to the right place
- Cleans both up on `Ctrl+C`

This means you can run several VoidHop checkouts in parallel — or run VoidHop alongside other Workers projects — without any port collisions or manual coordination.

If you ever need to run the two processes in separate terminals (for log filtering, independent restarts, etc.), use the split scripts:

```bash
npm run dev:vite     # Vite only — proxies /api to WORKER_DEV_PORT (default 8787)
npm run dev:worker   # Wrangler worker only — picks its own port via --port
```

Note that the split scripts do **not** auto-coordinate ports; you have to set `WORKER_DEV_PORT` yourself if you give the worker a non-default port.

## Build & deploy

```bash
npm run build     # builds the SPA into ./dist
npm run deploy    # deploys the worker via Wrangler
```

Before the first deploy:

1. Edit `wrangler.toml` and replace `REPLACE_WITH_PRODUCTION_NAMESPACE_ID` and `REPLACE_WITH_PREVIEW_NAMESPACE_ID` with real KV namespace IDs. Create them with:
   ```bash
   wrangler kv:namespace create VOIDHOP_KV
   wrangler kv:namespace create VOIDHOP_KV --preview
   ```
2. Configure a Cloudflare Basic Rate Limiting rule on `/api/v1/links` (POST, max 60 req/min globally) — see SRS §6.2 for the rationale.
3. Set up the production hostname in your Cloudflare account and point DNS at the Worker / Pages deployment.

See [`docs/SELF-HOSTING.md`](./docs/SELF-HOSTING.md) for the long version.

## Testing

```bash
npm test          # unit + integration (Vitest + Miniflare)
npm run test:e2e  # end-to-end (Playwright)
```

Security-critical paths covered by tests:

- AES-256-GCM round-trip across all bucket sizes
- Length-prefix padding boundary cases (incl. the v1.0 `0x01` delimiter footgun)
- IPv6 /64 subnet collapse for rate limiting
- TTL ceiling enforcement on POST
- 400 → 404 collapse on GET/HEAD/DELETE for invalid ID format
- `Cache-Control: no-store, no-cache` on every status code (incl. error responses)

## Privacy guarantees

- The server **never** sees the destination URL.
- The server **never** sees the AES key.
- VoidHop logs no clicks, no IPs (beyond Cloudflare's own transient logging), no referrers.
- The about page (`/about`) explains the architecture and the honest limitations in plain language.

For the full threat model and the things VoidHop deliberately does **not** defend against, see SRS §3.

## License

MIT — see [`LICENSE`](./LICENSE).
