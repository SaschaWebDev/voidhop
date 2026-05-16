/**
 * Design tokens for the cosmic home theme — JS mirror of the CSS custom
 * properties declared on `.root` in `src/routes/index.module.css`.
 *
 * Used by inline-SVG components (Stars, Portal) and the brand-mark SVG
 * in PageHeader, where attributes like `stroke={tokens.accent}` need the
 * literal value at render time and can't reach into CSS via var().
 *
 * Keep this object in sync with the --home-* declarations in the module
 * file when adjusting palette values.
 */
export const tokens = {
  bg: "#07050f",
  bgMid: "#120a24",
  ink: "#ece8ff",
  inkDim: "rgba(236, 232, 255, 0.6)",
  inkFaint: "rgba(236, 232, 255, 0.3)",
  accent: "oklch(0.72 0.19 290)",
  accent2: "oklch(0.78 0.16 220)",
  line: "rgba(180, 160, 255, 0.18)",
  card: "rgba(20, 14, 40, 0.45)",
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  sans: '"Inter", -apple-system, "Helvetica Neue", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;
