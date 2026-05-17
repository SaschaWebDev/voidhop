/**
 * Registers /sw.js after `window.load` in production builds only.
 *
 * Dev is excluded: wrangler and Vite already manage caching, and an SW would
 * mask source changes and confuse HMR. Same reason the script tolerates the
 * absence of `serviceWorker` on the navigator: we never want this to throw.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Swallow — registration failure is non-fatal; the app still works.
    });
  });
}
