/**
 * Design tokens for the Void Portal cosmic theme.
 *
 * Currently the source of truth for both the home-page embedded CSS (via
 * `${vp.X}` template-literal interpolation) and the inline-SVG components
 * here (Stars, VoidPortal). Phase B of the refactor will lift the
 * colors/fonts into CSS custom properties on `.vp-root`, leaving this JS
 * object as a smaller surface for the SVG attribute consumers only.
 */
export const vp = {
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

export type VpToken = keyof typeof vp;
