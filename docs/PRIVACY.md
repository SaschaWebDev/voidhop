# VoidHop privacy notes

This is a deliberately short document. The detailed threat model is in [`voidhop-SRS-v2.md`](./voidhop-SRS-v2.md) §3. The plain-language version is on the `/about` page of any running VoidHop instance.

## What we don't collect

- **The destination URL** — never. The URL is encrypted in your browser using a key your browser generated locally; we receive only the encrypted bytes.
- **The decryption key** — never. The key lives in the URL fragment (`#...`), which the HTTP specification forbids browsers from sending to any server.
- **Click counts** — none. We do not store, increment, or report any per-link counter.
- **Referrers** — `Referrer-Policy: no-referrer` on every response.
- **Analytics** — no Google Analytics, no Plausible, no Fathom, no Cloudflare Analytics. Nothing.
- **IP addresses** — Cloudflare's edge logs them transiently per its own platform policies; VoidHop's application code does not store them.

## What we do collect

- **Encrypted blobs** with a configurable TTL (1 hour, 24 hours, or 7 days — 7 days is the maximum). The blob is opaque to us — we cannot decrypt it.
- **A daily count of writes** (per UTC day) and a per-origin count of writes — both as integers, with no per-link metadata. These are used to enforce the daily budget and the per-origin sub-quotas.

## What we cannot protect against

These are honest limitations, not omissions. The full list is in SRS §3.2.

- **Compromised devices** — if your browser, OS, or hardware is compromised, the plaintext URL is readable before encryption (sender) or after decryption (recipient).
- **Browser extensions** — extensions with permission to read your tab's URL can read the decryption key, because the key lives inside the URL. Use a private/incognito window for high-sensitivity links.
- **Insecure sharing channels** — if you share the short URL over a channel that itself can be intercepted, the contents of the link can be read by whoever intercepts it.
- **Destination filtering** — VoidHop redirects to whatever URL the recipient ends up with after decryption (within the `http`/`https` schemes). It does not blocklist private IPs, `localhost`, or any other host. See SRS §3.2 / item 7 for the full reasoning — short version: VoidHop does no server-side fetching, so a "blocklist" would buy nothing real and would break legitimate intranet/dev/home-lab sharing.
- **In-app browsers** — Instagram, TikTok, Facebook Messenger, and similar in-app browsers sometimes strip URL fragments. Recipients in those apps may need to open links in their system browser instead.

## Open questions you might have

**Q: Could the operator add server-side logging without telling anyone?**
A: Yes, in principle. The defense is the open-source codebase: anyone can audit what's deployed. For maximum trust, self-host (see [`SELF-HOSTING.md`](./SELF-HOSTING.md)).

**Q: What if I lose my short URL?**
A: It's gone. The server cannot recover the destination URL because it never had it. There is no "forgot password" flow because there is no account, no email, and nothing to remember.

**Q: Can VoidHop be subpoenaed?**
A: Yes, like any service. The legal response is the same as the technical response: the server has only opaque ciphertext blobs and the integers from the daily counter. There is nothing to produce in response to "give us the destination URL for ID `aBcD1234`" because that data does not exist on the server.
