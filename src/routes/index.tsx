/**
 * Home — Void Portal.
 *
 * VoidHop's landing-and-tool page. Originally explored as design /12 in
 * a Claude Design handoff and then promoted here. Deep cosmic gradient
 * with a live SVG-only portal (rotating rings, drifting particles,
 * event-horizon disc), a glassy form card overlaid. Wired straight to
 * the existing useShortenForm hook so the AES-256-GCM client-side
 * crypto path is unchanged from the previous CreatePage.
 *
 * Fonts are self-hosted via @fontsource/* — no cross-origin requests
 * (matches the project's zero-external-deps stance enforced by
 * scripts/check-no-external-deps.mjs).
 */

import "@fontsource/fraunces/300.css";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/300-italic.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { REPO_URL, TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/")({
  component: Home,
});

const vp = {
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
};

function Home() {
  const f = useShortenForm();
  const hopping = f.isBusy;

  return (
    <>
      <div className="vp-root">
        <Stars />
        <VoidPortal />
        <div className="vp-noise" aria-hidden="true" />

        <header className="vp-header">
          <Link to="/" className="vp-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              aria-hidden="true"
              className="vp-mark"
            >
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke={vp.accent}
                strokeOpacity="0.5"
              />
              <circle cx="14" cy="14" r="5" fill={vp.accent} />
            </svg>
            <span className="vp-wordmark">voidhop</span>
          </Link>
          <nav className="vp-nav">
            <Link to="/about">About</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </header>

        <main className="vp-main">
          <section className="vp-pitch">
            <div className="vp-pill">
              <span className="vp-pill-dot" />
              encrypted · client-side · zero-knowledge
            </div>

            <h1 className="vp-h1">
              Toss it <span className="vp-h1-accent">into the void.</span>
            </h1>

            <p className="vp-lede">
              Your URL is encrypted in the browser before it hops. The server
              just receives data it cannot decrypt, and forgets it on expiry. No
              logs. No accounts. Nothing watches.
            </p>

            <ul className="vp-stats">
              {[
                ["AES-256", "GCM"],
                ["PBKDF2", "600k rounds"],
                ["0 logs", "forever"],
              ].map(([a, b]) => (
                <li key={a}>
                  <div className="vp-stat-a">{a}</div>
                  <div className="vp-stat-b">{b}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className={`vp-card${hopping ? " hopping" : ""}`}>
            <div className="vp-shimmer" aria-hidden="true" />

            {f.state === "success" && f.result ? (
              <VoidResult
                shortUrl={f.result.shortUrl}
                expiry={formatExpiry(f.result.expiresAt)}
                passwordProtected={f.result.passwordProtected}
                {...(f.result.usesLeft !== undefined
                  ? { usesLeft: f.result.usesLeft }
                  : {})}
                {...(f.result.deleteUrl !== undefined
                  ? { deleteUrl: f.result.deleteUrl }
                  : {})}
                onReset={f.reset}
              />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
              >
                <div className="vp-card-title">Shorten a link</div>
                <div className="vp-card-sub">
                  Your URL only known to you and secure.
                </div>

                <VoidField label="destination">
                  <input
                    type="text"
                    inputMode="url"
                    className={`vp-input${f.url ? " on" : ""}`}
                    placeholder="https://paste a url…"
                    value={f.url}
                    onChange={(e) => f.onUrlChange(e.target.value)}
                    disabled={hopping}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoFocus
                    required
                  />
                  {f.inputError && (
                    <div className="vp-err-inline">{f.inputError}</div>
                  )}
                </VoidField>

                <VoidField label="expires in">
                  <div className="vp-ttl">
                    {TTL_OPTIONS.map((o) => (
                      <button
                        key={o.seconds}
                        type="button"
                        className={`vp-ttl-btn${f.ttl === o.seconds ? " on" : ""}`}
                        onClick={() => f.setTtl(o.seconds)}
                        disabled={hopping}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </VoidField>

                <VoidField label="usage limit">
                  <select
                    className="vp-select"
                    value={f.usesLeft === undefined ? "" : String(f.usesLeft)}
                    onChange={(e) =>
                      f.setUsesLeft(
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    disabled={hopping}
                  >
                    {USES_LEFT_OPTIONS.map((o) => (
                      <option
                        key={o.value ?? "u"}
                        value={o.value === undefined ? "" : String(o.value)}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                </VoidField>

                <div className="vp-toggles">
                  <VoidCheckbox
                    checked={f.protect}
                    onChange={f.setProtect}
                    disabled={hopping}
                  >
                    Redirect requires password
                  </VoidCheckbox>
                </div>

                {f.protect && (
                  <div className="vp-pwd">
                    <input
                      type="password"
                      className="vp-input"
                      placeholder="password"
                      value={f.password}
                      onChange={(e) => f.setPassword(e.target.value)}
                      disabled={hopping}
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      className="vp-input"
                      placeholder="confirm"
                      value={f.confirmPassword}
                      onChange={(e) => f.setConfirmPassword(e.target.value)}
                      disabled={hopping}
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {f.passwordError && (
                  <div className="vp-err-inline">{f.passwordError}</div>
                )}

                <button
                  type="submit"
                  className="vp-submit"
                  data-active={f.url.trim().length > 0 ? "1" : "0"}
                  disabled={hopping || f.url.trim().length === 0}
                >
                  {f.state === "encrypting"
                    ? "Encrypting locally…"
                    : f.state === "uploading"
                      ? "Hopping…"
                      : "Release into the void →"}
                </button>

                {f.errorMessage && (
                  <div className="vp-err-block">{f.errorMessage}</div>
                )}
              </form>
            )}
          </section>
        </main>

        <footer className="vp-footer">
          <div className="vp-footer-row">
            <span>No cookies · no trackers · no accounts</span>
            <span className="vp-footer-sep">◦</span>
            <span>AES-256-GCM · PBKDF2-SHA256</span>
          </div>
          <div className="vp-footer-attrib">
            Made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="vp-footer-link"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function VoidField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="vp-field">
      <div className="vp-field-label">{label}</div>
      {children}
    </div>
  );
}

function VoidCheckbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`vp-check${disabled ? " disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="vp-check-box">
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M1.5 5 L4 7.5 L8.5 2.5"
              stroke="#0a0418"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{children}</span>
    </label>
  );
}

function VoidResult({
  shortUrl,
  expiry,
  passwordProtected,
  usesLeft,
  deleteUrl,
  onReset,
}: {
  shortUrl: string;
  expiry: string;
  passwordProtected: boolean;
  usesLeft?: number;
  deleteUrl?: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    const qr = qrcode(0, "M");
    qr.addData(shortUrl);
    qr.make();
    qrRef.current.innerHTML = qr.createImgTag(2, 0);
  }, [shortUrl]);

  return (
    <div className="vp-result">
      <div className="vp-result-kicker">
        Shortened · Only you know the destination
      </div>
      <h2 className="vp-result-title">
        Done. <em>Here's your link.</em>
      </h2>

      <div className="vp-result-url-row">
        <span className="vp-result-url">{shortUrl}</span>
        <button
          type="button"
          className="vp-result-copy"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <dl className="vp-meta">
        <div>
          <dt>expires</dt>
          <dd>{expiry}</dd>
        </div>
        {passwordProtected && (
          <div>
            <dt>lock</dt>
            <dd>password required</dd>
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <dt>reads</dt>
            <dd>
              {usesLeft === 1
                ? "self-destruct after first use"
                : `${usesLeft} usages remain`}
            </dd>
          </div>
        )}
      </dl>

      {deleteUrl && (
        <div className="vp-revoke">
          <div className="vp-revoke-label">
            DELETE URL · save this for deletion
          </div>
          <code>{deleteUrl}</code>
        </div>
      )}

      <div className="vp-result-foot">
        <div className="vp-qr" ref={qrRef} aria-label="QR code" />
        <button type="button" className="vp-reset" onClick={onReset}>
          Shorten another link
        </button>
      </div>
    </div>
  );
}

function Stars() {
  const [size, setSize] = useState({ w: 1280, h: 900 });
  useEffect(() => {
    const u = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    u();
    window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);

  const stars = useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; o: number }> = [];
    let s = 7;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s >>> 8) / 0xffffff;
    };
    for (let i = 0; i < 160; i++) {
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

function VoidPortal() {
  const [size, setSize] = useState({ w: 1280, h: 900 });
  useEffect(() => {
    const u = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    u();
    window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);

  const cx = size.w / 2;
  const cy = Math.min(size.h / 2 + 40, size.h - 160);
  const scale = Math.min(1, Math.max(0.55, size.w / 1280));

  const particles = useMemo(() => {
    const out: Array<{
      angle: number;
      radius: number;
      size: number;
      opacity: number;
    }> = [];
    let s = 42;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s >>> 8) / 0xffffff;
    };
    for (let i = 0; i < 120; i++) {
      const angle = rnd() * Math.PI * 2;
      const radius = (280 + rnd() * 320) * scale;
      const sz = 0.6 + rnd() * 2.4;
      out.push({ angle, radius, size: sz, opacity: 0.3 + rnd() * 0.7 });
    }
    return out;
  }, [scale]);

  return (
    <>
      <style>{`
        @keyframes vp-spin1 { to { transform: rotate(360deg); } }
        @keyframes vp-spin2 { to { transform: rotate(-360deg); } }
        @keyframes vp-pulse { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.06); } }
      `}</style>
      <svg
        className="vp-portal"
        width={size.w}
        height={size.h}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="vp-core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#000" stopOpacity="1" />
            <stop offset="0.5" stopColor="#0a0418" stopOpacity="1" />
            <stop offset="0.75" stopColor={vp.accent} stopOpacity="0.35" />
            <stop offset="1" stopColor={vp.accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vp-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={vp.accent2} stopOpacity="0.25" />
            <stop offset="1" stopColor={vp.accent2} stopOpacity="0" />
          </radialGradient>
          <filter id="vp-blur">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={500 * scale} fill="url(#vp-glow)" />

        <g
          className="vp-p-a"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "vp-spin1 240s linear infinite",
          }}
          transform={`translate(${cx} ${cy})`}
        >
          {particles.slice(0, 60).map((p, i) => (
            <circle
              key={i}
              cx={Math.cos(p.angle) * p.radius}
              cy={Math.sin(p.angle) * p.radius * 0.6}
              r={p.size}
              fill={i % 3 === 0 ? vp.accent2 : "#d8ccff"}
              opacity={p.opacity * 0.7}
            />
          ))}
        </g>
        <g
          className="vp-p-b"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "vp-spin2 180s linear infinite",
          }}
          transform={`translate(${cx} ${cy})`}
        >
          {particles.slice(60).map((p, i) => (
            <circle
              key={i}
              cx={Math.cos(p.angle) * p.radius * 0.85}
              cy={Math.sin(p.angle) * p.radius * 0.55}
              r={p.size * 0.8}
              fill={i % 4 === 0 ? vp.accent : "#b8a8ff"}
              opacity={p.opacity * 0.55}
            />
          ))}
        </g>

        <g
          className="vp-ring"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "vp-spin1 80s linear infinite",
          }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={420 * scale}
            ry={210 * scale}
            fill="none"
            stroke={vp.accent}
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="2 12"
          />
        </g>
        <g
          className="vp-ring"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "vp-spin2 120s linear infinite",
          }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={340 * scale}
            ry={170 * scale}
            fill="none"
            stroke={vp.accent2}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        </g>
        <g
          className="vp-ring"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "vp-spin1 55s linear infinite",
          }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={260 * scale}
            ry={130 * scale}
            fill="none"
            stroke={vp.accent}
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeDasharray="30 8 4 8"
          />
        </g>

        <circle
          className="vp-core"
          cx={cx}
          cy={cy}
          r={150 * scale}
          fill="url(#vp-core)"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "vp-pulse 6s ease-in-out infinite",
          }}
        />
        <circle cx={cx} cy={cy} r={90 * scale} fill="#000" />
        <circle
          cx={cx}
          cy={cy}
          r={90 * scale}
          fill="none"
          stroke={vp.accent}
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
          filter="url(#vp-blur)"
        />
      </svg>
    </>
  );
}

const css = `
.vp-root {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at 50% 60%, ${vp.bgMid} 0%, ${vp.bg} 70%);
  color: ${vp.ink};
  font-family: ${vp.sans};
  overflow-x: hidden;
  isolation: isolate;
}
.vp-stars,
.vp-portal {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.vp-stars {
  z-index: 0;
}
.vp-portal {
  z-index: 1;
}
.vp-noise {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}
.vp-root > header,
.vp-root > main,
.vp-root > footer {
  position: relative;
  z-index: 3;
}
.vp-header {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 28px 56px;
  flex-wrap: wrap;
}
.vp-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: ${vp.ink};
  text-decoration: none;
}
.vp-mark {
  flex-shrink: 0;
}
.vp-wordmark {
  font-family: ${vp.display};
  font-size: 22px;
  letter-spacing: -0.02em;
}
.vp-nav {
  display: flex;
  gap: 32px;
  font-size: 13px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.vp-nav a {
  color: ${vp.inkDim};
  text-decoration: none;
  transition: color 0.15s;
}
.vp-nav a:hover {
  color: ${vp.ink};
}
.vp-main {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 40px 56px 64px;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 48px;
  align-items: center;
}
@media (max-width: 1060px) {
  .vp-main {
    grid-template-columns: 1fr;
    gap: 48px;
    align-items: start;
  }
}
@media (min-width: 721px) and (max-width: 1060px) {
  .vp-header,
  .vp-main,
  .vp-footer {
    padding-left: 32px;
    padding-right: 32px;
  }
}
@media (max-width: 720px) {
  .vp-header,
  .vp-main,
  .vp-footer {
    padding-left: 24px;
    padding-right: 24px;
  }
  .vp-header {
    padding-top: 20px;
    padding-bottom: 16px;
  }
  .vp-main {
    padding-top: 16px;
    padding-bottom: 48px;
    gap: 36px;
  }
}
@media (max-width: 540px) {
  .vp-nav {
    gap: 18px;
    font-size: 12px;
  }
}
.vp-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 99px;
  border: 1px solid ${vp.line};
  background: rgba(180, 160, 255, 0.06);
  font-family: ${vp.mono};
  font-size: 10.5px;
  letter-spacing: 0.2em;
  color: ${vp.inkDim};
  text-transform: uppercase;
  margin-bottom: 28px;
}
.vp-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${vp.accent2};
  box-shadow: 0 0 10px ${vp.accent2};
  animation: vp-pill-pulse 2.4s ease-in-out infinite;
}
@keyframes vp-pill-pulse {
  50% {
    opacity: 0.4;
  }
}
.vp-h1 {
  font-family: ${vp.display};
  font-size: clamp(54px, 9vw, 88px);
  font-weight: 300;
  line-height: 0.96;
  letter-spacing: -0.04em;
  margin: 0 0 26px;
}
.vp-h1-accent {
  font-style: italic;
  background: linear-gradient(120deg, ${vp.accent}, ${vp.accent2});
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.vp-lede {
  font-size: clamp(15px, 1.7vw, 17px);
  line-height: 1.55;
  color: ${vp.inkDim};
  max-width: 460px;
  margin: 0;
  font-weight: 300;
}
.vp-stats {
  margin: 52px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}
@media (max-width: 420px) {
  .vp-stats {
    gap: 24px;
  }
}
.vp-stat-a {
  font-family: ${vp.display};
  font-size: clamp(22px, 3vw, 30px);
  letter-spacing: -0.02em;
  font-weight: 400;
}
.vp-stat-b {
  font-family: ${vp.mono};
  font-size: 10.5px;
  color: ${vp.inkFaint};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-top: 2px;
}
.vp-card {
  background: ${vp.card};
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid ${vp.line};
  border-radius: 16px;
  padding: 36px;
  box-shadow:
    0 40px 100px -30px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  position: relative;
  transition: transform 0.6s cubic-bezier(0.7, -0.2, 0.3, 1.2);
}
.vp-card.hopping {
  transform: scale(0.98);
}
@media (max-width: 720px) {
  .vp-card {
    padding: 28px 22px 26px;
    border-radius: 14px;
  }
}
.vp-shimmer {
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, ${vp.accent2}, transparent);
  opacity: 0.6;
}
.vp-card-title {
  font-family: ${vp.display};
  font-size: 22px;
  font-weight: 400;
  margin-bottom: 4px;
}
.vp-card-sub {
  font-size: 13px;
  color: ${vp.inkFaint};
  margin-bottom: 28px;
}
.vp-field {
  margin-bottom: 18px;
}
.vp-field-label {
  font-family: ${vp.mono};
  font-size: 10px;
  letter-spacing: 0.18em;
  color: ${vp.inkFaint};
  margin-bottom: 8px;
  text-transform: uppercase;
}
.vp-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid ${vp.line};
  border-radius: 10px;
  padding: 14px 16px;
  color: ${vp.ink};
  font-size: 15px;
  font-family: ${vp.mono};
  outline: none;
  transition: all 0.2s;
}
.vp-input::placeholder {
  color: ${vp.inkFaint};
}
.vp-input:focus,
.vp-input.on {
  border-color: ${vp.accent};
  box-shadow: 0 0 0 4px rgba(180, 120, 255, 0.12);
}
.vp-select {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid ${vp.line};
  border-radius: 10px;
  padding: 12px 38px 12px 14px;
  color: ${vp.ink};
  font-size: 13px;
  outline: none;
  font-family: ${vp.sans};
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%23b8a8ff' stroke-width='1.3'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
}
.vp-select:focus {
  border-color: ${vp.accent};
}
.vp-select option {
  background: ${vp.bg};
  color: ${vp.ink};
}
.vp-ttl {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.vp-ttl-btn {
  padding: 10px 0;
  background: rgba(255, 255, 255, 0.03);
  color: ${vp.ink};
  border: 1px solid ${vp.line};
  border-radius: 10px;
  cursor: pointer;
  font-family: ${vp.sans};
  font-size: 13px;
  font-weight: 400;
  transition: all 0.15s;
}
.vp-ttl-btn:hover:not(:disabled) {
  border-color: rgba(180, 160, 255, 0.4);
}
.vp-ttl-btn.on {
  background: linear-gradient(135deg, ${vp.accent}, ${vp.accent2});
  color: #0a0418;
  border: none;
  font-weight: 600;
}
.vp-toggles {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 22px;
}
.vp-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
}
.vp-check.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.vp-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.vp-check-box {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.vp-check input:checked + .vp-check-box {
  border-color: ${vp.accent};
  background: ${vp.accent};
}
.vp-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: -4px 0 18px;
}
@media (max-width: 540px) {
  .vp-pwd {
    grid-template-columns: 1fr;
  }
}
.vp-err-inline {
  margin-top: 10px;
  font-family: ${vp.mono};
  font-size: 12px;
  color: #ffb8d9;
}
.vp-submit {
  width: 100%;
  padding: 16px 0;
  background: rgba(255, 255, 255, 0.04);
  color: ${vp.inkFaint};
  border: none;
  border-radius: 12px;
  font-family: ${vp.sans};
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: not-allowed;
  transition: all 0.2s;
}
.vp-submit[data-active="1"]:not(:disabled) {
  background: linear-gradient(135deg, ${vp.accent}, ${vp.accent2});
  color: #0a0418;
  cursor: pointer;
  box-shadow: 0 10px 40px -10px ${vp.accent};
}
.vp-submit[data-active="1"]:not(:disabled):hover {
  filter: brightness(1.08);
}
.vp-submit:disabled {
  cursor: not-allowed;
}
.vp-err-block {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 140, 180, 0.4);
  background: rgba(255, 80, 120, 0.06);
  color: #ffc8dd;
  font-family: ${vp.mono};
  font-size: 12px;
}
.vp-result-kicker {
  font-family: ${vp.mono};
  font-size: 10.5px;
  letter-spacing: 0.2em;
  color: ${vp.accent2};
  text-transform: uppercase;
  margin-bottom: 16px;
}
.vp-result-title {
  font-family: ${vp.display};
  font-size: 32px;
  font-weight: 400;
  letter-spacing: -0.02em;
  margin: 0 0 26px;
  line-height: 1.1;
}
.vp-result-title em {
  font-style: italic;
  color: ${vp.inkDim};
}
.vp-result-url-row {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid ${vp.accent};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.vp-result-url {
  font-family: ${vp.mono};
  font-size: 14px;
  word-break: break-all;
  flex: 1 1 200px;
  min-width: 0;
}
.vp-result-copy {
  background: linear-gradient(135deg, ${vp.accent}, ${vp.accent2});
  color: #0a0418;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.vp-result-copy:hover {
  filter: brightness(1.08);
}
.vp-meta {
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: ${vp.mono};
  font-size: 11.5px;
}
.vp-meta div {
  display: flex;
  gap: 12px;
  align-items: baseline;
}
.vp-meta dt {
  flex: 0 0 90px;
  color: ${vp.accent2};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 10px;
}
.vp-meta dd {
  margin: 0;
  color: ${vp.ink};
}
@media (max-width: 420px) {
  .vp-meta dt {
    flex-basis: 70px;
  }
}
.vp-revoke {
  font-family: ${vp.mono};
  font-size: 11px;
  color: ${vp.inkDim};
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed ${vp.line};
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 22px;
  line-height: 1.6;
}
.vp-revoke-label {
  color: ${vp.inkFaint};
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.vp-revoke code {
  word-break: break-all;
}
.vp-result-foot {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}
.vp-qr {
  padding: 8px;
  background: rgba(180, 160, 255, 0.08);
  border: 1px solid ${vp.line};
  border-radius: 10px;
}
.vp-qr img {
  display: block;
  image-rendering: pixelated;
  filter: brightness(0) saturate(100%) invert(89%) sepia(30%) saturate(2118%)
    hue-rotate(203deg) brightness(104%) contrast(94%);
}
.vp-reset {
  flex: 1;
  min-width: 160px;
  padding: 14px 0;
  background: transparent;
  color: ${vp.ink};
  border: 1px solid ${vp.line};
  border-radius: 12px;
  font-size: 13px;
  cursor: pointer;
  font-family: ${vp.sans};
}
.vp-reset:hover {
  border-color: ${vp.accent};
  color: ${vp.accent2};
}
@media (max-width: 420px) {
  .vp-result-foot {
    flex-direction: column;
    align-items: stretch;
  }
  .vp-qr {
    align-self: center;
  }
}
.vp-footer {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 56px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-family: ${vp.mono};
  font-size: 10px;
  color: ${vp.inkFaint};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-top: 1px solid ${vp.line};
  margin-top: auto;
}
.vp-footer-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.vp-footer-sep {
  color: ${vp.accent};
}
.vp-footer-attrib {
  font-family: ${vp.mono};
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: none;
  color: ${vp.inkFaint};
  text-align: center;
}
.vp-footer-attrib span[aria-label="love"] {
  color: ${vp.accent2};
  letter-spacing: 0;
  margin: 0 1px;
}
.vp-footer-link {
  background: linear-gradient(120deg, ${vp.accent}, ${vp.accent2});
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  text-decoration: none;
  border-bottom: 1px solid ${vp.line};
  padding-bottom: 1px;
  transition: border-color 0.15s;
}
.vp-footer-link:hover {
  border-bottom-color: ${vp.accent2};
}
@media (max-width: 540px) {
  .vp-footer {
    font-size: 9.5px;
    padding: 18px 24px 24px;
    gap: 8px;
  }
  .vp-footer-row {
    gap: 8px;
  }
  .vp-footer-attrib {
    font-size: 9.5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vp-p-a,
  .vp-p-b,
  .vp-ring,
  .vp-core,
  .vp-pill-dot {
    animation: none !important;
  }
}
`;
