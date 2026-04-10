# Architecture

VoidHop is a two-component system:

1. **Frontend** — a static React SPA (Vite + TanStack Router + Web Crypto). Does all encryption and decryption locally.
2. **Worker** — a Cloudflare Worker (Hono) backed by Cloudflare KV. Stores opaque ciphertext blobs, enforces rate limits and the daily write budget. **Never** sees plaintext URLs or AES keys.

For the full normative spec, see [`voidhop-SRS-v2.md`](./voidhop-SRS-v2.md).

## Request flow

### Create
```
Browser                                       Worker             KV
   │                                            │                 │
   ├─ encryptUrl(url)                           │                 │
   │     • generate 32-byte AES-256 key         │                 │
   │     • generate 12-byte IV                  │                 │
   │     • length-prefix pad to bucket          │                 │
   │     • AES-GCM encrypt                      │                 │
   │     • blob = base64url(IV + ciphertext)    │                 │
   │                                            │                 │
   ├──── POST /api/v1/links { blob, ttl } ─────►│                 │
   │                                            ├─ blob fast pre-check
   │                                            ├─ Zod (ttl)
   │                                            ├─ TTL ceiling
   │                                            ├─ daily budget   │
   │                                            ├─ generateAndReserveId
   │                                            │                 │
   │                                            ├──── exists ────►│
   │                                            │◄──── false ─────┤
   │                                            ├──── put ───────►│
   │                                            │                 │
   │◄────────────── 201 { id } ─────────────────┤                 │
   │                                            │                 │
short URL = origin/<id>#<keyB64url>
```

### Redirect
```
Browser                                       Worker             KV
   │                                            │                 │
   ├─ read window.location.hash → keyB64url     │                 │
   ├─ enforce length === 43                     │                 │
   ├─ history.replaceState (scrub hash)         │                 │
   │                                            │                 │
   ├──── GET /api/v1/links/<id> ───────────────►│                 │
   │                                            ├─ rate limit     │
   │                                            ├──── get ───────►│
   │                                            │◄──── blob ──────┤
   │◄──────────── 200 { blob } ─────────────────┤                 │
   │                                            │                 │
   ├─ decryptBlob(blob, keyB64url)              │                 │
   │     • importKey (extractable: false)       │                 │
   │     • scrub raw key Uint8Array             │                 │
   │     • AES-GCM decrypt                      │                 │
   │     • length-prefix unpad                  │                 │
   │                                            │                 │
   ├─ validateRedirectTarget → URL object       │                 │
   │                                            │                 │
   └─ window.location.replace(validated.href)
```

The 404 path on GET retries exactly once after 1.5 seconds (KV replication lag absorption — SRS item 5).

## Why each layer exists

| Layer | Purpose | What lives here |
|---|---|---|
| `src/crypto/` | Pure TS, framework-agnostic. Browser-only (uses Web Crypto). | Encryption, decryption, padding, base64url, key scrub. |
| `src/api/` | Wraps `fetch` with typed errors and the single 404 retry. | `createLink`, `getBlob`, `deleteLink`, `checkExists`. |
| `src/hooks/` | React state machines, one per flow. | `useCreateLink`, `useRedirect`. |
| `src/components/` | Stateless presentational components. | TTL selector, copy button, QR result, redirect splash, theme toggle. |
| `src/routes/` | TanStack Router route components — thin wrappers around hooks. | `index.tsx` (Create), `$id.tsx` (Redirect), `about.tsx`, `not-found.tsx`. |
| `src/utils/` | Pure helpers. | URL validation (returns parsed `URL` objects), in-app browser UA detection. |
| `worker/middleware/` | Hono middleware. Security headers wrap everything as the outermost layer. | Security headers, CORS, rate limit (IPv6 /64 aware), daily budget (global + per-origin). |
| `worker/store/` | `LinkStore` interface + Cloudflare KV implementation. | No-overwrite contract enforced at the application layer. |
| `worker/routes/` | Hono routers. | `/api/v1/links` and `/api/v1/health`. |

## Why no Zustand / Redux / etc.

The frontend has two routes and zero shared state between them. Both flows are linear state machines that fit comfortably into a single `useState` per route. Adding a global store would be ceremony for ceremony's sake.

## Why Hono

Hono adds typed routing, composable middleware, and built-in JSON helpers in ~14 KB compressed. Raw `fetch` handlers with manual URL matching are error-prone and harder to audit, especially around middleware ordering — and middleware ordering is critical for VoidHop because the security-headers middleware must wrap *every* response, including the ones from `notFound` and `onError` handlers. Hono guarantees this when middleware is registered before those handlers.

## Where the privacy guarantee lives

The privacy guarantee is enforced by the placement of the AES key in the URL fragment, which the browser refuses to send to any server by hard-coded HTTP semantics. Everything else is defense-in-depth:

- `extractable: false` on the imported `CryptoKey` — defense against accidental key logging by page JS.
- In-place scrub of the raw key `Uint8Array` after `importKey` — defense against XSS that scrapes the import window.
- `history.replaceState` to clear the hash from the address bar — defense against browser quirks that inherit fragments into navigations.
- Strict 43-character hash length check — defense against adversarial fragments designed to lock up the tab.
- `Cache-Control: no-store, no-cache` on every response — defense against any intermediate cache holding on to a transient 404.

None of these are the privacy guarantee itself. The privacy guarantee is one line of HTTP spec.
