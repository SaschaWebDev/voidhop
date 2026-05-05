import { describe, expect, it } from "vitest";
import {
  validateInputUrl,
  validateRedirectTarget,
} from "@/utils/url-validation";

describe("validateInputUrl", () => {
  it("accepts http:// and https://", () => {
    expect(validateInputUrl("http://example.com").ok).toBe(true);
    expect(validateInputUrl("https://example.com/path").ok).toBe(true);
  });

  it("rejects empty input", () => {
    const r = validateInputUrl("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("EMPTY");
  });

  it("rejects javascript:, data:, ftp:, file:, blob:", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "ftp://files.example.com",
      "file:///etc/passwd",
      "blob:https://example.com/abc",
    ]) {
      const r = validateInputUrl(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.type).toBe("UNSUPPORTED_SCHEME");
    }
  });

  it("auto-prepends https:// to bare hosts so casual paste input works", () => {
    const r1 = validateInputUrl("example.com");
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.value).toBe("https://example.com");

    const r2 = validateInputUrl("example.com/path?q=v");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value).toBe("https://example.com/path?q=v");

    // host:port style — was previously rejected because new URL("localhost:3000")
    // throws; with auto-prepend it now resolves to https://localhost:3000.
    const r3 = validateInputUrl("localhost:3000");
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.value).toBe("https://localhost:3000");
  });

  it("trims surrounding whitespace before prepending", () => {
    const r = validateInputUrl("  google.com  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("https://google.com");
  });

  it("does not double-prepend when a scheme is already present", () => {
    const r = validateInputUrl("https://example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("https://example.com");
  });

  it("rejects non-hierarchical dangerous schemes up-front (no XSS via auto-prepend)", () => {
    // These have no `://`, so without an explicit guard we'd glue
    // `https://` in front of them — and at least `mailto:foo@bar.com` would
    // then parse cleanly (with the email becoming userinfo + host bar.com).
    // The dangerous-scheme guard rejects them before the prepend can happen.
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "mailto:foo@bar.com",
      "tel:+15551234",
    ]) {
      const r = validateInputUrl(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.type).toBe("UNSUPPORTED_SCHEME");
    }
  });
});

describe("validateRedirectTarget", () => {
  it("returns the parsed URL object on success", () => {
    const r = validateRedirectTarget("https://example.com/some/path");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeInstanceOf(URL);
      expect(r.value.protocol).toBe("https:");
    }
  });

  it("the canonical .href round-trips through the URL constructor", () => {
    const r = validateRedirectTarget("https://example.com/path?q=1#frag");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.href).toBe("https://example.com/path?q=1#frag");
    }
  });

  it("rejects javascript:, data:, vbscript:, ftp:, file:, blob:", () => {
    const bads = [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "vbscript:msgbox(1)",
      "ftp://files.example.com",
      "file:///etc/passwd",
      "blob:https://example.com/x",
    ];
    for (const bad of bads) {
      const r = validateRedirectTarget(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.type).toBe("UNSUPPORTED_SCHEME");
    }
  });

  it("ALLOWS private-IP destinations by design (no host blocklist — see SRS §3.2)", () => {
    expect(validateRedirectTarget("http://192.168.1.1/admin").ok).toBe(true);
    expect(validateRedirectTarget("http://127.0.0.1:8080/").ok).toBe(true);
    expect(
      validateRedirectTarget("http://169.254.169.254/latest/meta-data/").ok,
    ).toBe(true);
    expect(validateRedirectTarget("http://localhost:3000/").ok).toBe(true);
  });
});
