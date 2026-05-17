/**
 * Shared in-memory KV stub for worker handler tests. Wraps a Map<string,
 * string> with `vi.fn()`-backed get/put/delete/list spies so individual
 * tests can override the behaviour (e.g. force a KV.put to reject) or
 * assert that a specific key was touched.
 *
 * Used by `handle-create-link.test.ts` and `link-handlers.test.ts`,
 * both of which had identical hand-rolled copies before extraction.
 */

import { vi } from "vitest";

export class FakeKV {
  readonly store = new Map<string, string>();
  readonly get = vi.fn(async (key: string) => this.store.get(key) ?? null);
  put = vi.fn(async (key: string, value: string) => {
    this.store.set(key, value);
  });
  readonly delete = vi.fn(async (key: string) => {
    this.store.delete(key);
  });
  readonly list = vi.fn(async () => ({
    keys: [],
    list_complete: true,
    cursor: "",
  }));
}
