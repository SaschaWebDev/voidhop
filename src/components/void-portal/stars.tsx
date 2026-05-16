import { useMemo } from "react";
import { useViewportSize } from "@/hooks/use-viewport-size";
import { createLcgRandom } from "./lcg-random";

const STAR_COUNT = 160;
const STAR_SEED = 7;

interface Star {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly o: number;
}

/**
 * Decorative background of randomly-placed dots, full-viewport. Position is
 * deterministic from `STAR_SEED` so the field stays visually stable across
 * re-renders at the same viewport size; resizing scatters fresh stars.
 */
export function Stars() {
  const size = useViewportSize();

  const stars = useMemo<readonly Star[]>(() => {
    const rnd = createLcgRandom(STAR_SEED);
    const out: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      out.push({
        x: rnd() * size.w,
        y: rnd() * size.h,
        r: rnd() * 1.2,
        o: rnd() * 0.8,
      });
    }
    return out;
  }, [size.w, size.h]);

  return (
    <svg className="vp-stars" width={size.w} height={size.h} aria-hidden="true">
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}
    </svg>
  );
}
