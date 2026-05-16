/**
 * Pure linear-congruential generator for decorative backgrounds (Stars,
 * Portal). Reproducible from a seed — useful for stable star/particle
 * positions across renders with the same viewport size.
 *
 * Uses the Numerical Recipes constants. Not cryptographically secure; do
 * NOT use for anything that touches user secrets.
 */
export function createLcgRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 8) / 0xffffff;
  };
}
