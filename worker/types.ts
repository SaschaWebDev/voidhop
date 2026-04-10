/**
 * Worker types: Env bindings, LinkRecord, errors. SRS §10, §11.4.
 */

import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  /** KV namespace bound from wrangler.toml — see SRS §10.3 */
  VOIDHOP_KV: KVNamespace;
  /** "production" | "development" */
  ENVIRONMENT: string;
  /** Comma-separated list of CORS-allowed origins */
  ALLOWED_ORIGINS: string;
  /** Daily write budget signal (string-encoded; parsed once on cold start) */
  DAILY_WRITE_BUDGET: string;
}

/**
 * Schema v1 of the persisted link record. v1.2 introduces v2 with a
 * `deletionTokenHash` field; readers must tolerate both.
 */
export interface LinkRecordV1 {
  blob: string;
  ttl: number;
  createdAt: string;
  version: 1;
}

export type LinkRecord = LinkRecordV1;

export class IdCollisionError extends Error {
  constructor() {
    super("Could not allocate a free link ID after 3 attempts");
    this.name = "IdCollisionError";
  }
}
