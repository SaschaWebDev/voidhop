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
 * Hono `Variables` stash shared across the budget middleware → handler chain.
 * Written by `dailyBudgetMiddleware`, consumed by the POST /links handler to
 * increment counters after a successful KV write.
 */
export interface Variables {
  budgetGlobalCount?: number;
  budgetOriginCount?: number | null;
  budgetOrigin?: string | null;
}

/** Combined Hono env binding used everywhere the context type is needed. */
export type HonoEnv = { Bindings: Env; Variables: Variables };

/**
 * Schema v1 of the persisted link record — unprotected, open-read.
 *
 * Optional fields are additive and may be present on records written by any
 * worker version that supports them. Readers must tolerate their absence.
 */
export interface LinkRecordV1 {
  blob: string;
  ttl: number;
  createdAt: string;
  version: 1;
  /** Remaining successful retrievals before the record is deleted. Absent = unlimited. */
  usesLeft?: number;
  /** SHA-256 of the 32-byte deletion token, base64url, 43 chars. Absent = no creator-delete. */
  deletionTokenHash?: string;
}

/**
 * Schema v2 — optional password protection. `verifier` is 43-char base64url
 * of an HKDF output derived client-side from the password; the worker just
 * compares submitted verifiers against it in constant time. `attemptsLeft`
 * starts at MAX_PASSWORD_ATTEMPTS (5) and decrements on each miss; at 0
 * the record is deleted. Readers must tolerate both schemas.
 */
export interface LinkRecordV2 {
  blob: string;
  ttl: number;
  createdAt: string;
  version: 2;
  verifier: string;
  attemptsLeft: number;
  /** Remaining successful unlocks before the record is deleted. Absent = unlimited. */
  usesLeft?: number;
  /** SHA-256 of the 32-byte deletion token, base64url, 43 chars. Absent = no creator-delete. */
  deletionTokenHash?: string;
  /** Epoch milliseconds before which the next unlock attempt is rejected with 429. */
  backoffUntil?: number;
}

export type LinkRecord = LinkRecordV1 | LinkRecordV2;

export class IdCollisionError extends Error {
  constructor() {
    super("Could not allocate a free link ID after 3 attempts");
    this.name = "IdCollisionError";
  }
}
