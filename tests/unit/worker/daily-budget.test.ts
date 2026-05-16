/**
 * Pure-function tests for the date helpers in the daily-budget middleware.
 *
 * The KV-backed read/write path is exercised by the integration tests; here
 * we just guard the UTC date math which is easy to break by accident.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  secondsUntilUtcMidnight,
  todayKey,
} from "../../../worker/middleware/daily-budget";

describe("todayKey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD in UTC", () => {
    vi.setSystemTime(new Date("2026-05-17T12:34:56.789Z"));
    expect(todayKey()).toBe("2026-05-17");
  });

  it("uses UTC even when the local zone would roll a day", () => {
    // 23:59 UTC ⇒ still that day, never tomorrow.
    vi.setSystemTime(new Date("2026-12-31T23:59:59.999Z"));
    expect(todayKey()).toBe("2026-12-31");
  });

  it("returns the next day immediately after UTC midnight", () => {
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
    expect(todayKey()).toBe("2027-01-01");
  });
});

describe("secondsUntilUtcMidnight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ~24h at the start of UTC day", () => {
    // 1 ms after midnight ⇒ ceil((86_400_000 - 1) / 1000) = 86_400
    vi.setSystemTime(new Date("2026-05-17T00:00:00.001Z"));
    expect(secondsUntilUtcMidnight()).toBe(86_400);
  });

  it("returns ~1s just before UTC midnight", () => {
    vi.setSystemTime(new Date("2026-05-17T23:59:59.500Z"));
    expect(secondsUntilUtcMidnight()).toBe(1);
  });

  it("returns the full 86_400 exactly at midnight", () => {
    vi.setSystemTime(new Date("2026-05-17T00:00:00.000Z"));
    expect(secondsUntilUtcMidnight()).toBe(86_400);
  });

  it("never returns a negative value", () => {
    for (let h = 0; h < 24; h++) {
      vi.setSystemTime(new Date(`2026-05-17T${String(h).padStart(2, "0")}:30:00.000Z`));
      const s = secondsUntilUtcMidnight();
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(86_400);
    }
  });
});
