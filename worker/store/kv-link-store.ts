/**
 * Cloudflare KV implementation of LinkStore. SRS §11.4.
 *
 * Enforces the no-overwrite contract at the application layer because KV
 * has no native if-not-exists primitive. The race window between `exists`
 * and `put` is acceptable because random 8-character IDs make actual
 * collision astronomically unlikely (see §4.6).
 */

import type { KVNamespace } from "@cloudflare/workers-types";
import { IdCollisionError, type LinkRecord } from "../types";
import type { LinkStore } from "./link-store";

const LINK_KEY_PREFIX = "links:";

export class CloudflareKVLinkStore implements LinkStore {
  constructor(private readonly kv: KVNamespace) {}

  async put(
    id: string,
    record: LinkRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const key = LINK_KEY_PREFIX + id;
    // Existence check — enforces the no-overwrite contract.
    const existing = await this.kv.get(key);
    if (existing !== null) {
      throw new IdCollisionError();
    }
    await this.kv.put(key, JSON.stringify(record), {
      expirationTtl: ttlSeconds,
    });
  }

  async get(id: string): Promise<LinkRecord | null> {
    const raw = await this.kv.get(LINK_KEY_PREFIX + id);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as LinkRecord;
      // Minimal sanity check: must have a string blob and a numeric ttl.
      if (
        typeof parsed.blob !== "string" ||
        typeof parsed.ttl !== "number" ||
        typeof parsed.createdAt !== "string"
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    const key = LINK_KEY_PREFIX + id;
    const existed = (await this.kv.get(key)) !== null;
    if (!existed) return false;
    await this.kv.delete(key);
    return true;
  }

  async exists(id: string): Promise<boolean> {
    return (await this.kv.get(LINK_KEY_PREFIX + id)) !== null;
  }
}
