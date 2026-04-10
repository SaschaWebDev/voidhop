# VoidHop — Software Requirements Specification

**Version:** 1.1.1
**Domain:** voidhop.com
**Date:** 2026-04-09
**Status:** Ready for implementation handover (security-hardened revision of v1.0.0)
**Supersedes:** `docs/voidhop-srs.md` (v1.0.0)

This is a self-contained, implementation-ready specification. It folds the 20 feedback items from `docs/feedback-v1.md` into the v1.0.0 content. Implementation should be driven from this document alone; v1.0.0 is retained for historical reference only.

## Changes from v1.1.0

- **Maximum TTL is now 7 days for any link.** The 30-day and 1-year options are removed. The size-based TTL ceiling table (formerly §6.2 / §9.2) is removed because it is subsumed by the universal 7-day cap. The `TTL_EXCEEDS_SIZE_LIMIT` error code, the `TTL_CEILINGS_BY_SIZE` constant, and the `maxTtlForBlobSize()` helper are all gone.
- TTL options are now: **1 hour**, **24 hours**, **7 days** (default).
- §6.2 storage capacity narrative is rewritten honestly: at sustained max-blob abuse the 1 GB cap can still be approached, but realistic average blob sizes keep usage well under it; KV's own write-rejection on storage exhaustion is the ultimate enforcement.

---

## Changelog from v1.0.0

The following sections were materially updated based on `docs/feedback-v1.md`. The bracketed item numbers refer to that feedback document.

- **§3.2 Honest Limitations** — added: no destination-host blocklist (item 7), browser extensions read fragments (item 10), cross-tenant abuse via allowed origins (item 20).
- **§3.3 Abuse Threat Model** — added: best-effort budget enforcement bullet (item 1).
- **§4.4 Plaintext Padding** — rewritten to use a length-prefix scheme (item 6; literal PKCS#7 was the original suggestion but cannot encode padding lengths > 255 bytes; the length-prefix scheme preserves the same anti-collision and oracle-free properties).
- **§4.4a Tiered Padding Buckets** — new subsection (item 11).
- **§4.7 Key Importation** — added in-place key scrub (item 15).
- **§6.2 Cloudflare KV Free Tier** — hard cap delegated to network-edge rate limiting (item 1). Storage exhaustion (item 2) is now mitigated entirely by the universal 7-day TTL cap (see "Changes from v1.1.0" above).
- **FR-REDIRECT-02** — adds `replaceState` hash clear (item 9), 43-char hash check (item 12), in-app browser branch (item 16).
- **FR-REDIRECT-06** — navigates via `validated.href` only (item 14).
- **FR-REDIRECT-08** — fallback link uses constant text + validated href (item 8).
- **§9.2 POST `/api/v1/links`** — pre-Zod fast path for blob (item 4). The `TTL_EXCEEDS_SIZE_LIMIT` error from v1.1.0 is removed in v1.1.1 because the universal 7-day cap replaces the size-based ceiling.
- **§9.2 GET / HEAD / DELETE `/api/v1/links/:id`** — collapse 400 → 404 (item 17).
- **§9.3 CORS Policy** — per-origin daily write sub-quotas (item 20).
- **§9.4 Security Headers** — applied to all responses including errors (item 18).
- **§11.1 Request Lifecycle** — middleware ordering update (item 18); fast pre-check before Zod (item 4).
- **§11.2 Rate Limiting** — IPv6 /64 subnet bucketing (item 3).
- **§11.3 Daily Budget Middleware** — best-effort wording (item 1); per-origin counter (item 20).
- **§11.4 LinkStore Interface** — `put` rejects overwrites (item 13).
- **§11.5 ID Generation** — `generateAndReserveId` always existence-checks (item 13).
- **§12.5 useRedirect Hook** — 404 retry (item 5), 43-char hash check (item 12), `replaceState` clear (item 9), in-app UA detection (item 16), URL object navigation (item 14).
- **§12.7 Constants** — `PADDING_BUCKETS`, `IN_APP_BROWSER_UA_PATTERNS`, `PER_ORIGIN_BUDGET_FRACTION`, `MAX_TTL_SECONDS`. (`TTL_CEILINGS_BY_SIZE` was removed in v1.1.1.)
- **§12.8 url-validation.ts** — `validateRedirectTarget` returns parsed `URL` object (item 14).
- **§13.4 Fragment Security** — adds SR-FRAG-04, SR-FRAG-05, SR-KEY-01.
- **§13.5 Input Sanitization** — replaces SR-INPUT-02; adds SR-INPUT-05, SR-INPUT-06, SR-INPUT-07.
- **§13.6 Open Redirect Protection** — adds note clarifying no host blocklist by design (item 7).
- **§13.9 Cache Hygiene** — new subsection with SR-CACHE-01 (item 18).
- **§14.2 Redirect Edge Cases** — adds first-404-retry and in-app-browser rows.
- **§15 Notefade Integration** — per-origin sub-quota narrative (item 20).
- **§18 Roadmap v1.2** — rewritten for HMAC-derived deletion token (item 19).
- **§18 Roadmap v1.4** — references shared `generateAndReserveId` flow (item 13).
- **§19 Decisions Log** — adds 7 new rows for v1.1.0 decisions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Privacy Principle](#2-core-privacy-principle)
3. [Threat Model](#3-threat-model)
4. [Cryptographic Architecture](#4-cryptographic-architecture)
5. [Tech Stack Decisions](#5-tech-stack-decisions)
6. [Cloudflare Free Tier Constraints](#6-cloudflare-free-tier-constraints)
7. [Repository Structure](#7-repository-structure)
8. [Functional Requirements](#8-functional-requirements)
9. [API Design](#9-api-design)
10. [Data Model](#10-data-model)
11. [Worker Architecture](#11-worker-architecture)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Security Requirements](#13-security-requirements)
14. [Edge Cases & Error Handling](#14-edge-cases--error-handling)
15. [Notefade Integration](#15-notefade-integration)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Testing & Verification Plan](#17-testing--verification-plan)
18. [Roadmap](#18-roadmap)
19. [Decisions Log](#19-decisions-log)

---

## 1. Project Overview

### 1.1 What VoidHop Is

VoidHop is a zero-knowledge, privacy-first URL shortener. It accepts arbitrarily long URLs, encrypts them entirely client-side, stores only the opaque ciphertext on the server, and produces a short URL (~70 characters) that, when visited, decrypts and redirects the recipient — all within their browser. The server is architecturally incapable of reading the destination URL at any point.

### 1.2 Why It Exists

The immediate trigger is Notefade (notefade.com), a companion zero-knowledge note-sharing service. Notefade stores encrypted note payloads in the URL fragment. Realistic URL lengths:

| Note size | URL length |
|-----------|------------|
| Single short note (padded) | ~7,300 chars |
| 10,000 char note | ~45,000 chars |
| 50,000 char note (max) | ~200,000 chars |

These lengths exceed the practical character limits of WhatsApp, Signal, Telegram, Slack, Discord, SMS gateways, and most QR code scanners. Conventional shorteners (bit.ly, tinyurl) destroy Notefade's privacy guarantees because they store the full original URL in plaintext, including the AES key that lives in the fragment. VoidHop solves this without compromising on the zero-knowledge property.

VoidHop is also a general-purpose shortener for any URL, not exclusively Notefade links.

### 1.3 Design Goals — Priority Order

1. **Zero-knowledge server** — the server must be architecturally incapable of reading the redirect destination, even under full compromise, legal seizure, or insider threat.
2. **Zero hosting cost** — all infrastructure must fit within Cloudflare's free tier indefinitely at expected traffic volumes. No paid plans, no credit card required.
3. **Short output URL** — final short URL ≤ 100 characters, practically targeting ~70.
4. **Self-hostable** — the entire stack can be deployed to any Cloudflare account with a single `wrangler deploy`.
5. **Notefade integration** — seamless optional companion integration, loosely coupled.
6. **No analytics, no tracking** — no IP logging, no click counters, no referrer logging by default.

### 1.4 Relationship to Notefade

VoidHop is a sibling project in the same privacy-first portfolio. It shares the same cryptographic pattern (AES-256-GCM key in URL fragment), the same hosting model (Cloudflare Pages + Workers + KV), and the same build toolchain. Code reuse is intentional and expected, especially in the crypto layer.

---

## 2. Core Privacy Principle

### 2.1 The Architectural Guarantee

The URL fragment (`#...`) is, by the HTTP specification (RFC 7230), stripped by the browser before any HTTP request is sent. It is never transmitted to the server, never appears in access logs, never appears in Referer headers, and never traverses the network. This is not a policy or a setting — it is a browser-enforced hardware boundary.

VoidHop places the AES-256-GCM decryption key exclusively in the URL fragment. The server receives only:
- The random link ID (8 characters, meaningless without the key)
- The encrypted blob (AES-256-GCM ciphertext, computationally unbreakable without the key)

This means:
- Server compromise → attacker gets IDs and opaque ciphertexts. Zero useful data.
- Legal seizure / subpoena → same result. No plaintext URLs exist server-side.
- Insider threat → same result.
- Network interception → same result (HTTPS also in place as defense-in-depth).
- VoidHop operator curiosity → same result.

### 2.2 What the Server Knows

| Information | Server visibility |
|---|---|
| Destination URL | ❌ Never |
| AES key | ❌ Never |
| Number of links created | ✅ (KV key count) |
| Approximate ciphertext size (bucketed) | ✅ (one of 5 discrete bucket sizes — see §4.4a) |
| TTL selected | ✅ |
| Creation timestamp | ✅ (KV native metadata) |
| Requester IP | ⚠️ Cloudflare logs transiently (see §3) |
| Click count | ❌ Not stored (see §8.5) |

### 2.3 What the Server Does NOT Know

- Any part of the destination URL
- Whether destination is HTTP or HTTPS
- Whether the link is a Notefade URL or a regular URL
- The exact length of the plaintext URL — only the bucket tier it falls into (one of 5 discrete sizes)
- Whether two identical URLs were shortened (random IV ensures different ciphertexts)

---

## 3. Threat Model

### 3.1 Threats VoidHop Defeats

| Threat | Mitigation |
|---|---|
| Server database breach | Only ciphertext stored; no key material |
| Legal subpoena for redirect data | Server genuinely has no plaintext data to produce |
| Server-side logging of URLs | Fragment never transmitted; nothing to log |
| Passive network interception | HTTPS + fragment never leaves browser |
| Malicious VoidHop operator | Architectural impossibility; operator cannot read blobs |
| Compromised CDN (Cloudflare) | Ciphertext only; HTTPS in place |
| Referrer header leak | `Referrer-Policy: no-referrer` on all responses |
| Ciphertext-to-ciphertext correlation | Random IV ensures no two encryptions of same URL are identical |
| URL parser / navigator divergence (e.g., `javascript:` smuggling) | Navigation always uses canonical `URL.href`, never the raw decrypted string |
| Padding-oracle attacks on the padding scheme | Length-prefix unpadding runs only after AES-GCM auth-tag verification — no oracle exists |
| URL length inference at byte resolution | Tiered padding buckets reduce side-channel resolution to 5 discrete classes |
| Hash key inheritance into destination navigation | Hash is cleared from address bar via `history.replaceState` immediately on mount |

### 3.2 Threats VoidHop Does NOT Defeat (Honest Limitations)

| Threat | Explanation |
|---|---|
| Compromised sender device | If the sender's browser/OS is compromised, the plaintext URL is readable before encryption |
| Compromised recipient device | Same; decrypted URL readable after decryption in-browser |
| URL shared over insecure channel | If the short URL (including `#key`) is sent over an insecure channel, link content is exposed |
| Cloudflare IP logging | Cloudflare retains IPs at network level per their own policies; this is unavoidable on their infrastructure |
| Timing attacks on link creation | An adversary with access to Cloudflare KV write timestamps could correlate link creation timing with external signals, but not read content |
| Key brute-force | Theoretical; AES-256 keyspace makes this computationally infeasible |
| JavaScript supply chain attack | A compromised VoidHop JS bundle could exfiltrate keys; self-hosters should pin and audit; the open-source nature allows verification |
| Metadata leakage to Cloudflare | Cloudflare sees the encrypted blob's bucket size (one of 5 tiers — see §4.4a) and TTL |
| **VoidHop does not enforce destination-host policy** | The user's browser performs the navigation. VoidHop validates the URL **scheme** (only `http`/`https`), but does not blocklist private IP ranges, `localhost`, cloud metadata endpoints (`169.254.169.254`), or any other destination by host. The risk is identical to that of any plain web link; the recipient's browser is the relevant trust boundary. A destination blocklist would (a) break legitimate intranet/dev/home-lab link sharing, (b) provide no meaningful protection since attackers can send the raw URL directly, and (c) introduce a misleading sense of server-side filtering on a system that does no server-side fetching. |
| **Browser extensions with `tabs` or `webNavigation` permissions** | Many browser extensions (grammar checkers, SEO tools, password managers, accessibility helpers, screenshot tools) read `window.location.href`, which includes the fragment, and may exfiltrate it to their own backends. VoidHop cannot prevent this technically. The about page warns users that opening a VoidHop link in a browser with untrusted extensions installed can compromise the zero-knowledge property. Recommendation for high-sensitivity use: open VoidHop links in a private/incognito window (most extensions are disabled there by default) or in a clean browser profile. |
| **Cross-tenant abuse via allowed origins** | The CORS allowlist (currently `voidhop.com` and `notefade.com`) means an XSS or supply-chain compromise of any allowed origin can issue legitimate-looking POSTs to `/api/v1/links` and burn the global daily write budget on VoidHop's behalf. This cannot be prevented without either (a) breaking the Notefade integration entirely, or (b) introducing a CAPTCHA that itself harms the privacy story. Mitigations applied: per-origin daily write sub-quotas (see §9.3), the ability to revoke an origin from the allowlist quickly via `wrangler.toml`, and operator monitoring of per-origin write counts via the `/api/v1/health` endpoint. |

### 3.3 Abuse Threat Model

VoidHop must not become a convenient tool for hosting malicious redirects. Mitigations:

- **No free anonymous persistence** — all links have a TTL and expire.
- **Rate limiting** — POST endpoint rate-limited per IP, with IPv6 sources bucketed by /64 prefix.
- **No analytics to optimize** — link performance data unavailable to creator; no incentive for spam SEO use.
- **Client-side redirect validation** — only `http://` and `https://` schemes are permitted as redirect targets. `javascript:`, `data:`, `ftp:`, and any other schemes are blocked before the redirect fires.
- **No server-side redirect** — the server serves an HTML/JS shell that decrypts and redirects; it never issues a 301/302 to an opaque URL.
- **Public README discloses architecture** — reduces risk of misuse under false security assumptions.
- **Best-effort budget enforcement.** Daily KV write budget enforcement is best-effort, not transactional. KV has no atomic increment, so under extreme concurrent burst the Worker may write up to ~50 entries past the configured `DAILY_WRITE_BUDGET` before backpressure engages. The 50-entry buffer below the 1,000/day KV ceiling absorbs this race. **Hard upper-bound enforcement** is provided by a Cloudflare network-edge rate-limit rule (see §6.2), not by the Worker.
- **Per-origin sub-quotas.** Each CORS-allowed origin has its own slice of the daily budget (see §9.3) to contain the blast radius of a compromise in any single allowlisted partner.

---

## 4. Cryptographic Architecture

### 4.1 Algorithm Choices

| Purpose | Algorithm | Rationale |
|---|---|---|
| Symmetric encryption | AES-256-GCM | Industry standard authenticated encryption; AEAD guarantees ciphertext integrity; available in Web Crypto API without any npm dep |
| Key generation | `crypto.getRandomValues()` (32 bytes) | CSPRNG; browser-native |
| IV generation | `crypto.getRandomValues()` (12 bytes) | Standard AES-GCM IV length |
| Key encoding in URL | base64url (no padding) | URL-safe; compact; standard |
| Blob encoding for API transport | base64url | URL-safe; standard |
| Link ID generation | `crypto.getRandomValues()` (6 bytes → 8 base64url chars) | 48 bits of entropy; collision probability negligible at KV scale |
| Padding | Length-prefix to a tiered bucket size | No delimiter collisions; supports bucket sizes > 255 bytes; GCM-authenticated end-to-end |
| Deletion-token derivation (v1.2) | HMAC-SHA-256(rawKey, "voidhop-deletion-v1") | Deterministic from the AES key; preserves zero-knowledge property; zero extra UX |

### 4.2 Encryption Flow (Create)

```
plaintext URL (string)
  │
  ├─ TextEncoder → UTF-8 bytes
  │
  ├─ pickBucket(plaintext.length) → bucket size from §4.4a
  │
  ├─ padBytesLengthPrefix(plaintext, bucket) → padded plaintext (length == bucket)
  │     layout: [4-byte BE length][plaintext][zero fill]
  │
  ├─ crypto.getRandomValues(12 bytes) → IV
  │
  ├─ crypto.getRandomValues(32 bytes) → AES-256-GCM key (rawKey)
  │
  ├─ crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, paddedPlaintext)
  │     → ciphertext bytes (bucket + 16 bytes GCM tag)
  │
  ├─ payload = concat(IV [12 bytes] + ciphertext [bucket + 16 bytes])
  │
  ├─ blob = base64url(payload)
  │
  └─ POST /api/v1/links { blob, ttl }
         → { id: "aBcD1234" }

short URL = https://voidhop.com/aBcD1234#<key_base64url_no_padding>
```

### 4.3 Decryption Flow (Redirect)

```
Recipient loads https://voidhop.com/aBcD1234#k1L2m3...
                                   ^^^^^^^^  ^^^^^^^^
                                   path      fragment (never sent to server)

  ├─ Page JS: read window.location.hash → key_b64url
  ├─ Page JS: enforce key_b64url.length === 43 (32-byte AES key in base64url)
  │      otherwise short-circuit to MISSING_KEY error
  │
  ├─ Page JS: window.history.replaceState(null, '', window.location.pathname)
  │      strips the key from the address bar before any further code runs
  │
  ├─ Page JS: fetches GET /api/v1/links/aBcD1234
  │     → { blob: "..." }
  │     (on first 404, retry once after 1500 ms — see §12.5)
  │
  ├─ base64url decode blob → raw bytes
  │
  ├─ split: IV = bytes[0:12], ciphertext = bytes[12:]
  │
  ├─ base64url decode key → rawKeyBytes (Uint8Array, 32 bytes)
  │
  ├─ crypto.subtle.importKey("raw", rawKeyBytes, "AES-GCM", false, ["decrypt"])
  │     → CryptoKey (extractable: false)
  │
  ├─ crypto.getRandomValues(rawKeyBytes)   ← scrub raw key bytes in-place
  │
  ├─ crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext)
  │     → padded plaintext bytes
  │     → or throws if GCM tag invalid (tampered ciphertext)
  │
  ├─ unpadBytesLengthPrefix(padded) → plaintext bytes
  │
  ├─ TextDecoder → destination URL string
  │
  ├─ validated = validateRedirectTarget(destinationUrlString) → URL object
  │     - parses with URL constructor
  │     - asserts scheme is http: or https:
  │
  └─ window.location.replace(validated.href)
```

### 4.4 Plaintext Padding (length-prefix scheme)

To prevent the server from inferring URL length from blob size, plaintexts are padded using a **length-prefix scheme** before encryption. The padded form is exactly `bucket` bytes long (where `bucket` is the chosen tier from §4.4a) and is laid out as:

```
[ length: 4 bytes BE uint32 ][ plaintext: length bytes ][ zero fill: bucket - 4 - length bytes ]
```

The decoder reads the first 4 bytes as a big-endian uint32 length `N`, validates `0 ≤ N ≤ bucket - 4`, and returns the next `N` bytes as the plaintext. The remaining `bucket - 4 - N` bytes are zero fill and are discarded.

**Why not literal PKCS#7?** Feedback item 6 originally suggested PKCS#7. Literal PKCS#7 encodes the padding length in each padding byte, so the maximum representable padding is 255 bytes — far short of the 1 KB minimum bucket. The length-prefix scheme preserves PKCS#7's two essential properties — (a) no delimiter collision because the length lives in a fixed position rather than being implied by data content, and (b) deterministic, oracle-free decoding — while supporting the bucket sizes VoidHop actually needs.

**Authentication.** The length header, the plaintext, and the zero fill are all encrypted under AES-256-GCM as a single contiguous buffer. Any tampering — flipping a length-header bit, mutating the plaintext, or modifying the zero fill — fails the GCM tag check and the entire decryption returns an error. There is **no padding-oracle vector** because the unpadding code runs only after GCM has authenticated the entire buffer.

### 4.4a Tiered Padding Buckets

The PKCS#7 padding from §4.4 pads each plaintext up to the smallest bucket from this set that is strictly larger than the plaintext length:

| Bucket | Bytes |
|---|---|
| 1 KB    | 1024   |
| 10 KB   | 10240  |
| 50 KB   | 51200  |
| 100 KB  | 102400 |
| 256 KB  | 262144 |

Bucket selection: pick the smallest bucket `B` such that `4 + plaintext.length ≤ B`. The 4 accounts for the length-prefix header from §4.4. A 1020-byte plaintext fits in the 1 KB bucket (1024 bytes). A 1021-byte plaintext requires the 10 KB bucket. Any plaintext such that `4 + plaintext.length > 262144` is rejected client-side with a "URL too long to shorten" error.

The cost is wasted bytes for short URLs (a 50-byte URL still produces a ~1 KB blob). The benefit is that an observer with access only to blob byte lengths cannot distinguish a 5,000-character note from a 5,100-character note — both fall into the same 10 KB bucket. This drops the side-channel resolution from 256 bytes (v1.0.0) to 5 discrete classes.

The maximum Notefade URL (~200,000 chars) falls into the 256 KB bucket. Post-encryption blob is 262,156 bytes, ~349,524 chars base64url. Within the 256 KB blob cap (`MAX_BLOB_SIZE_B64`).

### 4.5 URL Length Math

```
https://voidhop.com/  = 20 chars
Link ID               =  8 chars (6 random bytes → 8 base64url)
#                     =  1 char
AES-256 key (32 bytes → base64url no padding) = 43 chars
─────────────────────────────────────────────────────
Total                 = 72 chars
```

72 characters fits comfortably in every messenger, SMS gateway, QR code generator, and email client.

### 4.6 Entropy & Collision Analysis

Link ID: 6 random bytes = 48 bits of entropy = 281,474,976,710,656 possible IDs.
At 1,000 KV writes/day (free tier maximum), expected collision: >700,000 years.
On collision: retry with a new random ID (maximum 3 retries before returning 503). The retry path uses `LinkStore.exists()` to check before writing — see §11.5.

### 4.7 Key Importation

The raw 32-byte key is stored in the fragment as base64url. On the redirect page, it is imported via:

```typescript
const cryptoKey = await crypto.subtle.importKey(
  "raw", rawKeyBytes, { name: "AES-GCM" }, false, ["decrypt"]
);
```

The `extractable: false` flag prevents the imported `CryptoKey` from being exported from the browser's crypto context. This is a defense-in-depth measure against accidental key logging by page JS.

**Memory hygiene.** Immediately after `crypto.subtle.importKey` returns the non-extractable `CryptoKey`, the original `Uint8Array` holding the raw key bytes **must** be overwritten in place with random data:

```typescript
const cryptoKey = await crypto.subtle.importKey(
  "raw", rawKeyBytes, { name: "AES-GCM" }, false, ["decrypt"]
);
crypto.getRandomValues(rawKeyBytes); // scrub
// any further reference to rawKeyBytes is now random noise, not the key
```

JavaScript provides no guarantee about garbage collection of the buffer, but the in-place overwrite ensures that any concurrent or subsequent read of the same memory cells yields random bytes, not the key. This is defense-in-depth against XSS that may scrape page memory in the narrow window between hash decode and key import. After scrubbing, the only remaining handle to key material is the non-extractable `CryptoKey`.

---

## 5. Tech Stack Decisions

### 5.1 Frontend

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 19 | Matches Notefade stack; concurrent features for Suspense-based loading states |
| Language | TypeScript 5.x (strict mode) | Notefade parity; type safety across crypto layer is critical |
| Build tool | Vite 6 with Rolldown bundler | New Rolldown-backed Vite; Rust-based bundler, faster HMR; OXC linter replaces ESLint |
| Linting | OXC (built into Vite/Rolldown toolchain) | Zero-config linting integrated in the new Vite toolchain |
| Routing | TanStack Router v1 | Type-safe file-based routing; no react-router-dom overhead; search params typed |
| Server state | TanStack Query v5 | Handles the two API calls (POST link, GET blob) with retry, loading, error states |
| Client state | React hooks only (no Zustand) | State surface is tiny: current link result + redirect status. Zustand is overkill. |
| Crypto | Web Crypto API only | Zero npm crypto deps; same audit story as Notefade; browser-native CSPRNG |
| Validation | Zod | Notefade parity; validates non-blob fields (blob has its own fast pre-check) |
| QR generation | qrcode-generator (same as Notefade) | Dependency parity; no canvas dependency; pure JS |
| Package manager | npm | Bundled with Node, no extra install required |

### 5.2 Backend

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Cloudflare Workers | Free tier; global edge; zero cold-start; Notefade parity |
| Storage | Cloudflare KV | Native TTL; free tier sufficient for expected volume; simple key-value matches use case |
| Worker framework | Hono | Lightweight, typed, Cloudflare-native router; replaces manual URL routing; tree-shakeable |
| Input validation | Zod (same dep as frontend) | Runtime validation of POST body's small fields; the blob field has a hand-rolled fast path |

### 5.3 Infrastructure

| Layer | Choice | Rationale |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Free tier; unlimited bandwidth; automatic HTTPS; custom domain; Git-based deploys |
| Backend hosting | Cloudflare Workers (bundled with Pages) | Pages Functions or standalone Worker; free tier 100k req/day |
| Storage | Cloudflare KV | Free tier: 100k reads/day, 1k writes/day, 1 GB storage |
| Network-edge rate limiting | Cloudflare Basic Rate Limiting (free tier) | Hard cap on POST burst rate, evaluated before Worker invocation — see §6.2 |
| Domain | voidhop.com (already purchased) | |
| DNS | Cloudflare (default for Pages) | Required for Pages custom domain |

### 5.4 Why Not Zustand

The application has two routes:
- `CreatePage`: local state for input URL, TTL selection, result URL — all ephemeral, unmounted on navigate.
- `RedirectPage`: reads hash, fetches blob, decrypts, redirects — linear state machine with no UI interaction.

There is no shared state between routes, no persistent client state, and no complex state transitions. React's `useState` + TanStack Query covers 100% of the state surface.

### 5.5 Why Hono Over Raw Workers

Hono adds: typed routing, middleware composition (rate limiting, CORS, security headers as reusable middleware), request/response helpers, and Zod integration. Bundle overhead is ~14 KB compressed — acceptable. Alternative (raw `fetch` handler with manual URL matching) is error-prone and harder to audit.

---

## 6. Cloudflare Free Tier Constraints

All design decisions must fit within these hard limits:

### 6.1 Cloudflare Workers Free Tier

| Metric | Free limit | VoidHop usage |
|---|---|---|
| Requests/day | 100,000 | API calls; burst-safe for personal/indie use |
| CPU time/request | 10 ms | Crypto happens client-side; Worker only does KV read/write + validation. The blob fast path (§11.1) and Zod minimization keep large requests under the cap. |
| Script size | 1 MB compressed | Hono + Zod well under this |
| Subrequests | 50/request | Not used |

**Implication:** CPU-intensive operations (encryption, decryption) must never happen in the Worker. Worker only stores and retrieves blobs. This is already required by the privacy architecture.

### 6.2 Cloudflare KV Free Tier

| Metric | Free limit | VoidHop usage | Notes |
|---|---|---|---|
| Reads/day | 100,000 | Each redirect = 1 read | Primary limit |
| Writes/day | 1,000 | Each link creation = 1 write | **Critical constraint** |
| Deletes/day | 1,000 | Manual deletion | Counted against write limit |
| Storage | 1 GB | Up to 256 KB per blob (5 buckets — see §4.4a) | Bounded by the universal 7-day TTL cap, see below |
| Keys | Unlimited | — | Not a concern |

**The 1,000 writes/day limit is the primary hard constraint on VoidHop's capacity.** Design decisions reflect this:

- **Per-IP rate limiting** is set to prevent a single abuser from exhausting the daily write budget. The `POST /api/v1/links` rate limit is 20 requests/15 minutes/IP (with IPv6 bucketed by /64 — see §11.2), which means a single IP can create at most 1,920 links/day.
- **Global daily write counter.** A global daily write counter is maintained in KV (`__meta:writes:YYYY-MM-DD`) and checked before each link creation. If the counter reaches 950, new link creation returns 503 with `Retry-After: <seconds until midnight UTC>`. This counter is **best-effort** (KV has no atomic increment); see §11.3 for the race semantics.
- **Per-origin sub-quotas.** Each CORS-allowed origin has its own slice of the daily budget — see §9.3.
- **Hard cap delegated to network edge.** Hard cap enforcement is delegated to Cloudflare's Basic Rate Limiting (free tier, evaluated at the network edge before any Worker invocation). Configure a global rule: **max 60 POSTs/min to `/api/v1/links` across all source IPs**. This produces an absolute worst-case ceiling of ~86,400 POSTs/day on paper, but in practice — combined with per-IP and per-origin limits — it prevents any concurrent burst from overshooting the KV write budget by more than a small constant. The Worker's KV-based counter is now a *budget signal* and the source of graceful 503 responses, **not** the hard cap. Without this rule, KV's lack of atomic increments allows ~50 concurrent requests at counter value 949 to all observe `< 950` and all proceed to write, blowing past the 1,000/day limit in a single burst.

**Storage capacity narrative.**

The **universal 7-day TTL cap** (introduced in v1.1.1) bounds the maximum age of any link. This means storage growth is bounded by a 7-day rolling window of new writes:

- **Realistic case.** Average shortened URL is ~50–500 bytes plain → ~1 KB blob after padding to the 1 KB bucket. At an aggressive 500 writes/day, steady-state resident bytes ≈ 500 × 1 KB × 7 days = ~3.5 MB. Trivially under the 1 GB cap.
- **Pessimistic case.** All writes are at the largest 256 KB bucket. At 950 writes/day, steady-state resident bytes ≈ 950 × 256 KB × 7 days ≈ 1.66 GB, which exceeds the 1 GB free-tier cap.
- **What happens at the cap.** Cloudflare KV rejects further `put` operations once the namespace is full. The Worker catches this and returns `503 STORAGE_ERROR` for new writes. Existing links remain readable until natural TTL expiry — the failure is non-destructive. Operators can monitor approach to the cap via `/api/v1/health` and the `writes_today` metric.
- **Why 7 days is enough.** Without a 7-day cap (e.g., the original v1.0.0 with 1-year TTL), a single day of max-blob abuse would resident 250 MB indefinitely; sustained abuse for ~4 days would saturate the namespace and KV would reject all further writes for ~361 days. The 7-day cap collapses that 1-year recovery window to a 7-day rolling window: even at the pessimistic worst case, the namespace fully self-heals within a week of abuse stopping.

### 6.3 Cloudflare Pages Free Tier

| Metric | Free limit | VoidHop impact |
|---|---|---|
| Builds/month | 500 | Fine for typical dev cadence |
| Bandwidth | Unlimited | No concern |
| Custom domains | Unlimited | voidhop.com |
| Sites | Unlimited | — |

### 6.4 Free Tier Monitoring

The Worker exposes an internal health endpoint (`GET /api/v1/health`) that returns:
- Current day's write count (from `__meta:writes:YYYY-MM-DD`)
- Current day's read count estimate (from `__meta:reads:YYYY-MM-DD`)
- Per-origin write count for each allowed origin
- Remaining write budget (global and per-origin)
- Server UTC timestamp

This endpoint is rate-limited to 10 req/min/IP and intended for operators only (no auth, but no sensitive data either).

---

## 7. Repository Structure

```
voidhop/
├── public/
│   ├── favicon.ico
│   └── robots.txt                 # Disallow /api; allow /; disallow /__hopcheck
├── src/
│   ├── crypto/
│   │   ├── encrypt.ts             # encryptUrl(url: string): Promise<EncryptResult>
│   │   ├── decrypt.ts             # decryptBlob(blob: string, keyB64: string): Promise<string>
│   │   ├── padding.ts             # padBytesPKCS7, unpadBytesPKCS7, pickBucket
│   │   ├── encoding.ts            # base64urlEncode, base64urlDecode
│   │   └── types.ts               # EncryptResult { blob, keyB64url, iv }
│   ├── api/
│   │   ├── client.ts              # createLink(blob, ttl), getBlob(id) — with single 404 retry
│   │   └── types.ts               # CreateLinkRequest, CreateLinkResponse, GetBlobResponse
│   ├── hooks/
│   │   ├── use-create-link.ts     # useMutation wrapping encrypt + createLink + build short URL
│   │   └── use-redirect.ts        # reads & scrubs hash, fetches blob, decrypts, validates, redirects
│   ├── routes/
│   │   ├── __root.tsx             # TanStack Router root layout
│   │   ├── index.tsx              # CreatePage — paste URL, select TTL, get short URL
│   │   ├── $id.tsx                # RedirectPage — /:id route
│   │   ├── about.tsx              # AboutPage — privacy explanation, threat model
│   │   └── not-found.tsx          # 404 fallback
│   ├── components/
│   │   ├── copy-button/           # Copy-to-clipboard with visual feedback
│   │   ├── ttl-selector/          # TTL option selector (1h/24h/7d — 7d is the universal max)
│   │   ├── short-url-result/      # Result panel: short URL + copy + QR code
│   │   ├── error-display/         # Reusable error message component
│   │   ├── redirect-status/       # "Redirecting…" splash with constant-text manual fallback
│   │   └── theme-toggle/          # Light/dark toggle (port from Notefade)
│   ├── constants/
│   │   └── index.ts               # TTL_OPTIONS, MAX_TTL_SECONDS, PADDING_BUCKETS,
│   │                              # IN_APP_BROWSER_UA_PATTERNS, PER_ORIGIN_BUDGET_FRACTION,
│   │                              # MAX_BLOB_SIZE, API_BASE_URL, SUPPORTED_SCHEMES
│   ├── utils/
│   │   ├── url-validation.ts      # validateRedirectTarget(url): ValidationResult<URL>
│   │   └── ua-detection.ts        # isInAppBrowser(userAgent: string): boolean
│   ├── routeTree.gen.ts           # Auto-generated by TanStack Router
│   ├── main.tsx
│   └── App.tsx
├── worker/
│   ├── index.ts                   # Hono app entry — mounts all routes + middleware
│   ├── routes/
│   │   ├── links.ts               # POST/GET/DELETE/HEAD /api/v1/links[/:id]
│   │   └── health.ts              # GET /api/v1/health
│   ├── middleware/
│   │   ├── rate-limit.ts          # IP-based (IPv6 /64) rate limiting via KV
│   │   ├── security-headers.ts    # Outermost wrapper — applies to ALL responses incl. errors
│   │   ├── cors.ts                # Origin allowlist
│   │   └── daily-budget.ts        # Global + per-origin write budget enforcement
│   ├── store/
│   │   ├── link-store.ts          # interface LinkStore { put, get, delete, exists }
│   │   └── kv-link-store.ts       # CloudflareKVLinkStore — `put` rejects overwrites
│   ├── id-generator.ts            # generateId() and generateAndReserveId(store)
│   └── types.ts                   # Env bindings, LinkRecord
├── tests/
│   ├── unit/
│   │   ├── crypto/
│   │   │   ├── encrypt.test.ts
│   │   │   ├── decrypt.test.ts
│   │   │   ├── roundtrip.test.ts
│   │   │   ├── padding.test.ts    # PKCS#7 + bucket boundary tests
│   │   │   └── memory-hygiene.test.ts
│   │   ├── worker/
│   │   │   ├── rate-limit.test.ts # incl. IPv6 /64 bucketing
│   │   │   ├── id-generator.test.ts
│   │   │   └── daily-budget.test.ts # incl. per-origin sub-quota
│   │   └── utils/
│   │       ├── url-validation.test.ts
│   │       └── ua-detection.test.ts
│   ├── integration/
│   │   └── links-api.test.ts      # Miniflare-based Worker tests; cache-header coverage
│   └── e2e/
│       └── create-redirect.spec.ts  # Playwright full-flow tests
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SELF-HOSTING.md
│   └── PRIVACY.md
├── wrangler.toml
├── vite.config.ts
├── tsconfig.json
├── tsconfig.worker.json
├── package.json
└── README.md
```

---

## 8. Functional Requirements

### 8.1 Link Creation (CreatePage)

**FR-CREATE-01:** The user can paste or type any URL into a single text input field.

**FR-CREATE-02:** The system performs basic URL format validation client-side before submission. Accepted URLs must:
- Begin with `http://` or `https://`
- Be parseable by the browser's `URL` constructor without throwing

**FR-CREATE-03:** The user can select a TTL from exactly three options: 1 hour, 24 hours, 7 days (default and maximum). 7 days is a hard universal cap — there is no longer-lived option in the UI or in the API (see §6.2).

**FR-CREATE-04:** On submission, the system:
1. Pads the URL using the length-prefix scheme (§4.4) to the smallest bucket from `PADDING_BUCKETS` (§4.4a) that can hold the 4-byte length header plus the plaintext bytes
2. Generates a cryptographically random 32-byte AES-256-GCM key
3. Generates a cryptographically random 12-byte IV
4. Encrypts the padded URL bytes with AES-256-GCM using the generated key and IV
5. Constructs the blob: `base64url(IV + ciphertext)`
6. POSTs `{ blob, ttl }` to `POST /api/v1/links`
7. Receives `{ id }` from the server
8. Constructs the short URL: `https://voidhop.com/<id>#<key_base64url>`
9. Displays the short URL to the user

**FR-CREATE-05:** All cryptographic operations in FR-CREATE-04 happen exclusively in the browser using the Web Crypto API. No key material, no plaintext URL, and no IV are transmitted to the server.

**FR-CREATE-06:** The result panel displays the full short URL in a read-only text field.

**FR-CREATE-07:** A copy-to-clipboard button copies the full short URL (including the `#key` fragment) to the clipboard.

**FR-CREATE-08:** A QR code representation of the short URL is generated client-side and displayed in the result panel.

**FR-CREATE-09:** The result panel displays the selected TTL and computed expiry time (e.g., "Expires in 7 days — 2026-04-16 12:34 UTC").

**FR-CREATE-10:** A "Create another" action resets the form to its initial state without navigating away.

**FR-CREATE-11:** The form input is cleared and the result panel is hidden/reset if the user modifies the URL after a successful creation. (Prevents stale result display.)

**FR-CREATE-12:** While the creation request is in-flight, the submit button is disabled and a loading indicator is shown. The input and TTL selector remain non-interactive during this period.

**FR-CREATE-13:** If the server returns an error (rate limit, budget exhausted, validation error, TTL-exceeds-size), the error is surfaced to the user with a human-readable message. No technical error codes are shown to the user.

### 8.2 Redirect (RedirectPage)

**FR-REDIRECT-01:** The route `/:id` is the redirect page. Any path with a single segment (matching `[a-zA-Z0-9_-]{6,12}`) is treated as a link ID.

**FR-REDIRECT-02:** On mount, the page immediately reads `window.location.hash`. The hash is then validated and processed in the following order, all synchronously and in the first tick of mount:

1. Slice the leading `#` and any secondary fragment (`#key#anchor` → take the part before the second `#`).
2. **Enforce that the resulting string is exactly 43 characters long** — the base64url encoding of a 32-byte AES-256 key with no padding. If it is empty, missing, or any other length, abort with the missing-key error path below.
3. **Immediately call `window.history.replaceState(null, '', window.location.pathname)`** to strip the key fragment from the address bar before any subsequent navigation, fetch, or render. This eliminates the risk that a browser quirk later inherits the fragment into the destination navigation.

**Missing-key error path.** If the hash failed validation in steps 1–2, the page renders an error. **Before rendering**, perform a User-Agent check: if the User-Agent matches any pattern in `IN_APP_BROWSER_UA_PATTERNS`, render this in-app-browser-specific error instead of the generic one:

> **Your in-app browser blocked part of this link.**
>
> In-app browsers (Instagram, TikTok, Facebook Messenger, etc.) often strip the security key from VoidHop links. Tap the menu (•••) and choose "Open in Safari" / "Open in Chrome", then paste the original link there.

Otherwise render the generic error: *"This link is incomplete. The decryption key is missing from the URL. Make sure you copied the full link."*

**FR-REDIRECT-03:** The page fetches `GET /api/v1/links/<id>`. If the server returns 404, the hook automatically retries the request **exactly once** after 1500 ms (to absorb KV eventual-consistency lag — see §12.5). Only after the second 404 does the page render: *"This link has expired or does not exist."* During the retry window the UI shows "Confirming link…" — still part of the loading state.

**FR-REDIRECT-04:** The fetched blob is decrypted client-side using the key from the URL hash. If decryption fails (GCM authentication tag mismatch), the page renders: *"This link has been tampered with and cannot be decrypted safely."*

**FR-REDIRECT-05:** After successful decryption, the URL is parsed via `validateRedirectTarget()`, which returns a parsed `URL` object on success. The validator asserts the scheme is `http:` or `https:`. Any other scheme (including `javascript:`, `data:`, `ftp:`, `vbscript:`, `file:`, `blob:`) causes the page to render: *"This link points to an unsupported or unsafe destination."* See §12.8 for the validator contract.

**FR-REDIRECT-06:** After all validations pass, the page executes `window.location.replace(validated.href)` where `validated` is the `URL` object returned from `validateRedirectTarget()`. **The raw decrypted string must never be passed to `window.location.replace`, `window.location.assign`, or any `<a href>`.** This guarantees the navigation target is exactly what the URL parser evaluated, preventing parser/navigator divergence (a documented historical CVE class). `replace` is used (not `assign` or `href`) to keep the redirect page out of browser history.

**FR-REDIRECT-07:** While redirect is in progress, a "Redirecting…" status message is shown along with a manual fallback link: "Click here if you are not redirected automatically."

**FR-REDIRECT-08:** The manual fallback link uses the `href` attribute set to `validated.href` (the canonical post-`URL`-constructor form, **not** the raw decrypted string). The link's **visible text is the constant string "Click here to proceed"** — never the destination URL itself. This guarantees that no unfiltered byte from the decrypted plaintext ever reaches DOM text content. The link opens via standard anchor navigation; no JS required for the fallback.

**FR-REDIRECT-09:** On any error state (FR-REDIRECT-02 through FR-REDIRECT-05), the redirect page renders an appropriate error message. No redirect attempt is made. A link back to the VoidHop home page is always shown.

**FR-REDIRECT-10:** The redirect page must not store, log, or transmit the decrypted URL or the key fragment to any external service (no analytics calls, no error reporting calls that include URL content).

### 8.3 Link Deletion (Self-Destruct)

**FR-DELETE-01:** Link creators do not receive a deletion token at creation time in v1.0. Deletion is not a v1.0 user-facing feature.

**FR-DELETE-02:** The `DELETE /api/v1/links/:id` endpoint exists and is functional for operator/admin use (e.g., abuse response). It requires no auth in v1.0 but is not advertised in the UI. Auth-gated deletion is a v1.2 roadmap item — see §18 — and uses an HMAC derivation of the AES key, so it requires no second secret from the user.

**FR-DELETE-03:** All links are automatically expired by KV TTL (max 7 days). The application does not implement its own expiry check; it relies entirely on KV native TTL deletion.

### 8.4 About / Privacy Page

**FR-ABOUT-01:** A static `/about` page explains the privacy architecture in plain language.

**FR-ABOUT-02:** The about page must include:
- A step-by-step description of the create flow (non-technical language)
- A step-by-step description of the redirect flow
- An explanation of why the server cannot read the destination URL
- The honest limitations section (what VoidHop does NOT protect against, matching §3.2)
- An explicit warning about browser extensions reading URL fragments, with the recommendation to use a private/incognito window for high-sensitivity links
- A link to the GitHub repository

**FR-ABOUT-03:** The about page must not contain any privacy claims that overstate the system's guarantees.

### 8.5 No Analytics

**FR-ANALYTICS-01:** VoidHop collects no analytics. No click count, no creation count, no geographic data, no device data, no referrer data is stored per link.

**FR-ANALYTICS-02:** No third-party analytics scripts (Google Analytics, Plausible, Fathom, etc.) are loaded by default.

**FR-ANALYTICS-03:** No link preview / opengraph metadata is generated server-side for `/:id` routes, as this would require the server to process the link ID in the context of a preview fetcher, potentially enabling enumeration.

### 8.6 Theme

**FR-THEME-01:** The application supports light and dark themes.

**FR-THEME-02:** The default theme follows the user's OS preference (`prefers-color-scheme`).

**FR-THEME-03:** The user can toggle the theme manually. The preference is persisted in `localStorage`.

---

## 9. API Design

### 9.1 Base URL

```
https://voidhop.com/api/v1
```

All API endpoints are served by the Cloudflare Worker. The Cloudflare Pages Function (`/functions/api/[[path]].ts`) proxies to the Worker, or the Worker is deployed as a standalone service on the same Cloudflare account with Pages routing `api/*` traffic to it.

### 9.2 Endpoints

#### `POST /api/v1/links` — Create a link

**Request body:**
```json
{
  "blob": "<base64url encoded IV+ciphertext>",
  "ttl": 604800
}
```

**TTL values (seconds):**

| Label | Seconds |
|---|---|
| 1 hour | 3600 |
| 24 hours | 86400 |
| 7 days (default and max) | 604800 |

The maximum TTL for any link is 7 days. This is a universal cap, not a size-tier ceiling — it applies regardless of blob size. See §6.2 for the storage rationale.

**Validation pipeline (in order):**

1. **Fast blob pre-check** (no Zod, no regex) — see §11.1 and §13.5 (SR-INPUT-02):
   - `typeof body.blob === "string"` else `400 INVALID_BLOB`
   - `1 ≤ body.blob.length ≤ MAX_BLOB_SIZE_B64` (~349,526) else `400 BLOB_TOO_LARGE`
   - Single-pass character check (`A-Za-z0-9_-` only) else `400 INVALID_BLOB`
2. **Zod validation** of the remaining small fields:
   - `ttl`: required, integer, must be one of the three accepted values exactly (3600, 86400, 604800)
3. **Rate limit + per-origin sub-quota + global daily budget** (see §11.3).

**Success response (201):**
```json
{
  "id": "aBcD1234"
}
```

**Error responses:**
- `400 Bad Request`: body validation failure. Body: `{ "error": "INVALID_BLOB" | "INVALID_TTL" | "BLOB_TOO_LARGE" }`
- `429 Too Many Requests`: rate limit hit. Headers: `Retry-After: <seconds>`. Body: `{ "error": "RATE_LIMITED" }`
- `503 Service Unavailable`: global daily write budget exhausted. Headers: `Retry-After: <seconds until midnight UTC>`. Body: `{ "error": "DAILY_BUDGET_EXHAUSTED" }`
- `503 Service Unavailable`: per-origin sub-quota exhausted (the global budget may still be available to other origins). Headers: `Retry-After: <seconds until midnight UTC>`. Body: `{ "error": "ORIGIN_BUDGET_EXHAUSTED" }`
- `500 Internal Server Error`: KV write failure. Body: `{ "error": "STORAGE_ERROR" }`

**Rate limit:** 20 requests per 15 minutes per IP (IPv6 bucketed by /64 — see §11.2).

---

#### `GET /api/v1/links/:id` — Retrieve a blob

**Path parameter:**
- `id`: 6–12 base64url characters

**Success response (200):**
```json
{
  "blob": "<base64url encoded IV+ciphertext>"
}
```

**Cache:** `Cache-Control: no-store, no-cache` — blobs must never be cached by CDN or browser. Applied to **all** responses on this endpoint by middleware (§9.4, §11.1).

**Error responses:**
- `404 Not Found`: returned for both (a) valid-format ID with no corresponding record and (b) invalid-format ID. Body: `{ "error": "NOT_FOUND" }` in both cases. Internal logging may distinguish the two for debugging, but the response is byte-identical. This collapses an enumeration side-channel that would otherwise let an attacker map the ID validator without ever consuming a real lookup.
- `429 Too Many Requests`: rate limit hit. Body: `{ "error": "RATE_LIMITED" }`.

**Rate limit:** 60 requests per minute per IP.

---

#### `DELETE /api/v1/links/:id` — Delete a link

**Success response:** `204 No Content`

**Error responses:**
- `404 Not Found`: returned for both invalid ID format and valid-but-missing IDs (same rationale as GET).
- `429 Too Many Requests`

**Rate limit:** 10 requests per minute per IP.

**Note:** No authentication in v1.0. Endpoint is functional but not advertised in UI. The ID itself is the implicit authorization token in v1.0 — only someone who knows the ID can delete it. v1.2 adds authenticated deletion via an HMAC-derived deletion token (see §18); the token is computed from the AES key, so the deletion right is held by exactly the same set of people who can read the link.

---

#### `HEAD /api/v1/links/:id` — Check existence

**Success response:** `200 OK` (link exists)
**Not found:** `404 Not Found` (covers both invalid format and valid-but-missing)
No body. Used by the Notefade integration to verify a short link is still alive before displaying it.

---

#### `GET /api/v1/health` — Operator health check

**Success response (200):**
```json
{
  "status": "ok",
  "writes_today": 42,
  "writes_remaining": 908,
  "writes_by_origin": {
    "https://voidhop.com": 30,
    "https://notefade.com": 12
  },
  "writes_remaining_by_origin": {
    "https://voidhop.com": 920,
    "https://notefade.com": 558
  },
  "reads_today": 1203,
  "server_time_utc": "2026-04-09T14:23:00Z"
}
```

**Rate limit:** 10 requests per minute per IP.

---

### 9.3 CORS Policy

The CORS `Access-Control-Allow-Origin` header is restricted to:
- `https://voidhop.com`
- `https://notefade.com` (for the Notefade integration)
- `http://localhost:*` (development only; stripped in production build)

All other origins receive a CORS rejection.

**Per-origin write sub-quotas.** In addition to the global counter (`__meta:writes:<YYYY-MM-DD>`), the Worker tracks daily writes **per origin** in a separate key: `__meta:writes:<YYYY-MM-DD>:<origin>`. Each allowed origin has a soft sub-quota expressed as a fraction of `DAILY_WRITE_BUDGET`:

| Origin | Sub-quota fraction |
|---|---|
| `https://voidhop.com` | 1.00 (full budget) |
| `https://notefade.com` | 0.60 (60% of budget) |

When an origin reaches its sub-quota, that origin's POSTs return `503 ORIGIN_BUDGET_EXHAUSTED`. The global budget remains available to other origins. This containment limits the blast radius of an XSS or supply-chain compromise in any allowlisted partner: even with a legitimate `Origin: https://notefade.com` header, the abuser can burn at most 60% of VoidHop's daily writes.

The sub-quota is intentionally lower than 100% for any non-primary origin so that a partner outage cannot consume the budget that VoidHop's own users depend on. Operators can adjust the table in `worker/middleware/daily-budget.ts` (and `PER_ORIGIN_BUDGET_FRACTION` in `src/constants/index.ts`) and redeploy.

CAPTCHA enforcement on high-volume creation was considered and **rejected**: third-party CAPTCHA scripts and first-party CAPTCHA fingerprinting are both incompatible with VoidHop's privacy posture. Per-origin sub-quotas plus rapid allowlist revocation are sufficient containment.

### 9.4 Security Headers on All Responses

```
Referrer-Policy: no-referrer
Cache-Control: no-store, no-cache
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://voidhop.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'
Permissions-Policy: interest-cohort=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

CSP `unsafe-inline` is allowed for styles only (needed for CSS Modules emitted inline by Vite in production). Script sources are restricted to `'self'`.

**Security headers, including `Cache-Control: no-store, no-cache`, are applied via a top-of-stack middleware that wraps the entire Hono app.** The middleware runs after every route handler, error handler, and not-found handler — regardless of status code (200, 201, 204, 400, 404, 429, 500, 503). **No 404, 429, or other error response may ever be served from CDN cache.** This is critical because a transiently-cached 404 (e.g., during the KV replication lag absorbed by the §12.5 retry) would otherwise make the link appear permanently dead long after the underlying KV entry has fully replicated.

---

## 10. Data Model

### 10.1 KV Key Schema

```
links:<id>                                  → LinkRecord (JSON)
__meta:writes:<YYYY-MM-DD>                  → number (string-encoded)
__meta:writes:<YYYY-MM-DD>:<origin>         → number (string-encoded)
__meta:reads:<YYYY-MM-DD>                   → number (string-encoded)
rl:<endpoint_tag>:<ipv4_full|ipv6_/64>:<window_id>  → number (rate-limit counter)
```

### 10.2 LinkRecord

```typescript
// v1.0 / v1.1 schema
interface LinkRecord {
  blob: string;      // base64url encoded IV+ciphertext
  ttl: number;       // seconds (original selection)
  createdAt: string; // ISO 8601 UTC timestamp
  version: 1;        // schema version for future migration
}
```

TTL expiry is handled by KV's native `expirationTtl` option on `put()`. The `ttl` field in the record is stored for informational purposes only (e.g., health endpoint stats).

The v1.2 roadmap (see §18) introduces a v2 schema that adds a `deletionTokenHash` field; readers must tolerate both versions.

### 10.3 KV Namespace

Production: `VOIDHOP_KV`
Development (wrangler dev): local KV simulation via Miniflare

The namespace ID is configured in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "VOIDHOP_KV"
id = "<production-namespace-id>"
preview_id = "<preview-namespace-id>"
```

### 10.4 Environment Variables (Worker)

```toml
[vars]
ENVIRONMENT = "production"          # "development" | "production"
ALLOWED_ORIGINS = "https://voidhop.com,https://notefade.com"
DAILY_WRITE_BUDGET = "950"          # Leave 50 buffer below KV 1k limit
```

All variables are non-secret (no API keys, no private credentials). The cryptographic security does not rely on any server-side secret.

---

## 11. Worker Architecture

### 11.1 Request Lifecycle

The Hono middleware stack is registered in this order so that **security headers wrap every response**, including those produced by error handlers:

```
Incoming request
  │
  ├─ security-headers middleware (OUTERMOST — applies to ALL responses, all status codes)
  │
  ├─ CORS middleware (validates Origin, adds CORS headers)
  │
  ├─ rate-limit middleware (per-endpoint, per-IP, KV-backed; IPv6 /64 buckets)
  │
  ├─ Router (Hono)
  │   ├─ POST /api/v1/links
  │   │     ├─ blob fast pre-check (length + charset, single tight loop, no Zod, no regex)
  │   │     ├─ Zod validation of small fields (ttl)
  │   │     ├─ TTL-ceiling check based on decoded blob size
  │   │     ├─ daily-budget middleware (global + per-origin sub-quota)
  │   │     ├─ generateAndReserveId (always exists-checks before put)
  │   │     ├─ KV.put (LinkStore.put — rejects overwrites)
  │   │     └─ 201 { id }
  │   ├─ GET /api/v1/links/:id → validate id (404 on invalid) → KV.get → 200 | 404
  │   ├─ DELETE /api/v1/links/:id → validate id (404 on invalid) → KV.delete → 204 | 404
  │   ├─ HEAD /api/v1/links/:id → validate id (404 on invalid) → KV.get (keys only) → 200 | 404
  │   └─ GET /api/v1/health → KV.get meta keys → 200
  │
  ├─ notFound handler — JSON 404 (still wrapped by security-headers)
  │
  └─ onError handler — JSON 500 (still wrapped by security-headers)
```

**Critical ordering rule.** `security-headers` must be registered as the very first `app.use()`, and `notFound` / `onError` must be registered **after** all `app.use()` calls. Hono guarantees that middleware registered before `notFound`/`onError` wraps their responses.

**Blob fast pre-check.** The POST handler runs the following inline before invoking Zod (this keeps the Worker safely under the 10 ms CPU cap even for 256 KB payloads):

```typescript
// 1. Type check
if (typeof body.blob !== "string") {
  return c.json({ error: "INVALID_BLOB" }, 400);
}

// 2. Length bounds
if (body.blob.length === 0 || body.blob.length > MAX_BLOB_SIZE_B64) {
  return c.json({ error: "BLOB_TOO_LARGE" }, 400);
}

// 3. Charset (single tight loop, no regex)
for (let i = 0; i < body.blob.length; i++) {
  const c0 = body.blob.charCodeAt(i);
  // base64url alphabet: A-Z (65-90), a-z (97-122), 0-9 (48-57), '-' (45), '_' (95)
  const ok =
    (c0 >= 65 && c0 <= 90) ||
    (c0 >= 97 && c0 <= 122) ||
    (c0 >= 48 && c0 <= 57) ||
    c0 === 45 ||
    c0 === 95;
  if (!ok) return c.json({ error: "INVALID_BLOB" }, 400);
}

// 4. Only after the blob has passed the fast path, hand the body to Zod
//    for the remaining (small) fields — currently just `ttl`.
const parsed = createLinkSchema.parse(body);
```

### 11.2 Rate Limiting Implementation

Rate limiting is implemented using Cloudflare KV as a sliding-window counter store. Because this consumes KV reads and writes, the implementation uses a tumbling-window approach (per minute or per 15-minute window) to minimize KV operations.

**IP bucketing — IPv6 /64 collapse.** Source IP is parsed from `CF-Connecting-IP`. The bucket key is derived as follows:
- IPv4 addresses: bucketed by full address.
- IPv6 addresses: bucketed by **`/64` prefix** (the first four hextets). Modern hosting providers and many residential ISPs hand out /64 blocks per customer; rate-limiting an exact IPv6 address is therefore largely ineffective against IPv6 rotation.

**KV key shape:**
```
rl:<endpoint_tag>:<ipv4_full | ipv6_/64>:<window_id>
```
where `window_id = floor(Date.now() / windowMs)`.

**KV TTL:** `windowMs * 2` seconds (auto-cleanup).

**Request flow:**
1. `KV.get(rl_key)` → current count
2. If count ≥ limit → return 429 with `Retry-After`
3. Else → `KV.put(rl_key, count + 1, { expirationTtl: windowTtl })`

**Trade-off:** This adds 1 KV read + 1 KV write per request to the rate-limit counter KV budget. These are counted against the global 100k reads/day and 1k writes/day. Rate-limit KV writes must be factored into the daily budget calculation. At 100 requests/day typical volume, rate-limit overhead is negligible. At traffic spike, rate-limiting itself is constrained by KV write budget — at 950 writes/day budget, half consumed by rate-limit metadata saturates at ~475 link creations. **Mitigation:** Cloudflare's network-edge Basic Rate Limiting rule from §6.2 absorbs abusive volume *before* the Worker is invoked, avoiding KV consumption entirely for blocked requests.

### 11.3 Daily Budget Middleware

Applied only to `POST /api/v1/links`. The middleware enforces both a global daily budget and a per-origin sub-quota.

1. Compute the date key: `<YYYY-MM-DD>` in UTC.
2. Read the global counter `KV.get("__meta:writes:<date>")` → `globalCount` (treat null as 0).
3. If `globalCount ≥ DAILY_WRITE_BUDGET` → return `503 DAILY_BUDGET_EXHAUSTED` with `Retry-After: <seconds until midnight UTC>`.
4. Read the per-origin counter `KV.get("__meta:writes:<date>:<origin>")` → `originCount` (treat null as 0).
5. Compute `originLimit = floor(DAILY_WRITE_BUDGET * PER_ORIGIN_BUDGET_FRACTION[origin])`. Default to `0` (deny) for any origin not in the table — but since CORS already rejects unlisted origins, this branch is unreachable in practice.
6. If `originCount ≥ originLimit` → return `503 ORIGIN_BUDGET_EXHAUSTED` with `Retry-After: <seconds until midnight UTC>`.
7. Proceed with link creation (delegate to handler).
8. After successful `KV.put(links:<id>)`, increment **both** counters via read-modify-write:
   - `KV.put("__meta:writes:<date>", globalCount + 1, { expirationTtl: 172800 })`
   - `KV.put("__meta:writes:<date>:<origin>", originCount + 1, { expirationTtl: 172800 })`

The 48-hour TTL on counter keys ensures automatic cleanup of old day counters.

**Best-effort, not transactional.** KV has no atomic increment. Under burst load, multiple concurrent requests may each read the same pre-write counter value and each write `count+1` over the same key, losing increments. This race is intentionally tolerated because (a) the network-edge rate-limit rule from §6.2 caps the absolute burst rate that can reach the Worker, and (b) the configured `DAILY_WRITE_BUDGET = 950` leaves a 50-entry buffer below the KV ceiling of 1,000/day to absorb any small overshoot.

### 11.4 LinkStore Interface

```typescript
interface LinkStore {
  put(id: string, record: LinkRecord, ttlSeconds: number): Promise<void>;
  get(id: string): Promise<LinkRecord | null>;
  delete(id: string): Promise<boolean>; // returns false if not found
  exists(id: string): Promise<boolean>;
}
```

**`put` contract: must not overwrite.** Implementations must check `exists(id)` immediately before writing and throw `IdCollisionError` if a record already exists. Cloudflare KV has no native `if-not-exists`, so this is enforced at the application layer. The small race window between `exists` and `put` is acceptable because random IDs make actual collision astronomically unlikely (see §4.6). The same `exists`-then-`put` flow is what makes the v1.4 custom-ID feature safe — the existence check is the single source of overwrite protection regardless of whether the ID was random or user-supplied.

The Cloudflare KV implementation (`kv-link-store.ts`) implements this interface. Future adapters (D1, Upstash, Supabase) implement the same interface and are responsible for honoring the no-overwrite contract.

### 11.5 ID Generation

```typescript
async function generateId(): Promise<string> {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes); // → 8 characters
}

async function generateAndReserveId(store: LinkStore): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = await generateId();
    if (!(await store.exists(id))) return id;
  }
  throw new IdCollisionError();
}
```

The Worker **must** call `generateAndReserveId(store)` (not bare `generateId`) before every `store.put`, even with random IDs, so that the same code path safely handles v1.4's user-supplied custom IDs. On collision (KV `exists` returns true for the generated ID): retry up to 3 times with a fresh random ID. After 3 collisions: return 503 (effectively impossible at current scale; handled defensively).

The Worker's `crypto` is the Web Crypto API available in the Workers runtime. No external dependency.

---

## 12. Frontend Architecture

### 12.1 Routing

TanStack Router with file-based routing. Route tree:

```
/ (root layout — theme toggle, nav, footer)
├── /                    → CreatePage
├── /$id                 → RedirectPage (catches all /:id paths)
├── /about               → AboutPage
└── * (not-found)        → NotFoundPage
```

The `$id` route uses TanStack Router's `params.id` and reads `window.location.hash` directly (not via router, since fragments are not router-managed).

### 12.2 Crypto Module

`src/crypto/` is a pure TypeScript module with no framework dependency. All functions are async (Web Crypto API is Promise-based).

```typescript
// encrypt.ts
export async function encryptUrl(url: string): Promise<EncryptResult>
// Returns: { blob: string, keyB64url: string }
// blob = base64url(IV[12] + ciphertext[bucket+16])
// keyB64url = base64url(rawKey[32])
// Throws: UrlTooLongError if plaintext exceeds 256 KB bucket

// decrypt.ts
export async function decryptBlob(blob: string, keyB64url: string): Promise<string>
// Returns: decrypted URL string
// Throws: DecryptionError (tag mismatch), PaddingError (corrupt PKCS#7 padding)
// Internally: imports key non-extractable, scrubs raw key bytes after import (§4.7)

// padding.ts — length-prefix scheme (see §4.4)
export const PADDING_BUCKETS: readonly number[]; // [1024, 10240, 51200, 102400, 262144]
export const LENGTH_HEADER_BYTES: 4;
export function pickBucket(plaintextLen: number): number;
export function padBytesLengthPrefix(input: Uint8Array, bucket: number): Uint8Array;
// Layout: [4-byte BE uint32 length][input bytes][zero fill to bucket].
// Throws UrlTooLongError if 4 + input.length > bucket.
export function unpadBytesLengthPrefix(input: Uint8Array): Uint8Array;
// Reads the first 4 bytes as a big-endian uint32 length N, validates that
// 0 <= N <= input.length - 4, and returns input.slice(4, 4 + N).
// Throws PaddingError on any inconsistency.

// encoding.ts
export function base64urlEncode(bytes: Uint8Array): string
export function base64urlDecode(str: string): Uint8Array
```

Error types are typed discriminated unions:

```typescript
type CryptoError =
  | { type: 'DECRYPTION_FAILED'; message: string }
  | { type: 'PADDING_INVALID'; message: string }
  | { type: 'KEY_INVALID'; message: string }
  | { type: 'BLOB_INVALID'; message: string }
  | { type: 'URL_TOO_LONG'; message: string };
```

### 12.3 API Client

`src/api/client.ts` wraps `fetch` with typed request/response. No TanStack Query dependency at this layer — TanStack Query wraps the client in the hooks layer.

```typescript
export async function createLink(req: CreateLinkRequest): Promise<CreateLinkResponse>
export async function getBlob(id: string): Promise<GetBlobResponse>
export async function deleteLink(id: string): Promise<void>
export async function checkExists(id: string): Promise<boolean>
```

All functions throw typed `ApiError`:

```typescript
type ApiError =
  | { type: 'RATE_LIMITED'; retryAfter: number }
  | { type: 'BUDGET_EXHAUSTED'; retryAfter: number }
  | { type: 'ORIGIN_BUDGET_EXHAUSTED'; retryAfter: number }
  | { type: 'NOT_FOUND' }
  | { type: 'VALIDATION_ERROR'; field: string }
  | { type: 'SERVER_ERROR' }
  | { type: 'NETWORK_ERROR' };
```

### 12.4 `useCreateLink` Hook

```typescript
function useCreateLink(): {
  mutate: (url: string, ttl: TtlOption) => void;
  state: 'idle' | 'encrypting' | 'uploading' | 'success' | 'error';
  result: ShortLinkResult | null;
  error: CryptoError | ApiError | null;
  reset: () => void;
}
```

The `state` field provides granular progress:
- `encrypting` — Web Crypto operations in progress (typically < 50 ms)
- `uploading` — POST to API in progress

This granularity allows the UI to show encryption progress separately from network progress, reinforcing to the user that encryption happens locally.

### 12.5 `useRedirect` Hook

```typescript
function useRedirect(id: string): {
  state: 'loading' | 'confirming' | 'decrypting' | 'validating' | 'redirecting' | 'error';
  error: RedirectError | null;
  destinationHref: string | null; // set during 'redirecting' state for the constant-text fallback link
}

type RedirectError =
  | { type: 'MISSING_KEY'; inAppBrowser: boolean }
  | { type: 'NOT_FOUND' }
  | { type: 'DECRYPTION_FAILED' }
  | { type: 'TAMPERED' }
  | { type: 'UNSAFE_SCHEME'; scheme: string }
  | { type: 'NETWORK_ERROR' };
```

**Mount sequence (synchronous, first tick):**

```typescript
// 1. Read and structurally validate the hash.
const rawHash = window.location.hash.slice(1).split('#')[0];
if (rawHash.length !== 43) {
  setError({
    type: 'MISSING_KEY',
    inAppBrowser: isInAppBrowser(navigator.userAgent),
  });
  return;
}
const keyB64url = rawHash;

// 2. Strip the hash from the address bar BEFORE any further code runs.
window.history.replaceState(null, '', window.location.pathname);

// 3. Begin the fetch.
fetchBlobWithRetry(id);
```

**Fetch with single retry on 404.** On the first 404 response from `GET /api/v1/links/:id`, the hook does **not** transition immediately to the `error` state. Instead:

1. Transition state to `'confirming'` (UI shows "Confirming link…").
2. Wait 1500 ms.
3. Re-issue the same `GET` exactly once.
4. If the second response is also 404, transition to `error` with `RedirectError.NOT_FOUND`.
5. If the second response is 200, proceed normally.

The retry must be **exactly one** — never repeated, never exponential — to absorb KV eventual-consistency lag without amplifying load against actually-missing keys.

**Decrypt → validate → navigate.** After a successful fetch:

1. `decryptBlob(blob, keyB64url)` — internally imports key non-extractable, scrubs raw key bytes, decrypts, unpads PKCS#7. Throws on any error.
2. `const validated = validateRedirectTarget(decryptedString)` → `URL` object or error.
3. Set `destinationHref = validated.href`. Set state to `'redirecting'`.
4. `window.location.replace(validated.href)` — never the raw decrypted string.

### 12.6 State Management

No global state store (no Zustand, no Redux). All state is local to route components:

- `CreatePage`: local `useState` for URL input, TTL selection; `useCreateLink` for async state.
- `RedirectPage`: `useRedirect` manages all state.
- Theme preference: `localStorage` + `useState` in root layout, propagated via CSS class on `<html>`.

### 12.7 Constants

```typescript
// src/constants/index.ts

export const TTL_OPTIONS = [
  { label: '1 hour',   seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days',   seconds: 604800 },  // default AND maximum
] as const;

export const DEFAULT_TTL = 604800;
export const MAX_TTL_SECONDS = 604800; // universal 7-day cap (v1.1.1)

export const MAX_BLOB_SIZE_BYTES = 256 * 1024; // 256 KB
export const MAX_BLOB_SIZE_B64 = Math.ceil(MAX_BLOB_SIZE_BYTES * 4 / 3); // ~349,526

export const SUPPORTED_REDIRECT_SCHEMES = ['http:', 'https:'] as const;

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://voidhop.com/api/v1';

// Padding (PKCS#7 to one of these tier sizes — see §4.4a)
export const PADDING_BUCKETS = [1024, 10240, 51200, 102400, 262144] as const;

export const LENGTH_HEADER_BYTES = 4; // big-endian uint32 — see §4.4

export function pickBucket(plaintextLen: number): number {
  // Need room for the 4-byte length header plus all of the plaintext.
  for (const b of PADDING_BUCKETS) {
    if (LENGTH_HEADER_BYTES + plaintextLen <= b) return b;
  }
  throw new Error("URL too long to shorten");
}

// (v1.1.0 had a TTL_CEILINGS_BY_SIZE table here; removed in v1.1.1 because
// the universal MAX_TTL_SECONDS cap subsumes it.)

// User-Agent substrings for in-app browsers known to mangle URL fragments — see FR-REDIRECT-02
// Intentionally a substring match, not a regex, to keep this fast and obvious.
export const IN_APP_BROWSER_UA_PATTERNS: readonly string[] = [
  "Instagram",
  "FBAN",        // Facebook app
  "FBAV",        // Facebook app variant
  "FB_IAB",      // Facebook in-app browser
  "Messenger",
  "TikTok",
  "musical_ly",  // legacy TikTok
  "MicroMessenger", // WeChat
  "Line/",
  "KAKAOTALK",
  "Twitter",     // mobile Twitter / X in-app browser
  "LinkedInApp",
] as const;

// Per-origin write sub-quotas — see §9.3
export const PER_ORIGIN_BUDGET_FRACTION: Record<string, number> = {
  "https://voidhop.com": 1.0,
  "https://notefade.com": 0.6,
};

export const ID_MIN_LENGTH = 6;
export const ID_MAX_LENGTH = 12;

// Exact length of a base64url-encoded 32-byte AES-256 key (no padding) — see §13.4 SR-FRAG-05
export const AES_KEY_B64URL_LENGTH = 43;
```

### 12.8 URL Validation

`src/utils/url-validation.ts`:

```typescript
export function validateInputUrl(raw: string): ValidationResult<string>
// Checks: non-empty, parseable by URL constructor, scheme is http or https
// Used at FR-CREATE-02 (create-time input validation)

export function validateRedirectTarget(decryptedUrl: string): ValidationResult<URL>
// Returns the parsed URL object on success (NOT a string).
// Checks: parseable by URL constructor, scheme is in SUPPORTED_REDIRECT_SCHEMES
// Explicitly rejects: javascript:, data:, vbscript:, ftp:, file:, blob:, and any unknown schemes
// Returns typed error if invalid
```

The redirect validation is the critical security check. It is applied after decryption, before any navigation. **The caller must use `validated.value.href` (the canonical URL form) for both `window.location.replace` and any anchor `href` attribute** — never the raw decrypted string passed in. This guarantees the navigation target is exactly what the URL parser evaluated, preventing parser/navigator divergence (a documented historical CVE class).

`src/utils/ua-detection.ts`:

```typescript
export function isInAppBrowser(userAgent: string): boolean
// Returns true if the User-Agent contains any substring from IN_APP_BROWSER_UA_PATTERNS.
// Used by FR-REDIRECT-02 to provide a targeted error message when known in-app browsers
// strip URL fragments.
```

---

## 13. Security Requirements

### 13.1 Transport Security

- **SR-TLS-01:** All HTTP traffic must be redirected to HTTPS. Cloudflare Pages enforces this automatically.
- **SR-TLS-02:** HSTS header with `max-age=31536000; includeSubDomains; preload` must be set on all responses.
- **SR-TLS-03:** Cloudflare's minimum TLS version must be set to TLS 1.2 (Cloudflare account setting).

### 13.2 Content Security Policy

- **SR-CSP-01:** CSP header as defined in §9.4 must be applied to all responses.
- **SR-CSP-02:** `script-src 'self'` — no inline scripts, no external script hosts.
- **SR-CSP-03:** `connect-src 'self'` — API calls only to `voidhop.com`. No external data exfiltration possible via XHR/fetch.

### 13.3 Referrer Policy

- **SR-REF-01:** `Referrer-Policy: no-referrer` on all responses. This ensures that if a user navigates from the VoidHop redirect page to the destination, the destination site does not see `voidhop.com` as the referrer (which would reveal that the user is using VoidHop).

### 13.4 Fragment Security

- **SR-FRAG-01:** The application must never transmit the URL fragment to the server. All code must be audited to confirm that `window.location.hash` is never included in any `fetch` call, `XMLHttpRequest`, or form submission.
- **SR-FRAG-02:** The application must never log `window.location.hash` to any logging service, analytics service, or error reporting service.
- **SR-FRAG-03:** No server-side rendering may access the fragment (SSR is not used; this is a static SPA).
- **SR-FRAG-04:** The redirect page must clear `window.location.hash` via `window.history.replaceState(null, '', window.location.pathname)` within the first synchronous tick of mount, before the API fetch and before render. This prevents browser-quirk fragment inheritance into the destination navigation.
- **SR-FRAG-05:** The redirect page must short-circuit to a `MISSING_KEY` error if the URL fragment (after slicing the leading `#` and any secondary fragment) is not exactly `AES_KEY_B64URL_LENGTH` (43) characters in length. This check runs **before** any decoding, decryption, or fetch and prevents adversarial fragments from consuming CPU or memory.
- **SR-KEY-01:** The raw key `Uint8Array` must be overwritten with `crypto.getRandomValues()` immediately after `crypto.subtle.importKey` returns the non-extractable `CryptoKey`. No code path may retain or pass the raw key array onward; only the resulting non-extractable `CryptoKey` is permitted to flow to `decrypt`.

### 13.5 Input Sanitization

- **SR-INPUT-01:** All API input is validated in the Worker before processing. Small fields (e.g., `ttl`) use Zod; the `blob` field uses a hand-rolled fast path (SR-INPUT-02).
- **SR-INPUT-02:** The `blob` field is validated by a manual length-and-charset check (no regex, no Zod) inline in the handler before any further processing. Zod is reserved for non-base64 fields. This keeps the worst-case validation under the Worker's 10 ms CPU budget for 256 KB payloads. The exact validation logic is in §11.1.
- **SR-INPUT-03:** The `id` path parameter is validated to contain only base64url characters and be within `ID_MIN_LENGTH` to `ID_MAX_LENGTH`. Any non-matching value returns **404** (not 400) on GET/HEAD/DELETE — see §9.2 — to collapse the enumeration side channel.
- **SR-INPUT-04:** The decrypted URL is validated with `validateRedirectTarget()` before any navigation. This is a mandatory security check against `javascript:` and `data:` scheme injection.
- **SR-INPUT-05:** Rate-limit buckets must be subnet-aware. IPv4 sources are bucketed by full address. IPv6 sources are bucketed by `/64` prefix. This applies to all rate-limited endpoints.
- **SR-INPUT-06:** No decrypted URL string may be rendered as DOM text. The destination is conveyed only via `<a href={validated.href}>Click here to proceed</a>`. Audits must confirm that no JSX in `redirect-status/`, `error-display/`, or any descendant component interpolates the decrypted URL into a text node.
- **SR-INPUT-07:** Navigation always uses the canonical `URL.href` form returned by `validateRedirectTarget`. The raw decrypted string must never be passed to `window.location.replace`, `window.location.assign`, or anchor `href` attributes anywhere in the codebase.

### 13.6 Open Redirect Protection

- **SR-OR-01:** VoidHop is, by nature, a redirect service. The protection against open redirect abuse is:
  1. All links are ephemeral (TTL ≤ 7 days, universally — see §6.2).
  2. The server cannot enumerate the contents of any link.
  3. Only `http://` and `https://` schemes are permitted as redirect targets (enforced client-side after decryption).
  4. No server-side 301/302 redirect is ever issued to an opaque destination.
  5. Navigation always goes through the canonical `URL.href` form, not the raw decrypted string.

**Note on private destinations.** SR-OR-01 deliberately does **not** include a host blocklist for private IP ranges, `localhost`, or cloud metadata endpoints. See §3.2 for the rationale: VoidHop is a client-side redirector with no server-side fetch, so there is no SSRF surface to defend; a blocklist would (a) break legitimate intranet/dev/home-lab sharing, (b) provide no real protection (attackers can send the raw URL directly), and (c) be trivially bypassed by DNS rebinding and IP encoding tricks.

### 13.7 Subresource Integrity

- **SR-SRI-01:** The production build's `index.html` must include `integrity` attributes on all `<script>` and `<link rel="stylesheet">` tags. Vite generates these automatically in production builds when `build.cssCodeSplit` is configured.

### 13.8 No Server-Side Secret Required

The system's privacy guarantee does not depend on any server-side secret. There is no master key, no signing key, no API key. This means:
- No secret rotation required
- No risk of secret leak invalidating past links
- Self-hosters need no secret management infrastructure

### 13.9 Cache Hygiene

- **SR-CACHE-01:** All API responses, success or failure, must carry `Cache-Control: no-store, no-cache`. This is enforced by middleware applied to the outermost app wrapper (§11.1), not per-route. Coverage is verified by an integration test that requests every documented status code (200, 201, 204, 400, 404, 429, 500, 503) and asserts the header is present in each response. This prevents transient errors — particularly 404s during the §12.5 retry window — from being cached by Cloudflare's edge or any intermediate cache and producing the appearance of a permanently dead link.

---

## 14. Edge Cases & Error Handling

### 14.1 Creation Flow Edge Cases

| Scenario | Handling |
|---|---|
| URL with special characters (spaces, unicode, emoji) | `TextEncoder` handles UTF-8; no pre-escaping needed |
| Extremely long URL (200,000+ chars, Notefade max) | PKCS#7 padded to 256 KB bucket; encryption proceeds normally; blob ≤ 256 KB cap verified before POST |
| URL exactly at blob size limit | Accepted and processed normally |
| URL that would exceed 256 KB bucket after PKCS#7 padding | Client-side check before encryption; throws `URL_TOO_LONG`; UI shows "URL is too long to shorten" |
| Blob POST returns 503 `DAILY_BUDGET_EXHAUSTED` | UI shows "VoidHop has reached its daily link creation limit. Try again tomorrow." with computed `retryAfter` countdown |
| Blob POST returns 503 `ORIGIN_BUDGET_EXHAUSTED` (Notefade integration) | Notefade UI gracefully degrades: shows the long URL only with a non-blocking warning "VoidHop is at capacity for Notefade today — link still works without shortening." |
| Blob POST returns 429 (rate limited) | UI shows "You've created too many links recently. Try again in X minutes." |
| KV write collision (ID already exists) | `generateAndReserveId` retries up to 3 times with new random IDs; if all fail, returns 503 |
| User navigates away mid-creation | Pending fetch is cancelled on component unmount (AbortController); no dangling state |
| Same URL shortened twice | Produces two entirely different ciphertexts (different random IV each time); server stores two independent blobs; no deduplication |
| Clipboard API unavailable (insecure context) | Copy button falls back to `document.execCommand('copy')` with graceful failure message |

### 14.2 Redirect Flow Edge Cases

| Scenario | Handling |
|---|---|
| `#key` fragment missing from URL | Error: "This link is incomplete…" — no network request made. UA-checked: shows in-app-browser-specific error if applicable. |
| `#key` missing AND User-Agent matches `IN_APP_BROWSER_UA_PATTERNS` | Render the in-app-browser-specific error from FR-REDIRECT-02 instead of the generic incomplete-link message |
| Fragment present but not exactly 43 base64url characters | Short-circuits to `MISSING_KEY` error before any decoding (SR-FRAG-05) |
| Fragment present but not valid base64url | `base64urlDecode` throws; treated as `MISSING_KEY` error |
| Key is correct length but wrong key (different AES key) | GCM tag verification fails → `DECRYPTION_FAILED` / `TAMPERED` error |
| Server returns 404 on first read | Treated as possible KV replication lag. Auto-retry once after 1.5 s. Only after the second 404 surface the "expired or does not exist" error to the user |
| Server returns 404 on the retry as well | Error: "This link has expired or does not exist." |
| Server returns 429 (rate limited on GET) | Error: "Too many requests. Please wait and try again." |
| Network request fails (offline, DNS failure) | Error: "Could not reach VoidHop. Check your connection." |
| Decrypted URL is malformed (not a valid URL) | `URL` constructor throws; treated as validation error |
| Decrypted URL scheme is `javascript:` | `validateRedirectTarget` catches; Error: "This link points to an unsafe destination." |
| Decrypted URL scheme is `ftp://` | Same as above |
| Decrypted URL is `http://` (not HTTPS) | Allowed — valid URL scheme. Warning shown to user: "This link redirects to an unencrypted HTTP page." User must click manual link to proceed (no automatic redirect for HTTP destinations). |
| Decrypted URL points to a private IP / localhost / cloud metadata host | **Allowed.** VoidHop does not enforce destination-host policy by design — see §3.2. The browser's own protections apply. |
| Redirect destination returns error (404, 500) | Out of scope — VoidHop has redirected successfully; destination behavior is not VoidHop's responsibility |
| Fragment contains extra characters after key | Key is read as the portion of the hash before any second `#`. The 43-char check (SR-FRAG-05) then validates this portion. |
| Blob in KV is corrupt (truncated, invalid base64url) | `base64urlDecode` or `crypto.subtle.decrypt` fails; treated as `DECRYPTION_FAILED` error |
| User opens link on a device where Web Crypto API is unavailable | Graceful error: "Your browser does not support the cryptography required to open this link. Please use a modern browser." |

### 14.3 TTL Edge Cases

| Scenario | Handling |
|---|---|
| Link accessed 1 second before TTL expiry | KV returns the record; redirect proceeds normally |
| Link accessed at exact TTL boundary | KV may or may not have expired it (Cloudflare KV TTL is best-effort, not exact-second). If KV returns null, treated as 404 (subject to the §12.5 single retry) |
| TTL value in POST not in allowed set (must be 3600, 86400, or 604800) | Zod validation rejects; 400 `INVALID_TTL` |
| Client clock skew affecting expiry display | Display uses server response time + ttl seconds for expiry calculation; client clock not trusted for expiry computation |

### 14.4 KV Operational Edge Cases

| Scenario | Handling |
|---|---|
| KV read latency spike | TanStack Query retries once after 1 second; then surfaces network error |
| KV namespace full (1 GB) | `KV.put` returns an error; Worker returns 503 with `{ "error": "STORAGE_FULL" }` |
| KV `get` returns stale cached value after TTL | Not possible by KV design; TTL expiry is authoritative at KV level |
| Meta counter key missing (first write of the day) | `KV.get` returns null; treat as 0 count |
| Read-after-write replication lag | Single retry on first 404 (§12.5) absorbs typical lag without amplifying load |
| Concurrent writes race the global counter | Tolerated; 50-entry buffer below the KV ceiling absorbs the overshoot. Hard cap is the network-edge rate-limit rule (§6.2). |

---

## 15. Notefade Integration

### 15.1 Integration Architecture

The integration is opt-in and loosely coupled. Notefade works identically without VoidHop. VoidHop works identically without Notefade. No hard dependency in either direction.

### 15.2 Notefade-side Changes (Separate PR)

Files to modify in the Notefade repository:

**`notefade/src/constants/index.ts`**
- Add `VOIDHOP_DEFAULT_HOST: 'https://voidhop.com'`
- Add `STORAGE_KEYS.VOIDHOP_HOST` — allows self-hosters to override the VoidHop host

**`notefade/src/api/voidhop-client.ts`** (new file)
- `createShortLink(longUrl: string, ttl: number): Promise<string>` — calls VoidHop's `POST /api/v1/links` with the encrypted blob and returns the full short URL
- Uses the same `encryptUrl()` function from Notefade's own crypto module (not VoidHop's — same algorithm)
- Handles `503 ORIGIN_BUDGET_EXHAUSTED` distinctly from `503 DAILY_BUDGET_EXHAUSTED`

**`notefade/src/hooks/use-create-note.ts`**
- After the long URL is built, if VoidHop shortening is enabled (user setting), call `createShortLink` and display the short URL alongside the long URL
- The long URL is always retained and displayed; shortening is additive only

**`notefade/src/components/ShareResult.tsx`**
- Add "Shorten with VoidHop" toggle
- If enabled and short URL available: display short URL with copy button and QR
- If VoidHop request fails: graceful degradation — show long URL only, display non-blocking warning. For `ORIGIN_BUDGET_EXHAUSTED`: "VoidHop is at capacity for Notefade today — link still works without shortening." For other failures: "Shortening failed — the link still works."

**`notefade/src/settings/`**
- Add VoidHop host setting (for self-hosters running their own VoidHop instance)

### 15.3 Integration Flow

```
[Notefade creates note]
         │
         ├─ Builds long URL: https://notefade.com/#<key>...<blob>
         │
         ├─ If "Shorten with VoidHop" is enabled:
         │   ├─ encryptUrl(longUrl) → { blob, keyB64url }
         │   ├─ POST https://voidhop.com/api/v1/links { blob, ttl }
         │   │    → { id }                 (or 503 ORIGIN_BUDGET_EXHAUSTED → degrade)
         │   └─ shortUrl = https://voidhop.com/<id>#<keyB64url>
         │
         └─ Displays: [Short URL] and/or [Long URL]
```

Notefade requests against VoidHop are subject to a per-origin daily write sub-quota (currently 60% of VoidHop's global budget — see §9.3). On exhaustion, Notefade gracefully degrades by displaying the long URL only and surfacing a non-blocking warning. This containment limits the blast radius if Notefade is ever compromised by XSS or a supply-chain attack.

### 15.4 CORS Configuration

The VoidHop Worker's CORS allowed origins include `https://notefade.com` (see §9.3). This is required for the Notefade tab to make fetch requests to `https://voidhop.com/api/v1/links`. The CORS allowlist combined with the per-origin sub-quota is the layered defense against cross-tenant abuse.

### 15.5 TTL Alignment

When Notefade calls VoidHop, the TTL passed to VoidHop should match or exceed the Notefade note's TTL. If the VoidHop link expires before the note, the short URL stops working while the original long URL still works. Notefade passes its note's remaining TTL rounded up to the next VoidHop TTL option, **capped at the universal 7-day maximum**. Notefade notes intended to live longer than 7 days should fall back to the long URL only.

---

## 16. Non-Functional Requirements

### 16.1 Performance

- **NFR-PERF-01:** Short URL creation (including encryption + API call) must complete within 2 seconds on a modern device on a 4G connection under normal server load.
- **NFR-PERF-02:** Redirect page must execute the redirect within 1.5 seconds of page load on a modern device (decryption is < 50 ms for typical URL lengths). The single 1.5 s retry on 404 may extend this to ~3 s in the rare KV-replication-lag case.
- **NFR-PERF-03:** The frontend bundle (initial load) must be ≤ 200 KB gzipped. VoidHop has minimal JS requirements; this is comfortably achievable.
- **NFR-PERF-04:** The Worker response time (excluding KV latency) must be < 5 ms CPU time to stay within the 10 ms CPU limit. The blob fast pre-check (§11.1) is the longest CPU-bound step; benchmarks must confirm it stays under 5 ms for 256 KB inputs.

### 16.2 Reliability

- **NFR-REL-01:** No single component should cause permanent data loss. KV data is managed by Cloudflare with their own replication guarantees.
- **NFR-REL-02:** TTL expiry is Cloudflare KV's responsibility. The application must not attempt to implement its own TTL check or pre-fetch existence.
- **NFR-REL-03:** All errors must be surfaced to the user with a clear, actionable message. Silent failures are not acceptable.

### 16.3 Accessibility

- **NFR-A11Y-01:** All interactive elements must be keyboard-navigable.
- **NFR-A11Y-02:** All images and icons must have appropriate `alt` attributes or `aria-label`.
- **NFR-A11Y-03:** Color contrast must meet WCAG 2.1 AA in both light and dark themes.
- **NFR-A11Y-04:** Error messages must be associated with their relevant form elements via `aria-describedby`.
- **NFR-A11Y-05:** Loading states must be announced to screen readers via `aria-live` regions.

### 16.4 Browser Support

Target: last 2 major versions of Chrome, Firefox, Safari, and Edge. Minimum requirement: Web Crypto API (`SubtleCrypto`) availability. This rules out IE11 (explicitly unsupported).

Web Crypto API availability: Chrome 37+, Firefox 34+, Safari 11+, Edge 12+. All target browsers covered.

In-app browsers (Instagram, TikTok, etc.) are best-effort: they generally support Web Crypto but may strip URL fragments. The targeted error message in FR-REDIRECT-02 directs users to the system browser when this happens.

### 16.5 Internationalization

v1.0: English only. String literals extracted to `src/constants/strings.ts` to facilitate future i18n. No i18n framework in v1.0.

### 16.6 Privacy of the Privacy Page

The `/about` page must not include any third-party embeds, fonts from external CDNs, or resources that would cause external requests. All fonts are self-hosted or system fonts. No Google Fonts, no Font Awesome CDN.

---

## 17. Testing & Verification Plan

### 17.1 Unit Tests (Vitest)

**Crypto:**

`tests/unit/crypto/roundtrip.test.ts`
- Encrypt then decrypt a 1-char URL — assert equality
- Encrypt then decrypt a 7,300-char URL (typical Notefade) — assert equality
- Encrypt then decrypt a 200,000-char URL — assert equality
- Decrypt with wrong key — assert `DecryptionError` thrown
- Decrypt with truncated blob — assert `DecryptionError` thrown
- Decrypt with modified ciphertext byte — assert `DecryptionError` thrown (GCM tag integrity)
- Encrypt same URL twice — assert ciphertexts differ (random IV)
- Assert blob length equals one of the 5 bucket sizes + 12 (IV) + 16 (GCM tag)
- Assert that a plaintext ending in bytes that would have collided with the v1.0 `0x01` delimiter scheme round-trips correctly under the length-prefix scheme

`tests/unit/crypto/padding.test.ts`
- `pickBucket` returns 1024 for plaintext 0..1020, 10240 for 1021..10236, 51200 for 10237..51196, 102400 for 51197..102396, 262144 for 102397..262140.
- `padBytesLengthPrefix(empty, 1024)` produces a 1024-byte buffer whose first 4 bytes are `00 00 00 00` and the remainder is zero.
- `padBytesLengthPrefix(plaintext, bucket)` produces a buffer of exactly `bucket` bytes whose first 4 bytes are the big-endian uint32 of `plaintext.length`, followed by the plaintext, followed by zero fill.
- `padBytesLengthPrefix` throws `UrlTooLongError` when `4 + plaintext.length > bucket`.
- `unpadBytesLengthPrefix(padBytesLengthPrefix(x, bucket))` returns exactly `x` for x in {0, 1, 1020, 1021, 10236, 100000} bytes.
- `unpadBytesLengthPrefix` throws `PaddingError` when the encoded length exceeds `input.length - 4`.
- `unpadBytesLengthPrefix` throws `PaddingError` on a length-3 input (too short for the header).
- A plaintext that ends in `0x01` followed by zero bytes (the v1.0 footgun case) round-trips correctly.

`tests/unit/crypto/encoding.test.ts`
- base64url encode/decode roundtrip for 0, 1, 2, 3, 4, 5, 6 bytes (all padding variants)
- Assert no `+`, `/`, `=` characters in output (URL-safe check)

`tests/unit/crypto/memory-hygiene.test.ts`
- After `decryptBlob` returns, assert that the raw key buffer that was constructed from the hash has been overwritten (sample a few byte positions, assert they no longer match the original key bytes — non-deterministic but high-confidence)

**URL Validation:**

`tests/unit/utils/url-validation.test.ts`
- `http://example.com` → valid, returns URL object
- `https://example.com/path?q=1#fragment` → valid, returns URL object
- `javascript:alert(1)` → invalid (unsafe scheme)
- `data:text/html,<script>` → invalid
- `ftp://files.example.com` → invalid
- `blob:https://...` → invalid
- `//example.com` → invalid (no scheme)
- `example.com` → invalid (no scheme)
- Empty string → invalid
- A private-IP destination like `http://192.168.1.1/admin` → **valid** (no host blocklist, by design — see §3.2)
- Returned `validated.value.href` is the canonical, parser-normalized URL string

**UA Detection:**

`tests/unit/utils/ua-detection.test.ts`
- Each pattern in `IN_APP_BROWSER_UA_PATTERNS` matches a representative real-world UA string
- Generic Chrome/Firefox/Safari UAs do not match
- Empty string does not match

**Worker:**

`tests/unit/worker/id-generator.test.ts`
- Generated IDs are 8 characters
- Generated IDs contain only base64url characters
- 10,000 generated IDs have no duplicates (probabilistic entropy check)
- `generateAndReserveId` calls `store.exists` before returning

`tests/unit/worker/rate-limit.test.ts`
- N requests within limit → all 200
- N+1 request → 429 with `Retry-After`
- Request after window expires → allowed again
- Two distinct IPv6 addresses within the same /64 share a bucket
- Two IPv6 addresses in different /64 prefixes have distinct buckets
- IPv4 addresses are bucketed by full address

`tests/unit/worker/daily-budget.test.ts`
- Global counter at limit → 503 `DAILY_BUDGET_EXHAUSTED`
- Per-origin counter at sub-quota → 503 `ORIGIN_BUDGET_EXHAUSTED` (even when global counter has room)
- Successful POST increments both global and per-origin counters

### 17.2 Integration Tests (Vitest + Miniflare)

`tests/integration/links-api.test.ts`
- `POST /api/v1/links` with valid body → 201 `{ id }`
- `GET /api/v1/links/:id` with returned ID → 200 `{ blob }` (same blob as posted)
- `GET /api/v1/links/:id` with valid but non-existent ID → 404
- `GET /api/v1/links/:id` with malformed ID (e.g., `!!!`) → **404** (not 400 — see §9.2 / SR-INPUT-03)
- `DELETE /api/v1/links/:id` → 204; subsequent GET → 404
- `DELETE` with malformed ID → 404
- `HEAD /api/v1/links/:id` → 200 if exists, 404 if not
- `POST` with `blob` exceeding 256 KB → 400 `BLOB_TOO_LARGE`
- `POST` with `blob` containing invalid base64url chars → 400 `INVALID_BLOB`
- `POST` with invalid `ttl` value → 400 `INVALID_TTL`
- `POST` with `ttl` greater than 604800 (7 days) → 400 `INVALID_TTL`
- `POST` 21st time within 15 minutes from same IP → 429
- `POST` with global daily budget exhausted (mock KV counter at limit) → 503 `DAILY_BUDGET_EXHAUSTED`
- `POST` with per-origin sub-quota exhausted (mock origin counter at limit) → 503 `ORIGIN_BUDGET_EXHAUSTED`
- `GET /api/v1/health` → 200 with all expected fields including per-origin counts
- TTL expiry simulation (Miniflare time travel) → KV returns null → GET returns 404

**Cache header coverage** (`SR-CACHE-01`):
- For each documented status code (200, 201, 204, 400, 404, 429, 500, 503), assert the response carries `Cache-Control: no-store, no-cache`. This includes responses from the `notFound` and `onError` handlers.

### 17.3 E2E Tests (Playwright)

`tests/e2e/create-redirect.spec.ts`

**Happy path:**
1. Open `/`
2. Paste `https://example.com/very/long/path`
3. Select TTL "24 hours"
4. Click "Shorten"
5. Assert short URL displayed and matches `https://voidhop.com/[a-zA-Z0-9_-]{8}#[a-zA-Z0-9_-]{43}`
6. Click copy button — assert clipboard contains short URL
7. Assert QR code rendered
8. Navigate to short URL in new browser context
9. Assert the address bar fragment is cleared (via `replaceState`) before redirect fires
10. Assert redirect fires within 2 seconds
11. Assert final URL is `https://example.com/very/long/path`

**Missing key:**
1. Navigate to `https://voidhop.com/<valid-id>` (no fragment)
2. Assert error message "This link is incomplete…" is visible
3. Assert no network request to API was made

**Missing key with in-app browser UA:**
1. Override `userAgent` to a known in-app browser pattern (e.g., contains "Instagram")
2. Navigate to `https://voidhop.com/<valid-id>` (no fragment)
3. Assert the in-app-browser-specific error is shown (mentions "Open in Safari/Chrome")

**Hash too long:**
1. Navigate to `https://voidhop.com/<valid-id>#<5MB-string>`
2. Assert immediate `MISSING_KEY` error (no decode attempted, page does not freeze)

**Expired link:**
1. Create a link with TTL "1 hour" via API
2. Fast-forward time in test environment
3. Navigate to short URL
4. Assert error message "This link has expired…"

**KV replication lag retry:**
1. Mock the API to return 404 on first GET, 200 on second
2. Navigate to a valid short URL
3. Assert "Confirming link…" appears briefly
4. Assert redirect succeeds after the retry

**Tampered ciphertext:**
1. Create a valid short link
2. Navigate to `/<id>#<wrongKey>`
3. Assert error message about tampered/failed decryption

**Unsafe scheme:**
1. Manually construct a VoidHop link encrypting `javascript:alert(1)`
2. Navigate to it
3. Assert error message about unsafe destination
4. Assert no redirect or script execution occurred

**Large URL (Notefade simulation):**
1. Generate a 7,300-char URL
2. Create a VoidHop short link for it
3. Navigate to short URL
4. Assert redirect fires and final URL equals the 7,300-char URL

**Universal TTL cap enforcement:**
1. Attempt to POST any blob with a TTL value other than 3600, 86400, or 604800 (e.g. 2592000 / 30 days)
2. Assert server returns `400 INVALID_TTL`
3. UI shows the user-friendly "The server rejected the request" message

### 17.4 Manual Security Spot-Checks

- Inspect Cloudflare Worker logs after creating a link: confirm only ID and blob length are visible, no plaintext URL, no key.
- Open DevTools → Network tab during link creation: confirm the `#key` fragment never appears in any request URL, header, or body.
- Open DevTools → Network tab during redirect: confirm `#key` never appears in any request.
- Confirm the address bar fragment is cleared (`replaceState`) at the moment the redirect page mounts.
- Confirm `Referrer-Policy: no-referrer` in response headers via DevTools.
- Confirm `Cache-Control: no-store, no-cache` on **both** successful blob GETs **and** error responses (404, 429).
- Attempt `javascript:alert(1)` as redirect target via manually crafted link: confirm blocked.
- Confirm CSP blocks inline script execution on redirect page.
- Verify the manual fallback link's visible text is the constant "Click here to proceed" (never the URL).

---

## 18. Roadmap

### v1.0 — MVP (Initial Release)

- [x] Domain: voidhop.com
- [ ] Full Create flow with AES-256-GCM encryption + PKCS#7 + tiered buckets
- [ ] Full Redirect flow with client-side decryption, hash scrubbing, in-app browser UA detection
- [ ] 3 TTL options (1 hour / 24 hours / 7 days) with universal 7-day cap
- [ ] Copy to clipboard
- [ ] QR code generation
- [ ] About/Privacy page (with all §3.2 honest limitations spelled out)
- [ ] Light/dark theme
- [ ] Cloudflare Pages + Workers + KV deployment
- [ ] Cloudflare network-edge Basic Rate Limiting rule for `/api/v1/links` (60/min global)
- [ ] Daily write budget enforcement (503 with retry) — global + per-origin sub-quotas
- [ ] Rate limiting (per-IP, per-endpoint, IPv6 /64 bucketing)
- [ ] Single 404 retry on redirect for KV replication lag
- [ ] All security requirements in §13 (SR-FRAG-01..05, SR-INPUT-01..07, SR-KEY-01, SR-CACHE-01)
- [ ] Full test suite (unit + integration + E2E)
- [ ] README with self-hosting guide
- [ ] MIT license

### v1.1 — Notefade Integration

- [ ] VoidHop API client in Notefade
- [ ] "Shorten with VoidHop" toggle in Notefade ShareResult
- [ ] Self-hoster VoidHop host setting in Notefade
- [ ] CORS already includes notefade.com from v1.0
- [ ] Notefade gracefully degrades on `ORIGIN_BUDGET_EXHAUSTED`

### v1.2 — Deletion Tokens (Derived)

The goal is to let the link's recipient (who, by the zero-knowledge property, is the only entity that knows the AES key) delete the link without storing any second secret.

**Token derivation (client-side, both at creation and at deletion time):**

```typescript
async function deriveDeletionToken(rawKeyBytes: Uint8Array): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode("voidhop-deletion-v1")
  );
  return new Uint8Array(sig); // 32 bytes
}
```

The label `"voidhop-deletion-v1"` namespaces the derivation. Future per-link derivations (e.g., audit tokens) use distinct labels under the same key, with a `-v2`, `-v3`, ... suffix on schema migration.

**At creation time:**
1. Client derives `deletionToken = HMAC-SHA-256(rawKey, "voidhop-deletion-v1")`.
2. Client computes `deletionTokenHash = SHA-256(deletionToken)`.
3. Client POSTs `{ blob, ttl, deletionTokenHash }`.
4. Worker stores `deletionTokenHash` in the `LinkRecord` (schema v2).

**At deletion time:**
1. Recipient is on the redirect page after successful decryption.
2. Client derives the same `deletionToken` from the rawKey it already has (before the rawKey is scrubbed — see §4.7; in practice the derivation runs **before** the scrub).
3. UI shows an unobtrusive "Delete this link" button.
4. On click, client issues `DELETE /api/v1/links/:id` with header `Authorization: Bearer <hex(deletionToken)>`.
5. Worker computes `SHA-256(rawTokenFromHeader)` and constant-time compares against the stored `deletionTokenHash`.
6. On match, KV deletes the entry; returns 204. On mismatch, 403.

**Why this preserves zero-knowledge:** The deletion token is a deterministic function of the AES key. The server never sees the AES key. The server sees `SHA-256(token)` at creation (an opaque 32-byte digest) and the raw 32-byte token at delete time (also opaque without the AES key context). The property "ability to read the link ⇒ ability to delete the link" is exactly the privacy invariant we want.

**UI:**
- At creation time: nothing extra to show. The user's existing short URL is now also their deletion credential, transparently.
- At delete time: a small "Delete this link" button appears on the redirect page only **after** successful decryption. Clicking it issues the DELETE in the background and confirms with "Link deleted."

**`LinkRecord` schema migration:**

```typescript
interface LinkRecordV2 {
  blob: string;
  ttl: number;
  createdAt: string;
  deletionTokenHash: string;  // new in v1.2
  version: 2;
}
```

Worker reads tolerate both v1 and v2 records; v1 records simply lack a deletion path until naturally expired.

### v1.3 — Optional One-Time-Read Mode

- [ ] At creation, user can toggle "One-time read" — link expires after first successful decryption
- [ ] Implementation: Worker deletes the KV entry after a successful GET
- [ ] Race condition mitigation: KV atomic `getWithMetadata` + delete in same Worker invocation; if two simultaneous reads race, the second gets 404 (acceptable — TOFU model)
- [ ] UI clearly indicates "This link will expire after first use"

### v1.4 — Custom Short Codes (Vanity URLs)

- [ ] Allow user to specify a custom ID (e.g., `voidhop.com/mycode#key`)
- [ ] Availability check via `HEAD /api/v1/links/:id`
- [ ] Custom IDs: 4–20 characters, `[a-zA-Z0-9_-]` only, blocklist for reserved words (`api`, `about`, `www`, `static`, etc.)
- [ ] Custom IDs do not reduce privacy (server still only stores encrypted blob)
- [ ] Custom IDs flow through the same `generateAndReserveId(store)` path with the user-provided ID as the candidate. The `exists` check from §11.4 is the single source of overwrite protection; there is no special-cased "custom ID" code path that bypasses it.

### v1.5 — Self-Host Docker Image

- [ ] `Dockerfile` for non-Cloudflare self-hosting (Node.js Worker runtime alternative)
- [ ] Adapter for Redis as KV backend
- [ ] Adapter for SQLite (Turso/libSQL) as KV backend
- [ ] `docker-compose.yml` for zero-dependency local deployment

### v2.0 — Multi-Backend Storage

- [ ] Pluggable storage adapters: D1, Upstash Redis, Supabase, DynamoDB
- [ ] Adapter selection via `wrangler.toml` environment variable
- [ ] D1 adapter enables higher write limits (D1 free tier: 100k writes/day vs KV's 1k)

---

## 19. Decisions Log

| Decision | Choice | Rationale | Alternatives Considered |
|---|---|---|---|
| Key in URL fragment | ✅ Yes | Browser spec guarantees fragment never sent to server; same pattern as Notefade; zero server-side secret required | OPAQUE_REDIRECT (server as blind proxy) — requires trust in proxy; not zero-knowledge |
| State management | React hooks only (no Zustand) | State surface is two ephemeral route-local state machines | Zustand — overkill; adds dep for zero benefit |
| Backend framework | Hono | Typed, lightweight, Cloudflare-native, composable middleware | Raw Workers fetch handler — error-prone; no middleware composition |
| Storage | Cloudflare KV | Free tier; native TTL; zero ops; Notefade parity | D1 (SQL, higher write limit, slightly more complex); Upstash (requires account); self-hosted Redis (not zero-cost) |
| Padding scheme | **Length-prefix (4-byte BE header + zero fill, v1.1)** | No delimiter collision (length is fixed-position, not data-implied); supports bucket sizes > 255 bytes (literal PKCS#7 cannot); GCM auth-tag prevents padding-oracle vector; trivial unpadder | v1.0's `0x01` delimiter scheme — silently truncates plaintexts that legitimately end in `0x01`+`0x00`. Literal PKCS#7 — cannot encode padding lengths > 255, so cannot reach the 1 KB minimum bucket. |
| Padding granularity | **Tiered buckets: 1 KB / 10 KB / 50 KB / 100 KB / 256 KB (v1.1)** | Reduces side-channel resolution from 256 bytes to 5 discrete classes; observer cannot distinguish a 5,000-char from a 5,100-char Notefade URL | Uniform 256-byte padding (v1.0) — leaks length to ~256 byte resolution |
| ID entropy | 6 random bytes = 48 bits | Collision-safe at KV-scale; 8 base64url chars fits target URL length | 4 bytes (too short, 32-bit collision risk); 8 bytes (11 base64url chars, slightly longer short URL) |
| ID overwrite protection | **Always exists-check before put (v1.1)** | Closes overwrite vector for v1.4 custom IDs; same code path for random and user-supplied IDs | Trust random IDs alone — works in v1.0 but breaks under v1.4 |
| Daily write budget enforcement | **Best-effort counter + network-edge hard cap (v1.1)** | KV has no atomic increment; trying to make the counter transactional is over-engineering. Cloudflare Basic Rate Limiting at the edge enforces the hard cap before Worker invocation | Distributed lock around the counter — adds latency, KV ops, and complexity for no real gain |
| Per-origin write sub-quotas | **Yes — voidhop.com 100%, notefade.com 60% (v1.1)** | Contains the blast radius of an XSS or supply-chain compromise in any allowlisted partner without breaking the integration | CAPTCHA on high-volume creation — third-party scripts harm privacy; rejected |
| 400 vs 404 on GET/HEAD/DELETE | **Always 404 for invalid format (v1.1)** | Closes enumeration side channel; legitimate clients never send malformed IDs anyway | 400 for format errors (v1.0) — lets attacker map ID validator without consuming a real lookup |
| Cache headers on errors | **Outermost middleware applies to all responses (v1.1)** | Prevents transient 404s (especially during KV replication lag) from being cached by edge | Per-route cache headers (v1.0) — easy to forget on error paths |
| Destination host blocklist | **No (v1.1)** | VoidHop does no server-side fetching; "SSRF" via client redirect is no different from sharing a raw URL. A blocklist would break legit intranet sharing, provide no real protection, and be trivially bypassed | Block private IPs, localhost, metadata endpoints — feedback suggestion (item 7), explicitly rejected |
| Navigation source | **Always `validated.href`, never raw decrypted string (v1.1)** | Defends against historical URL parser / navigator divergence CVEs | Use raw decrypted string — works most of the time, fails catastrophically when it doesn't |
| In-app browser handling | **UA detection + targeted error (v1.1)** | Drastically improves UX for the most common "broken link" complaint without compromising any security property | Generic "incomplete link" error — unhelpful |
| Hash address-bar scrubbing | **`replaceState` immediately on mount (v1.1)** | Defends against browser quirks that inherit fragments into destination navigation | Trust that browsers won't inherit — historical CVEs say otherwise |
| Raw key memory hygiene | **In-place scrub after `importKey` (v1.1)** | Defense-in-depth against XSS scraping the narrow window between hash decode and key import | Rely on `extractable: false` alone — doesn't defend against the import-window scrape |
| Deletion token (v1.2) | **HMAC-SHA-256 derivation from AES key** | Zero extra UX; "ability to read = ability to delete" is exactly the right privacy property | Random token at creation time — user must store two secrets, lose one and link is undeletable |
| Analytics | None | Zero-knowledge principle extends to usage data; no click tracking preserves privacy of link recipients | Encrypted counters (count only, no URL) — deferred as optional v2 feature |
| CORS | Allowlist: voidhop.com + notefade.com | Minimal attack surface; prevents third-party sites from making API calls with user's session context | Wildcard `*` — makes API freely usable as a backend by any origin; creates abuse surface |
| HTTP redirect targets | Warning (no automatic redirect) | HTTP destinations mean the redirect itself is unencrypted; user should consciously accept this | Block HTTP entirely — too restrictive for private/local network use cases |
| CSP `unsafe-inline` for styles | Allowed (styles only) | CSS Modules in production emit inline styles via Vite; not a meaningful security risk for styles | Nonce-based inline styles — possible but adds build complexity |
| TanStack Router | Yes | Type-safe; no code-gen footprint for route params (all typed); good file-based routing | React Router v7 — heavier; less type-safe search params |
| Maximum link TTL | **7 days, universally (v1.1.1)** | Bounds the storage exhaustion window to a 7-day rolling window so the namespace fully self-heals within a week of any abuse stopping. Removes the v1.1.0 size-tier ceiling and the `TTL_EXCEEDS_SIZE_LIMIT` error entirely — the universal cap subsumes them. | Size-tier ceiling (v1.1.0) — added per-tier complexity; 30-day or 1-year option (v1.0) — leaves a saturated namespace stuck for weeks/months after abuse stops |

---

*End of VoidHop SRS v1.1.1*
