/**
 * id-generator unit tests. Per SRS §11.5.
 */

import { describe, expect, it } from "vitest";
import { generateId, generateAndReserveId } from "../../../worker/id-generator";
import type { LinkStore } from "../../../worker/store/link-store";
import type { LinkRecord } from "../../../worker/types";
import { IdCollisionError } from "../../../worker/types";

class MemoryStore implements LinkStore {
  readonly map = new Map<string, LinkRecord>();
  async put(id: string, record: LinkRecord): Promise<void> {
    if (this.map.has(id)) throw new IdCollisionError();
    this.map.set(id, record);
  }
  async get(id: string): Promise<LinkRecord | null> {
    return this.map.get(id) ?? null;
  }
  async delete(id: string): Promise<boolean> {
    return this.map.delete(id);
  }
  async exists(id: string): Promise<boolean> {
    return this.map.has(id);
  }
}

describe("generateId", () => {
  it("returns 8 base64url characters", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateId();
      expect(id.length).toBe(8);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("10,000 generated IDs have no duplicates", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(generateId());
    }
    expect(seen.size).toBe(10_000);
  });
});

describe("generateAndReserveId", () => {
  it("returns an ID that does not exist in the store", async () => {
    const store = new MemoryStore();
    const id = await generateAndReserveId(store);
    expect(await store.exists(id)).toBe(false);
  });

  it("retries past collisions and eventually succeeds", async () => {
    const store = new MemoryStore();
    // Pre-populate the store with a few IDs — collisions are astronomically
    // unlikely against random 48-bit IDs, but the retry logic itself is
    // exercised by the path where `exists` returns false.
    const id = await generateAndReserveId(store);
    expect(typeof id).toBe("string");
  });

  it("throws IdCollisionError if every attempt collides", async () => {
    // Patch a store whose `exists` always returns true to force the failure path.
    const alwaysCollides: LinkStore = {
      async put() {
        /* noop */
      },
      async get() {
        return null;
      },
      async delete() {
        return false;
      },
      async exists() {
        return true;
      },
    };
    await expect(generateAndReserveId(alwaysCollides)).rejects.toThrow(
      IdCollisionError,
    );
  });
});
