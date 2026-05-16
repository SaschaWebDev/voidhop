import { useEffect, useState } from "react";

export interface ViewportSize {
  readonly w: number;
  readonly h: number;
}

const DEFAULT_SIZE: ViewportSize = { w: 1280, h: 900 };

/**
 * Track the current viewport size and re-render on window resize. SSR-safe:
 * returns a sensible default on the server, then syncs to `window` on mount.
 *
 * Used by the home page's cosmic background components (Stars, Portal),
 * which recompute their decorative geometry on every resize.
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(DEFAULT_SIZE);

  useEffect(() => {
    const sync = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return size;
}
