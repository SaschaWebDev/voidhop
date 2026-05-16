/**
 * Synchronous theme initialization — called from `main.tsx` before React
 * mounts so the very first paint already carries the correct theme class
 * (no flash of the wrong palette on dark-mode systems).
 *
 * Order of precedence:
 *   1. `localStorage["voidhop-theme"]` ("light" | "dark")
 *   2. The `prefers-color-scheme: dark` media query
 *   3. Default (light) — no class added
 *
 * `localStorage` access is wrapped in a try/catch because some sandboxed
 * embeds (iframes with strict CSP, in-app browsers) throw on `getItem`.
 * In that case we silently fall through to the system preference.
 */

const STORAGE_KEY = "voidhop-theme";

export function applyInitialTheme(): void {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    }
  } catch {
    // Ignore — localStorage may be unavailable in some sandboxed contexts.
  }
}
