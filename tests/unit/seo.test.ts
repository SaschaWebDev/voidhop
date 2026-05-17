/**
 * SEO + PWA surface tests.
 *
 * Part 1 parses the static `index.html` and asserts the head metadata that
 * crawlers and social scrapers will see *without* executing JavaScript:
 * OG/Twitter/canonical/manifest, plus a sanity check that the build-time
 * default does not ship `noindex`.
 *
 * Part 2 mounts the per-route hook so we cover the runtime path that overrides
 * the static defaults — and the static index.html restoration path on unmount.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentHead } from "@/hooks/use-document-head";

const INDEX_HTML = readFileSync(
  resolve(process.cwd(), "index.html"),
  "utf8",
);

describe("index.html SEO defaults", () => {
  it("does not noindex the marketing surface by default", () => {
    // The redirect/unlock and delete routes set noindex at runtime via the
    // hook; the static default must be indexable so `/` and `/about` are
    // crawlable on first byte without waiting for JS.
    expect(INDEX_HTML).not.toMatch(/name="robots"[^>]*noindex/);
  });

  it("declares a canonical URL", () => {
    expect(INDEX_HTML).toMatch(
      /<link\s+rel="canonical"\s+href="https:\/\/voidhop\.com\/"/,
    );
  });

  it("links the web manifest and apple-touch-icon", () => {
    expect(INDEX_HTML).toMatch(/rel="manifest"\s+href="\/manifest\.webmanifest"/);
    expect(INDEX_HTML).toMatch(
      /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/,
    );
  });

  it("declares Open Graph image, title, and description", () => {
    expect(INDEX_HTML).toMatch(/property="og:title"/);
    expect(INDEX_HTML).toMatch(/property="og:description"/);
    expect(INDEX_HTML).toMatch(
      /property="og:image"\s+content="https:\/\/voidhop\.com\/og-image\.jpg"/,
    );
  });

  it("declares the Twitter summary_large_image card", () => {
    expect(INDEX_HTML).toMatch(/name="twitter:card"\s+content="summary_large_image"/);
    expect(INDEX_HTML).toMatch(/name="twitter:image"/);
  });

  it("ships JSON-LD structured data", () => {
    expect(INDEX_HTML).toMatch(/type="application\/ld\+json"/);
    expect(INDEX_HTML).toMatch(/"@type":"SoftwareApplication"/);
  });

  it("sets a theme-color matching the dark slate background", () => {
    expect(INDEX_HTML).toMatch(/name="theme-color"\s+content="#0f172a"/);
  });
});

describe("useDocumentHead", () => {
  // happy-dom shares one document across tests in a file. Reset the head and
  // title before each case so we don't pick up leftovers from earlier mounts.
  beforeEach(() => {
    document.title = "";
    document.head
      .querySelectorAll(
        'meta[name="description"], meta[name="robots"], link[rel="canonical"]',
      )
      .forEach((el) => el.remove());
  });

  it("updates document.title and meta description on mount", () => {
    const { unmount } = renderHook(() =>
      useDocumentHead({
        title: "Test Title",
        description: "Test description body.",
        canonical: "https://voidhop.com/test",
      }),
    );

    expect(document.title).toBe("Test Title");
    const desc = document.head.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    expect(desc?.content).toBe("Test description body.");
    const canonical = document.head.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    expect(canonical?.href).toBe("https://voidhop.com/test");

    unmount();
  });

  it("sets robots noindex when requested (privacy routes)", () => {
    const { unmount } = renderHook(() =>
      useDocumentHead({
        title: "Opening link — VoidHop",
        robots: "noindex,nofollow",
      }),
    );

    const robots = document.head.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    expect(robots?.content).toBe("noindex,nofollow");

    unmount();
  });

  it("restores previous title and description on unmount", () => {
    document.title = "Previous Title";
    const desc = document.createElement("meta");
    desc.setAttribute("name", "description");
    desc.setAttribute("content", "Previous description.");
    document.head.appendChild(desc);

    const { unmount } = renderHook(() =>
      useDocumentHead({
        title: "Route Title",
        description: "Route description.",
      }),
    );
    expect(document.title).toBe("Route Title");

    unmount();
    expect(document.title).toBe("Previous Title");
    const after = document.head.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    expect(after?.content).toBe("Previous description.");
  });

  it("removes the robots tag on unmount when it was injected fresh", () => {
    document.head
      .querySelectorAll('meta[name="robots"]')
      .forEach((el) => el.remove());

    const { unmount } = renderHook(() =>
      useDocumentHead({
        title: "Private route",
        robots: "noindex,nofollow",
      }),
    );
    expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull();

    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
