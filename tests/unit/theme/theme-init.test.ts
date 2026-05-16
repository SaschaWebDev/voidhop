/**
 * Tests for the synchronous-before-paint theme bootstrap and the
 * client-side `detectInitialTheme` used by `ThemeToggle`. Both consult
 * `localStorage` first and fall back to `prefers-color-scheme`.
 *
 * Test surface: stubbed `localStorage` + `matchMedia` (happy-dom doesn't
 * implement `matchMedia`) so we can vary each input independently.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyInitialTheme } from "@/theme/init";
import { detectInitialTheme } from "@/components/theme-toggle";

type MediaListener = (e: MediaQueryListEvent) => void;
interface FakeMql {
  matches: boolean;
  media: string;
  addEventListener(_t: string, _l: MediaListener): void;
  removeEventListener(_t: string, _l: MediaListener): void;
}
const makeMql = (matches: boolean): FakeMql => ({
  matches,
  media: "(prefers-color-scheme: dark)",
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
});

describe("applyInitialTheme", () => {
  it("adds .dark when localStorage says 'dark'", () => {
    window.localStorage.setItem("voidhop-theme", "dark");
    vi.stubGlobal("matchMedia", () => makeMql(false));
    applyInitialTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes .dark when localStorage says 'light' (even on dark-preferring systems)", () => {
    document.documentElement.classList.add("dark");
    window.localStorage.setItem("voidhop-theme", "light");
    vi.stubGlobal("matchMedia", () => makeMql(true));
    applyInitialTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back to prefers-color-scheme: dark when storage is empty", () => {
    vi.stubGlobal("matchMedia", () => makeMql(true));
    applyInitialTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("defaults to light when storage is empty and system is light", () => {
    vi.stubGlobal("matchMedia", () => makeMql(false));
    applyInitialTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("ignores invalid localStorage values and falls back to system preference", () => {
    window.localStorage.setItem("voidhop-theme", "magenta");
    vi.stubGlobal("matchMedia", () => makeMql(true));
    applyInitialTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("swallows localStorage exceptions without throwing", () => {
    const getItem = vi
      .spyOn(window.localStorage.__proto__ as Storage, "getItem")
      .mockImplementation(() => {
        throw new Error("sandboxed");
      });
    vi.stubGlobal("matchMedia", () => makeMql(false));
    expect(() => applyInitialTheme()).not.toThrow();
    getItem.mockRestore();
  });
});

describe("detectInitialTheme", () => {
  it("returns the stored value when valid", () => {
    window.localStorage.setItem("voidhop-theme", "dark");
    vi.stubGlobal("matchMedia", () => makeMql(false));
    expect(detectInitialTheme()).toBe("dark");

    window.localStorage.setItem("voidhop-theme", "light");
    vi.stubGlobal("matchMedia", () => makeMql(true));
    expect(detectInitialTheme()).toBe("light");
  });

  it("falls back to system 'dark' preference when storage is empty", () => {
    vi.stubGlobal("matchMedia", () => makeMql(true));
    expect(detectInitialTheme()).toBe("dark");
  });

  it("defaults to 'light' when both storage and system are unset/light", () => {
    vi.stubGlobal("matchMedia", () => makeMql(false));
    expect(detectInitialTheme()).toBe("light");
  });

  it("ignores junk localStorage values and uses system preference", () => {
    window.localStorage.setItem("voidhop-theme", "midnight");
    vi.stubGlobal("matchMedia", () => makeMql(true));
    expect(detectInitialTheme()).toBe("dark");
  });
});
