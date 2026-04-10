# Self-hosting VoidHop

VoidHop is designed to deploy to any Cloudflare account with a free-tier plan. There are no API keys to provision, no secrets to manage, and no paid services to subscribe to.

## Prerequisites

- A Cloudflare account
- `wrangler` CLI installed (`npm i -g wrangler`)
- A custom domain on Cloudflare DNS (optional but strongly recommended)

## One-time setup

1. **Clone the repo and install dependencies**
   ```bash
   git clone https://github.com/your/voidhop.git
   cd voidhop
   npm install
   ```

2. **Authenticate Wrangler**
   ```bash
   wrangler login
   ```

3. **Create the KV namespaces**
   ```bash
   wrangler kv:namespace create VOIDHOP_KV
   wrangler kv:namespace create VOIDHOP_KV --preview
   ```
   Wrangler prints the resulting namespace IDs. Paste them into `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "VOIDHOP_KV"
   id = "<id-from-output>"
   preview_id = "<preview-id-from-output>"
   ```

4. **Set the allowed origins**
   In `wrangler.toml`, edit `ALLOWED_ORIGINS` to your own hostnames:
   ```toml
   [vars]
   ALLOWED_ORIGINS = "https://your-voidhop.example,https://your-notefade.example"
   ```
   The CORS allowlist is the only thing that gates which origins may POST to your `/api/v1/links` endpoint.

5. **Configure the network-edge rate-limit rule** (recommended)
   In the Cloudflare dashboard:
   - Security → WAF → Rate limiting rules → Create rule
   - Match: URI Path equals `/api/v1/links` AND Request Method equals `POST`
   - Threshold: 60 requests per minute, by IP
   - Action: Block (or Challenge), 60 seconds
   This rule is the **hard** cap on POST burst rate. Without it, KV's lack of atomic increments allows concurrent bursts to overshoot the daily write budget. See SRS §6.2 / item 1 for details.

## Deploying

```bash
npm run build
npm run deploy
```

The worker is published at `https://voidhop.<your-account>.workers.dev`. To use a custom domain, add a route in `wrangler.toml`:

```toml
[[routes]]
pattern = "your-voidhop.example/*"
zone_name = "example.com"
custom_domain = true
```

## Updating the per-origin sub-quotas

The per-origin sub-quotas live in two places (intentionally — one for the worker, one for the frontend constants table that the about page reads):

- `worker/middleware/daily-budget.ts` — `PER_ORIGIN_BUDGET_FRACTION`
- `worker/routes/health.ts` — `PER_ORIGIN_BUDGET_FRACTION`
- `src/constants/index.ts` — `PER_ORIGIN_BUDGET_FRACTION`

The defaults are:

| Origin | Fraction |
|---|---|
| `https://voidhop.com` | 1.00 |
| `https://notefade.com` | 0.60 |

The 60% sub-quota for the partner origin contains the blast radius of an XSS or supply-chain compromise on that partner — the worst case is that 60% of your daily writes are consumed by an attacker, leaving 40% for your own users. See SRS item 20 for the full reasoning.

## Operational monitoring

The worker exposes a health endpoint at `/api/v1/health`:

```bash
curl https://your-voidhop.example/api/v1/health
```

Response:
```json
{
  "status": "ok",
  "writes_today": 42,
  "writes_remaining": 908,
  "writes_by_origin": {
    "https://voidhop.com": 30,
    "https://your-partner.example": 12
  },
  "writes_remaining_by_origin": {
    "https://voidhop.com": 920,
    "https://your-partner.example": 558
  },
  "reads_today": 1203,
  "server_time_utc": "2026-04-09T14:23:00Z"
}
```

The endpoint is rate-limited to 10 requests/minute/IP and contains no sensitive data.

## Free-tier capacity reference

| Resource | Free-tier limit | VoidHop hard cap | Comment |
|---|---|---|---|
| Worker requests/day | 100,000 | — | Each redirect = 1 worker invocation + 1 KV read |
| KV reads/day | 100,000 | — | Each redirect = 1 read |
| KV writes/day | 1,000 | 950 (configurable) | Hard cap enforced via Cloudflare network rate limiting |
| KV storage | 1 GB | varies (see SRS §6.2) | Bounded by the universal 7-day TTL cap; realistic average usage stays well under the cap, pessimistic max-blob abuse can approach it |

## Troubleshooting

**`ORIGIN_BUDGET_EXHAUSTED` errors from Notefade integration:** the partner origin has consumed its daily sub-quota. Either wait until UTC midnight, or temporarily raise its fraction in the per-origin budget table and redeploy.

**`DAILY_BUDGET_EXHAUSTED` errors from your primary origin:** the global daily write budget is gone. Check `/api/v1/health` for the per-origin breakdown to identify the cause. If your traffic is legitimately growing, consider migrating to D1 (100k writes/day on the free tier) — the v2.0 roadmap covers this migration.

**Links return 404 immediately after creation:** this is KV eventual-consistency lag. The redirect page already retries once after 1.5 seconds (SRS item 5). If you see this consistently, check that the global rate-limit rule isn't accidentally rejecting `GET` requests.
