import { useMemo } from "react";
import { useViewportSize } from "@/hooks/use-viewport-size";
import styles from "@/routes/index.module.css";
import { createLcgRandom } from "./lcg-random";
import { tokens } from "./tokens";

const PARTICLE_COUNT = 120;
const PARTICLE_SEED = 42;

interface Particle {
  readonly angle: number;
  readonly radius: number;
  readonly size: number;
  readonly opacity: number;
}

/**
 * Animated cosmic portal SVG — three counter-rotating dashed ellipses, a
 * pulsing event-horizon core, and a drifting particle cloud. All geometry
 * scales with viewport width via the `scale` factor.
 *
 * Keyframes (`spin1`, `spin2`, `pulse`) live in `index.module.css` and are
 * referenced through the hashed names exposed by the CSS-Modules import.
 */
export function Portal() {
  const size = useViewportSize();
  const cx = size.w / 2;
  const cy = Math.min(size.h / 2 + 40, size.h - 160);
  const scale = Math.min(1, Math.max(0.55, size.w / 1280));

  const particles = useMemo<readonly Particle[]>(() => {
    const rnd = createLcgRandom(PARTICLE_SEED);
    const out: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = rnd() * Math.PI * 2;
      const radius = (280 + rnd() * 320) * scale;
      const sz = 0.6 + rnd() * 2.4;
      out.push({ angle, radius, size: sz, opacity: 0.3 + rnd() * 0.7 });
    }
    return out;
  }, [scale]);

  return (
    <svg
      className={styles.portal}
      width={size.w}
      height={size.h}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="home-portal-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="1" />
          <stop offset="0.5" stopColor="#0a0418" stopOpacity="1" />
          <stop offset="0.75" stopColor={tokens.accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={tokens.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="home-portal-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={tokens.accent2} stopOpacity="0.25" />
          <stop offset="1" stopColor={tokens.accent2} stopOpacity="0" />
        </radialGradient>
        <filter id="home-portal-blur">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={500 * scale}
        fill="url(#home-portal-glow)"
      />

      <g
        className={styles.pA}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `${styles.spin1} 240s linear infinite`,
        }}
        transform={`translate(${cx} ${cy})`}
      >
        {particles.slice(0, 60).map((p, i) => (
          <circle
            key={i}
            cx={Math.cos(p.angle) * p.radius}
            cy={Math.sin(p.angle) * p.radius * 0.6}
            r={p.size}
            fill={i % 3 === 0 ? tokens.accent2 : "#d8ccff"}
            opacity={p.opacity * 0.7}
          />
        ))}
      </g>
      <g
        className={styles.pB}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `${styles.spin2} 180s linear infinite`,
        }}
        transform={`translate(${cx} ${cy})`}
      >
        {particles.slice(60).map((p, i) => (
          <circle
            key={i}
            cx={Math.cos(p.angle) * p.radius * 0.85}
            cy={Math.sin(p.angle) * p.radius * 0.55}
            r={p.size * 0.8}
            fill={i % 4 === 0 ? tokens.accent : "#b8a8ff"}
            opacity={p.opacity * 0.55}
          />
        ))}
      </g>

      <g
        className={styles.ring}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `${styles.spin1} 80s linear infinite`,
        }}
      >
        <ellipse
          cx={cx}
          cy={cy}
          rx={420 * scale}
          ry={210 * scale}
          fill="none"
          stroke={tokens.accent}
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="2 12"
        />
      </g>
      <g
        className={styles.ring}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `${styles.spin2} 120s linear infinite`,
        }}
      >
        <ellipse
          cx={cx}
          cy={cy}
          rx={340 * scale}
          ry={170 * scale}
          fill="none"
          stroke={tokens.accent2}
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      </g>
      <g
        className={styles.ring}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `${styles.spin1} 55s linear infinite`,
        }}
      >
        <ellipse
          cx={cx}
          cy={cy}
          rx={260 * scale}
          ry={130 * scale}
          fill="none"
          stroke={tokens.accent}
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeDasharray="30 8 4 8"
        />
      </g>

      <circle
        className={styles.core}
        cx={cx}
        cy={cy}
        r={150 * scale}
        fill="url(#home-portal-core)"
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `${styles.pulse} 6s ease-in-out infinite`,
        }}
      />
      <circle cx={cx} cy={cy} r={90 * scale} fill="#000" />
      <circle
        cx={cx}
        cy={cy}
        r={90 * scale}
        fill="none"
        stroke={tokens.accent}
        strokeOpacity="0.6"
        strokeWidth="0.5"
      />
      <circle
        cx={cx}
        cy={cy}
        r={92 * scale}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.15"
        strokeWidth="2"
        filter="url(#home-portal-blur)"
      />
    </svg>
  );
}
