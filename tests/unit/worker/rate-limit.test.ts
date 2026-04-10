/**
 * Pure-function unit tests for the rate-limit middleware's IP bucketing.
 * Per SRS §11.2 / SR-INPUT-05.
 *
 * The KV-backed counter logic is exercised by the integration tests.
 */

import { describe, expect, it } from "vitest";
import { ipBucket, expandIpv6 } from "../../../worker/middleware/rate-limit";

describe("expandIpv6", () => {
  it("expands a fully written IPv6 address", () => {
    const out = expandIpv6("2001:0db8:0000:0000:0000:ff00:0042:8329");
    expect(out).toEqual([
      "2001",
      "0db8",
      "0000",
      "0000",
      "0000",
      "ff00",
      "0042",
      "8329",
    ]);
  });

  it("expands a `::`-compressed address", () => {
    const out = expandIpv6("2001:db8::1");
    expect(out).toEqual([
      "2001",
      "0db8",
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0001",
    ]);
  });

  it("expands `::1` (loopback)", () => {
    expect(expandIpv6("::1")).toEqual([
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0001",
    ]);
  });

  it("expands `::` (all-zero)", () => {
    expect(expandIpv6("::")).toEqual([
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
      "0000",
    ]);
  });

  it("returns null for non-IPv6 input", () => {
    expect(expandIpv6("192.168.1.1")).toBeNull();
  });
});

describe("ipBucket", () => {
  it("buckets IPv4 by full address", () => {
    expect(ipBucket("203.0.113.5")).toBe("v4:203.0.113.5");
    expect(ipBucket("203.0.113.6")).toBe("v4:203.0.113.6");
  });

  it("buckets IPv6 by /64 prefix", () => {
    // Two distinct /128 addresses inside the same /64
    const a = "2001:db8:cafe:1234::1";
    const b = "2001:db8:cafe:1234::ff:ff";
    expect(ipBucket(a)).toBe(ipBucket(b));
    expect(ipBucket(a)).toBe("v6_64:2001:0db8:cafe:1234");
  });

  it("two IPv6 addresses in different /64 prefixes have distinct buckets", () => {
    expect(ipBucket("2001:db8:cafe:1234::1")).not.toBe(
      ipBucket("2001:db8:cafe:5678::1"),
    );
  });

  it("falls back to a `raw:` prefix on unparseable input", () => {
    expect(ipBucket("not-an-ip")).toBe("raw:not-an-ip");
  });

  it("returns 'unknown' on empty input", () => {
    expect(ipBucket("")).toBe("unknown");
  });
});
