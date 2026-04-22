# VoidHop

**Zero-knowledge URL shortener.** The destination URL is encrypted in your browser before it leaves; the server stores only opaque ciphertext. The decryption key lives in the URL fragment, which the browser never transmits to any server.

```
https://voidhop.com/aBcD1234#dW5BUlhwbXFBLW8xUlBxNHpyN1AwYUw3WkpqTjBabXM
                   ^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                   link ID   AES-256 key — never sent to the server
```

Optional: a per-link password adds a second factor. The salt joins the fragment after a `.`; the server holds only an opaque verifier:

```
https://voidhop.com/aBcD1234#<key>.<salt>
                                    ^^^^^^ salt, also stays in the browser
```

If our server is compromised, subpoenaed, or curious, the only thing it can produce is a pile of opaque ciphertexts.

## Features

### Core (v1.0)

- AES-256-GCM client-side encryption (browser-native Web Crypto, no npm crypto deps)
- Length-prefix padding to 5 size buckets — observers see at most one of 5 discrete sizes, never the exact length
- 3 TTL options (1h / 24h / 7d) — 7 days is the universal maximum, bounding storage to a self-healing 7-day rolling window
- Per-IP rate limiting with IPv6 /64 subnet bucketing
- Per-origin daily write sub-quotas (CORS allowlist + containment of allowed-origin compromise)
- No analytics, no tracking, no click counters, no referrer logging
- Light/dark theme
- Built for the Cloudflare free tier — 100 % zero hosting cost at expected volumes

### Optional opt-in controls (v1.2)

- **Password protection.** PBKDF2-SHA256 (600 000 iterations) + HKDF-SHA256 derive an encryption key from `fragment_key ‖ password`. Salt stays in the URL fragment; server stores only a verifier. Five wrong attempts destroy the record. Each wrong attempt triggers an exponential backoff (1 s → 5 s → 30 s → 120 s) enforced server-side so even the correct password is rejected during the cool-down window.
- **Multi-use counter.** Opt in to "expires after N reads" (1, 3, or 10). `N = 1` is classic burn-after-reading. The server decrements atomically and deletes on zero.
- **Creator deletion token.** Opt in to receive a second URL (`/delete/<id>#<token>`) that lets you destroy the link on demand before its TTL expires. The server stores only `SHA-256(token)`; the raw token never leaves the browser that created it.

### Trust & transparency

- **Commit SHA footer.** Every page shows the git commit hash of the running build, linking to the exact public source commit. You can verify the code your browser is running matches the audited repository.
- **Strict CSP + HSTS** via `public/_headers` (Cloudflare Pages) and mirrored in the Worker's security-headers middleware. `script-src 'self'` and `connect-src 'self'` prevent exfiltration channels even in the presence of an XSS bug.
- **Post-build integrity audit.** `scripts/check-no-external-deps.mjs` fails the build if `dist/index.html` references any cross-origin resource without an SRI `integrity=` attribute. Keeps the dependency graph honest even under future refactors.

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

Local build + lint + typecheck:

```bash
npm run build        # tsc -b, vite build, integrity audit — outputs ./dist
npm run typecheck
npm run lint
```

### Production deployment (Cloudflare)

Topology: **Cloudflare Pages** serves the static SPA from `dist/`; **Cloudflare Worker** serves the `/api/*` routes. Same-origin, no CORS.

1. Create the KV namespace in the dashboard: **Storage & Databases → KV → Create a namespace**. Paste the ID into `wrangler.toml` (replacing `REPLACE_WITH_PRODUCTION_NAMESPACE_ID`).
2. Connect **Workers & Pages → Create → Workers → Import a repository** to this repo. Build command: `npm install`. Deploy command: `npx wrangler deploy`. The `[[routes]]` block in `wrangler.toml` binds the Worker to `voidhop.com/api/*` automatically on first deploy.
3. Connect **Workers & Pages → Create → Pages → Connect to Git** to the same repo. Framework preset: `None`. Build command: `npm install && npm run build`. Build output directory: `dist`.
4. In the Pages project: **Custom domains → Set up a custom domain** → your domain. CF wires the DNS automatically if the zone is already on your account.

After first deploy, commits to `main` auto-build both the Worker and the Pages site. Rollback from each project's **Deployments** list.

See [`docs/SELF-HOSTING.md`](./docs/SELF-HOSTING.md) for the long version including offline/local builds.

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
