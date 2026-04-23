import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/designs")({
  component: Designs,
});

interface Variant {
  n: number;
  name: string;
  pitch: string;
  tags: string[];
  preview: string;
}

const VARIANTS: Variant[] = [
  {
    n: 1,
    name: "Matrix Terminal",
    pitch:
      "CRT phosphor green, katakana rain, typewriter reveal. The most literal white-rabbit homage.",
    tags: ["terminal", "green", "rain", "scanlines"],
    preview: "bg-matrix",
  },
  {
    n: 2,
    name: "Event Horizon",
    pitch:
      "A spiraling particle portal with the URL input at the eye. Text gets pulled in, the short URL emerges.",
    tags: ["cosmos", "ultra-violet", "portal", "fraunces"],
    preview: "bg-horizon",
  },
  {
    n: 3,
    name: "Wonderland Gothic",
    pitch:
      "A dark fairytale compendium. Ornate frames, drop caps, a tarot-card-shaped sealed-envelope result.",
    tags: ["gothic", "cream", "oxblood", "cormorant"],
    preview: "bg-gothic",
  },
  {
    n: 4,
    name: "Samizdat Zine",
    pitch:
      "Xeroxed underground zine aesthetic. Cut-and-paste stickers, rubber-stamp CONFIDENTIAL, marker yellow.",
    tags: ["zine", "newsprint", "collage", "stamp"],
    preview: "bg-zine",
  },
  {
    n: 5,
    name: "Hermetic Cipher",
    pitch:
      "Alchemical manuscript with rotating sigil, wax-seal result, parchment and gold leaf.",
    tags: ["occult", "parchment", "wax seal", "cinzel"],
    preview: "bg-hermetic",
  },
  {
    n: 6,
    name: "Neural Lattice",
    pitch:
      "Cyberpunk HUD with wireframe mesh, pipeline nodes that light up during encryption, glitch text.",
    tags: ["hud", "neon", "cyan", "pink"],
    preview: "bg-lattice",
  },
  {
    n: 7,
    name: "Null Void",
    pitch:
      "Radical restraint. Off-white paper, hairline rules, a single vermillion accent used exactly twice.",
    tags: ["zen", "minimal", "hairlines", "ink"],
    preview: "bg-null",
  },
  {
    n: 8,
    name: "Rabbit Hole",
    pitch:
      "A vertical scroll as descent — dusk → midnight → void. Narrative copy between each stage.",
    tags: ["scroll", "parallax", "dusk", "playfair"],
    preview: "bg-hole",
  },
  {
    n: 9,
    name: "CLI Shell",
    pitch:
      "Keyboard-first simulated shell. Type 'hop <url>', the shell prompts you through the rest.",
    tags: ["repl", "amber", "keyboard", "plex mono"],
    preview: "bg-cli",
  },
  {
    n: 10,
    name: "Obsidian Monolith",
    pitch:
      "A single floating 3D slab with the form embossed on its face. Electric-blue underglow.",
    tags: ["3d", "monumental", "electric blue", "unbounded"],
    preview: "bg-monolith",
  },
  {
    n: 11,
    name: "Modern Matrix",
    pitch:
      "Handoff from Claude Design — refreshed phosphor-green take. Split hero, blurred glyph rain, cornered glass card.",
    tags: ["matrix", "phosphor", "inter tight", "handoff"],
    preview: "bg-modern-matrix",
  },
  {
    n: 12,
    name: "Void Portal",
    pitch:
      "Handoff direction B — animated SVG singularity with rotating rings, drifting particles, glassy card, gradient-text display serif.",
    tags: ["cosmic", "violet", "fraunces", "handoff"],
    preview: "bg-void-portal",
  },
];

function Designs() {
  useEffect(() => {
    const id = "designs-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap";
    document.head.appendChild(l);
  }, []);

  return (
    <>
      <div className="dg-root">
        <header className="dg-header">
          <Link to="/" className="dg-brand">
            voidhop
          </Link>
          <span className="dg-mono">/designs</span>
        </header>

        <section className="dg-hero">
          <p className="dg-kicker">ten takes · one shortener</p>
          <h1 className="dg-h1">
            Follow the <em>white rabbit</em>,
            <br />
            ten different ways.
          </h1>
          <p className="dg-lede">
            Each route below is the same zero-knowledge URL shortener — encrypt
            in the browser, keep nothing on the server — wearing a completely
            different face. Pick one, shorten a link, watch the variant's
            signature moment.
          </p>
        </section>

        <section className="dg-grid">
          {VARIANTS.map((v) => (
            <Link
              key={v.n}
              to={`/${v.n}` as "/1"}
              className="dg-card"
            >
              <div className={`dg-thumb dg-${v.preview}`} aria-hidden="true">
                <span className="dg-num">
                  {String(v.n).padStart(2, "0")}
                </span>
              </div>
              <div className="dg-card-body">
                <h2 className="dg-card-title">{v.name}</h2>
                <p className="dg-card-pitch">{v.pitch}</p>
                <div className="dg-card-tags">
                  {v.tags.map((t) => (
                    <span key={t} className="dg-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="dg-card-arrow" aria-hidden="true">
                /{v.n} →
              </div>
            </Link>
          ))}
        </section>

        <footer className="dg-footer">
          <Link to="/" className="dg-footer-link">
            ← back to the original
          </Link>
          <span className="dg-footer-meta">
            privacy is a posture, not a poster
          </span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

const css = `
.dg-root {
  min-height: 100vh;
  background: #0b0b0e;
  color: #f0ecdf;
  font-family: "Instrument Serif", Georgia, serif;
  padding: 0 0 80px;
}
.dg-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 28px 48px;
  border-bottom: 1px solid rgba(240, 236, 223, 0.12);
}
.dg-brand {
  font-family: "Instrument Serif", serif;
  font-size: 26px;
  font-style: italic;
  color: #f0ecdf;
  text-decoration: none;
}
.dg-mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(240, 236, 223, 0.55);
}
.dg-hero {
  max-width: 920px;
  margin: 0 auto;
  padding: 80px 48px 64px;
}
.dg-kicker {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(240, 236, 223, 0.5);
  margin: 0 0 22px;
}
.dg-h1 {
  font-family: "Instrument Serif", serif;
  font-size: clamp(54px, 8vw, 100px);
  line-height: 0.98;
  margin: 0 0 28px;
  font-weight: 400;
  letter-spacing: -0.02em;
  color: #f0ecdf;
}
.dg-h1 em {
  font-style: italic;
  color: #f5b75e;
}
.dg-lede {
  max-width: 520px;
  font-size: 19px;
  line-height: 1.55;
  color: rgba(240, 236, 223, 0.75);
  margin: 0;
  font-family: "Instrument Serif", serif;
}
.dg-grid {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 48px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}
@media (max-width: 900px) {
  .dg-grid {
    grid-template-columns: 1fr;
  }
}
.dg-card {
  display: flex;
  flex-direction: column;
  background: rgba(240, 236, 223, 0.03);
  border: 1px solid rgba(240, 236, 223, 0.1);
  text-decoration: none;
  color: #f0ecdf;
  padding: 0;
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}
.dg-card:hover {
  border-color: rgba(240, 236, 223, 0.4);
  background: rgba(240, 236, 223, 0.06);
  transform: translateY(-3px);
}
.dg-card-arrow {
  position: absolute;
  top: 20px;
  right: 24px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.15em;
  color: rgba(240, 236, 223, 0.5);
  background: rgba(11, 11, 14, 0.7);
  padding: 4px 10px;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(240, 236, 223, 0.15);
  z-index: 2;
}
.dg-card:hover .dg-card-arrow {
  color: #f5b75e;
  border-color: rgba(245, 183, 94, 0.6);
}
.dg-thumb {
  position: relative;
  height: 180px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  padding: 20px;
}
.dg-num {
  font-family: "Instrument Serif", serif;
  font-size: 86px;
  font-style: italic;
  line-height: 0.9;
  font-weight: 400;
  letter-spacing: -0.02em;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  position: relative;
  z-index: 2;
}
.dg-card-body {
  padding: 24px 28px 28px;
  flex: 1;
}
.dg-card-title {
  font-family: "Instrument Serif", serif;
  font-style: italic;
  font-weight: 400;
  font-size: 30px;
  margin: 0 0 10px;
  letter-spacing: -0.01em;
  color: #f0ecdf;
}
.dg-card-pitch {
  font-family: "Instrument Serif", serif;
  font-size: 17px;
  line-height: 1.55;
  color: rgba(240, 236, 223, 0.75);
  margin: 0 0 18px;
}
.dg-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dg-tag {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(240, 236, 223, 0.6);
  padding: 3px 9px;
  border: 1px solid rgba(240, 236, 223, 0.2);
  border-radius: 999px;
}
.dg-footer {
  max-width: 1200px;
  margin: 60px auto 0;
  padding: 28px 48px;
  border-top: 1px solid rgba(240, 236, 223, 0.12);
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.15em;
  color: rgba(240, 236, 223, 0.5);
}
.dg-footer-link {
  color: #f0ecdf;
  text-decoration: none;
}
.dg-footer-link:hover {
  color: #f5b75e;
}
.dg-footer-meta {
  font-family: "Instrument Serif", serif;
  font-style: italic;
  color: rgba(240, 236, 223, 0.55);
  letter-spacing: 0;
  font-size: 15px;
  text-transform: none;
}

/* Preview thumbnails — miniature hints of each variant's aesthetic */
.dg-bg-matrix {
  background:
    radial-gradient(ellipse at 50% 60%, rgba(0, 255, 65, 0.2), transparent 60%),
    repeating-linear-gradient(
      180deg,
      rgba(0, 255, 65, 0.06) 0 1px,
      transparent 1px 3px
    ),
    #000;
  color: #00ff41;
}
.dg-bg-matrix::before {
  content: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ 01 VOIDHOP";
  position: absolute;
  inset: 0;
  padding: 10px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: rgba(0, 255, 65, 0.25);
  white-space: pre-wrap;
  line-height: 1.4;
  letter-spacing: 0.1em;
}
.dg-bg-horizon {
  background:
    radial-gradient(circle at 50% 60%, rgba(0, 0, 0, 1) 12%, transparent 13%),
    radial-gradient(circle at 50% 60%, rgba(139, 92, 246, 0.5) 14%, transparent 50%),
    radial-gradient(ellipse at 50% 60%, #2a1a5c, #05041a 80%);
}
.dg-bg-horizon::before {
  content: "";
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from 0deg at 50% 60%,
    rgba(167, 139, 250, 0),
    rgba(167, 139, 250, 0.35),
    rgba(167, 139, 250, 0),
    rgba(167, 139, 250, 0.35),
    rgba(167, 139, 250, 0)
  );
  opacity: 0.5;
}
.dg-bg-gothic {
  background:
    radial-gradient(ellipse at 70% 30%, rgba(169, 132, 53, 0.18), transparent 60%),
    #f1e9d8;
  color: #6b0f1a;
}
.dg-bg-gothic::before {
  content: "❦  III  ❦";
  position: absolute;
  top: 24px;
  left: 24px;
  right: 80px;
  font-family: "Instrument Serif", serif;
  font-style: italic;
  font-size: 24px;
  color: #6b0f1a;
  letter-spacing: 0.3em;
}
.dg-bg-gothic .dg-num {
  color: #6b0f1a;
  text-shadow: 0 2px 6px rgba(43, 27, 23, 0.2);
}
.dg-bg-zine {
  background:
    repeating-linear-gradient(-45deg, #f4d03f 0 10px, #0d0d0d 10px 20px);
  color: #c0392b;
  height: 28px;
}
.dg-bg-zine::after {
  content: "VOIDHOP №04";
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-6deg);
  background: #c0392b;
  color: #fbf6eb;
  font-family: "JetBrains Mono", monospace;
  font-weight: 700;
  letter-spacing: 0.2em;
  padding: 14px 24px;
  border: 3px solid #0d0d0d;
  font-size: 22px;
  box-shadow: 4px 4px 0 #0d0d0d;
}
.dg-bg-zine .dg-num {
  display: none;
}
.dg-bg-hermetic {
  background:
    radial-gradient(circle at 50% 50%, rgba(184, 134, 11, 0.25), transparent 65%),
    #e8dcc0;
  color: #8b0000;
}
.dg-bg-hermetic::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 110px;
  height: 110px;
  border: 1px solid #8b0000;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, transparent 30%, rgba(139, 0, 0, 0.08) 31%, transparent 32%),
    radial-gradient(circle at center, transparent 44%, rgba(139, 0, 0, 0.18) 45%, transparent 46%);
}
.dg-bg-hermetic::after {
  content: "☿ ♃ ♄ ♂ ♀ ☉";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: serif;
  color: #8b0000;
  letter-spacing: 0.5em;
  font-size: 12px;
  opacity: 0.7;
}
.dg-bg-hermetic .dg-num {
  color: #8b0000;
}
.dg-bg-lattice {
  background:
    linear-gradient(180deg, transparent 60%, rgba(0, 255, 255, 0.1)),
    repeating-linear-gradient(
      90deg,
      rgba(0, 255, 255, 0.08) 0 1px,
      transparent 1px 30px
    ),
    repeating-linear-gradient(
      0deg,
      rgba(255, 0, 110, 0.05) 0 1px,
      transparent 1px 30px
    ),
    #070712;
}
.dg-bg-lattice::before {
  content: "◢◣ NODE/06 ◢◣";
  position: absolute;
  top: 18px;
  left: 20px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #00ffff;
  text-shadow: 0 0 10px #00ffff;
}
.dg-bg-lattice .dg-num {
  color: #ff006e;
  text-shadow: 0 0 20px rgba(255, 0, 110, 0.6);
}
.dg-bg-null {
  background: #fafaf7;
  color: #0a0a0a;
}
.dg-bg-null::before {
  content: "07 — voidhop";
  position: absolute;
  top: 24px;
  left: 24px;
  font-family: "Instrument Serif", serif;
  font-size: 18px;
  color: #0a0a0a;
  letter-spacing: -0.01em;
}
.dg-bg-null::after {
  content: "";
  position: absolute;
  bottom: 30px;
  left: 24px;
  width: 60px;
  height: 1px;
  background: #ff3b00;
}
.dg-bg-null .dg-num {
  color: #0a0a0a;
}
.dg-bg-hole {
  background: linear-gradient(
    180deg,
    #f6a96b 0%,
    #6a4b6b 45%,
    #0a0a1f 85%,
    #000 100%
  );
}
.dg-bg-hole::before {
  content: "";
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 50px;
  background: #1a1429;
  clip-path: ellipse(50% 45% at 50% 60%);
}
.dg-bg-hole::after {
  content: "↓";
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(245, 233, 208, 0.6);
  font-size: 22px;
}
.dg-bg-hole .dg-num {
  color: rgba(255, 255, 255, 0.95);
}
.dg-bg-cli {
  background:
    radial-gradient(ellipse at center, #1a1000, #050200 70%, #000);
  color: #ffb000;
}
.dg-bg-cli::before {
  content: "voidhop:~$ hop https://\\A ttl> 7d\\A pw?> •••\\A uses> unlimited\\A ✓ sealed.";
  white-space: pre;
  position: absolute;
  inset: 14px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #ffb000;
  text-shadow: 0 0 6px rgba(255, 176, 0, 0.35);
  line-height: 1.5;
}
.dg-bg-cli .dg-num {
  color: #ffb000;
  text-shadow: 0 0 12px rgba(255, 176, 0, 0.6);
}
.dg-bg-monolith {
  background:
    radial-gradient(ellipse at 50% 100%, rgba(0, 85, 255, 0.3), transparent 60%),
    #030408;
}
.dg-bg-monolith::before {
  content: "";
  position: absolute;
  top: 20px;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%) perspective(400px) rotateY(-8deg);
  width: 70px;
  background: linear-gradient(180deg, #12131a, #050509);
  border: 1px solid rgba(0, 85, 255, 0.4);
  box-shadow:
    0 0 40px rgba(0, 85, 255, 0.4),
    inset 0 1px 0 rgba(230, 234, 255, 0.15);
}
.dg-bg-monolith .dg-num {
  color: #0055ff;
  text-shadow: 0 0 24px rgba(0, 85, 255, 0.7);
}
.dg-bg-modern-matrix {
  background:
    radial-gradient(ellipse at 30% 20%, #0a2014 0%, #020806 65%);
  color: #78dca0;
}
.dg-bg-modern-matrix::before {
  content: "アイウエオカキクケコサシスセソ01XOZVEN$+=";
  position: absolute;
  top: 14px;
  left: 20px;
  right: 70px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: rgba(120, 220, 160, 0.45);
  letter-spacing: 0.05em;
  word-break: break-all;
  line-height: 1.55;
  filter: blur(0.3px);
  opacity: 0.7;
}
.dg-bg-modern-matrix::after {
  content: "// encrypt — hop — forget";
  position: absolute;
  bottom: 18px;
  left: 20px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: #78dca0;
  text-shadow: 0 0 10px rgba(120, 220, 160, 0.5);
}
.dg-bg-modern-matrix .dg-num {
  color: #78dca0;
  text-shadow: 0 0 20px rgba(120, 220, 160, 0.5);
}
.dg-bg-void-portal {
  background:
    radial-gradient(ellipse at 50% 55%, #120a24 0%, #07050f 70%);
}
.dg-bg-void-portal::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 130px;
  height: 70px;
  border: 1px solid rgba(180, 160, 255, 0.45);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow:
    0 0 0 8px rgba(180, 160, 255, 0.06),
    0 0 0 20px rgba(130, 180, 255, 0.04);
}
.dg-bg-void-portal::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: radial-gradient(circle, #000 40%, rgba(180, 120, 255, 0.4) 90%);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 26px rgba(130, 180, 255, 0.5);
}
.dg-bg-void-portal .dg-num {
  color: #b8a8ff;
  text-shadow: 0 0 22px rgba(180, 160, 255, 0.55);
  position: relative;
  z-index: 2;
}
`;
