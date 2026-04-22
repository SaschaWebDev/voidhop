/**
 * LinkStore interface. SRS §11.4.
 *
 * Implementations MUST enforce the no-overwrite contract on `put`.
 */

import type { LinkRecord } from "../types";

export interface LinkStore {
  /**
   * Persist a link record. Implementations MUST check `exists(id)` immediately
   * before writing and throw `IdCollisionError` if a record already exists.
   * The caller is expected to retry with a new ID.
   */
  put(id: string, record: LinkRecord, ttlSeconds: number): Promise<void>;

  /**
   * Overwrite an existing record in place. Unlike `put`, does not enforce the
   * no-overwrite contract — used for counter updates on password-protected
   * links (v2). Callers must have already verified the record exists.
   */
  update(id: string, record: LinkRecord, ttlSeconds: number): Promise<void>;

  /** Retrieve a link record, or `null` if missing or expired. */
  get(id: string): Promise<LinkRecord | null>;

  /** Delete a link. Returns `true` if it existed, `false` if not. */
  delete(id: string): Promise<boolean>;

  /** Lightweight existence check (used by `generateAndReserveId`). */
  exists(id: string): Promise<boolean>;
}
