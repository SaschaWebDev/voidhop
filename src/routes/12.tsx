/**
 * /12 — Void Portal.
 *
 * Ported from the same Claude Design handoff as /11 (direction B).
 * Deep cosmic gradient with a live SVG-only portal: rotating rings,
 * drifting particles, event-horizon disc. Glassy form card overlaid.
 * Wired to the real useShortenForm hook — zero-knowledge crypto path
 * and real TTL/uses options.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { REPO_URL, TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/12")({
  component: Design12,
});

const vd = {
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

function Design12() {
  const f = useShortenForm();
  const hopping = f.isBusy;

  return (
    <>
      <FontLoader />
      <div className="d12-root">
        <Stars />
        <VoidPortal />
        <div className="d12-noise" aria-hidden="true" />

        <header className="d12-header">
          <Link to="/" className="d12-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              aria-hidden="true"
              className="d12-mark"
            >
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke={vd.accent}
                strokeOpacity="0.5"
              />
              <circle cx="14" cy="14" r="5" fill={vd.accent} />
            </svg>
            <span className="d12-wordmark">voidhop</span>
          </Link>
          <nav className="d12-nav">
            <Link to="/about">Manifesto</Link>
            <Link to="/about">How it works</Link>
            <Link to="/designs">Gallery</Link>
          </nav>
        </header>

        <main className="d12-main">
          <section className="d12-pitch">
            <div className="d12-pill">
              <span className="d12-pill-dot" />
              encrypted · client-side · zero-knowledge
            </div>

            <h1 className="d12-h1">
              Toss it <span className="d12-h1-accent">into the void.</span>
            </h1>

            <p className="d12-lede">
              Your URL is encrypted in the browser before it hops. The server
              receives a cipher it will never decode, and forgets it on expiry.
              No logs. No accounts. Nothing watches.
            </p>

            <ul className="d12-stats">
              {[
                ["AES-256", "GCM"],
                ["PBKDF2", "600k rounds"],
                ["0 logs", "forever"],
              ].map(([a, b]) => (
                <li key={a}>
                  <div className="d12-stat-a">{a}</div>
                  <div className="d12-stat-b">{b}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className={`d12-card${hopping ? " hopping" : ""}`}>
            <div className="d12-shimmer" aria-hidden="true" />

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
                <div className="d12-card-title">Shorten a link</div>
                <div className="d12-card-sub">
                  Your URL only known to you and secure.
                </div>

                <VoidField label="destination">
                  <input
                    type="url"
                    className={`d12-input${f.url ? " on" : ""}`}
                    placeholder="https://paste a url…"
                    value={f.url}
                    onChange={(e) => f.onUrlChange(e.target.value)}
                    disabled={hopping}
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus
                    required
                  />
                  {f.inputError && (
                    <div className="d12-err-inline">{f.inputError}</div>
                  )}
                </VoidField>

                <VoidField label="expires in">
                  <div className="d12-ttl">
                    {TTL_OPTIONS.map((o) => (
                      <button
                        key={o.seconds}
                        type="button"
                        className={`d12-ttl-btn${f.ttl === o.seconds ? " on" : ""}`}
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
                    className="d12-select"
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

                <div className="d12-toggles">
                  <VoidCheckbox
                    checked={f.protect}
                    onChange={f.setProtect}
                    disabled={hopping}
                  >
                    Redirect with password
                  </VoidCheckbox>
                  <VoidCheckbox
                    checked={f.includeDeletionToken}
                    onChange={f.setIncludeDeletionToken}
                    disabled={hopping}
                  >
                    Keep a revocation token
                  </VoidCheckbox>
                </div>

                {f.protect && (
                  <div className="d12-pwd">
                    <input
                      type="password"
                      className="d12-input"
                      placeholder="password"
                      value={f.password}
                      onChange={(e) => f.setPassword(e.target.value)}
                      disabled={hopping}
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      className="d12-input"
                      placeholder="confirm"
                      value={f.confirmPassword}
                      onChange={(e) => f.setConfirmPassword(e.target.value)}
                      disabled={hopping}
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {f.passwordError && (
                  <div className="d12-err-inline">{f.passwordError}</div>
                )}

                <button
                  type="submit"
                  className="d12-submit"
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
                  <div className="d12-err-block">{f.errorMessage}</div>
                )}
              </form>
            )}
          </section>
        </main>

        <footer className="d12-footer">
          <div className="d12-footer-row">
            <span>No cookies · no trackers · no accounts</span>
            <span className="d12-footer-sep">◦</span>
            <span>AES-256-GCM · PBKDF2-SHA256</span>
          </div>
          <div className="d12-footer-attrib">
            Made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="d12-footer-link"
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
    <div className="d12-field">
      <div className="d12-field-label">{label}</div>
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
    <label className={`d12-check${disabled ? " disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="d12-check-box">
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
    <div className="d12-result">
      <div className="d12-result-kicker">◦ sealed · past the horizon</div>
      <h2 className="d12-result-title">
        Gone. <em>Here's your key.</em>
      </h2>

      <div className="d12-result-url-row">
        <span className="d12-result-url">{shortUrl}</span>
        <button
          type="button"
          className="d12-result-copy"
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

      <dl className="d12-meta">
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
                ? "self-destruct after one"
                : `${usesLeft} reads remain`}
            </dd>
          </div>
        )}
      </dl>

      {deleteUrl && (
        <div className="d12-revoke">
          <div className="d12-revoke-label">revocation url · save this</div>
          <code>{deleteUrl}</code>
        </div>
      )}

      <div className="d12-result-foot">
        <div className="d12-qr" ref={qrRef} aria-label="QR code" />
        <button type="button" className="d12-reset" onClick={onReset}>
          Seal another
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
    <svg
      className="d12-stars"
      width={size.w}
      height={size.h}
      aria-hidden="true"
    >
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
  // Portal sits slightly below vertical center; clamp so it never leaves
  // the viewport on short screens.
  const cy = Math.min(size.h / 2 + 40, size.h - 160);

  // Scale ring/particle radii with viewport so the portal feels present
  // on both wide monitors and narrow phones.
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
        @keyframes d12-spin1 { to { transform: rotate(360deg); } }
        @keyframes d12-spin2 { to { transform: rotate(-360deg); } }
        @keyframes d12-pulse { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.06); } }
      `}</style>
      <svg
        className="d12-portal"
        width={size.w}
        height={size.h}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="d12-core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#000" stopOpacity="1" />
            <stop offset="0.5" stopColor="#0a0418" stopOpacity="1" />
            <stop offset="0.75" stopColor={vd.accent} stopOpacity="0.35" />
            <stop offset="1" stopColor={vd.accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="d12-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={vd.accent2} stopOpacity="0.25" />
            <stop offset="1" stopColor={vd.accent2} stopOpacity="0" />
          </radialGradient>
          <filter id="d12-blur">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={500 * scale} fill="url(#d12-glow)" />

        <g
          className="d12-p-a"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "d12-spin1 240s linear infinite",
          }}
          transform={`translate(${cx} ${cy})`}
        >
          {particles.slice(0, 60).map((p, i) => (
            <circle
              key={i}
              cx={Math.cos(p.angle) * p.radius}
              cy={Math.sin(p.angle) * p.radius * 0.6}
              r={p.size}
              fill={i % 3 === 0 ? vd.accent2 : "#d8ccff"}
              opacity={p.opacity * 0.7}
            />
          ))}
        </g>
        <g
          className="d12-p-b"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "d12-spin2 180s linear infinite",
          }}
          transform={`translate(${cx} ${cy})`}
        >
          {particles.slice(60).map((p, i) => (
            <circle
              key={i}
              cx={Math.cos(p.angle) * p.radius * 0.85}
              cy={Math.sin(p.angle) * p.radius * 0.55}
              r={p.size * 0.8}
              fill={i % 4 === 0 ? vd.accent : "#b8a8ff"}
              opacity={p.opacity * 0.55}
            />
          ))}
        </g>

        <g
          className="d12-ring"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "d12-spin1 80s linear infinite",
          }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={420 * scale}
            ry={210 * scale}
            fill="none"
            stroke={vd.accent}
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="2 12"
          />
        </g>
        <g
          className="d12-ring"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "d12-spin2 120s linear infinite",
          }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={340 * scale}
            ry={170 * scale}
            fill="none"
            stroke={vd.accent2}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        </g>
        <g
          className="d12-ring"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "d12-spin1 55s linear infinite",
          }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={260 * scale}
            ry={130 * scale}
            fill="none"
            stroke={vd.accent}
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeDasharray="30 8 4 8"
          />
        </g>

        <circle
          className="d12-core"
          cx={cx}
          cy={cy}
          r={150 * scale}
          fill="url(#d12-core)"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "d12-pulse 6s ease-in-out infinite",
          }}
        />
        <circle cx={cx} cy={cy} r={90 * scale} fill="#000" />
        <circle
          cx={cx}
          cy={cy}
          r={90 * scale}
          fill="none"
          stroke={vd.accent}
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
          filter="url(#d12-blur)"
        />
      </svg>
    </>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d12-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d12-root {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at 50% 60%, ${vd.bgMid} 0%, ${vd.bg} 70%);
  color: ${vd.ink};
  font-family: ${vd.sans};
  overflow-x: hidden;
  isolation: isolate;
}
.d12-stars,
.d12-portal {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.d12-stars {
  z-index: 0;
}
.d12-portal {
  z-index: 1;
}
.d12-noise {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}
.d12-root > header,
.d12-root > main,
.d12-root > footer {
  position: relative;
  z-index: 3;
}
.d12-header {
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
.d12-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: ${vd.ink};
  text-decoration: none;
}
.d12-mark {
  flex-shrink: 0;
}
.d12-wordmark {
  font-family: ${vd.display};
  font-size: 22px;
  letter-spacing: -0.02em;
}
.d12-nav {
  display: flex;
  gap: 32px;
  font-size: 13px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.d12-nav a {
  color: ${vd.inkDim};
  text-decoration: none;
  transition: color 0.15s;
}
.d12-nav a:hover {
  color: ${vd.ink};
}
.d12-main {
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
  .d12-main {
    grid-template-columns: 1fr;
    gap: 48px;
    align-items: start;
  }
}
@media (min-width: 721px) and (max-width: 1060px) {
  .d12-header,
  .d12-main,
  .d12-footer {
    padding-left: 32px;
    padding-right: 32px;
  }
}
@media (max-width: 720px) {
  .d12-header,
  .d12-main,
  .d12-footer {
    padding-left: 24px;
    padding-right: 24px;
  }
  .d12-header {
    padding-top: 20px;
    padding-bottom: 16px;
  }
  .d12-main {
    padding-top: 16px;
    padding-bottom: 48px;
    gap: 36px;
  }
}
@media (max-width: 540px) {
  .d12-nav {
    gap: 18px;
    font-size: 12px;
  }
}
@media (max-width: 380px) {
  .d12-nav a:nth-child(2) {
    display: none;
  }
}
.d12-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 99px;
  border: 1px solid ${vd.line};
  background: rgba(180, 160, 255, 0.06);
  font-family: ${vd.mono};
  font-size: 10.5px;
  letter-spacing: 0.2em;
  color: ${vd.inkDim};
  text-transform: uppercase;
  margin-bottom: 28px;
}
.d12-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${vd.accent2};
  box-shadow: 0 0 10px ${vd.accent2};
  animation: d12-pill-pulse 2.4s ease-in-out infinite;
}
@keyframes d12-pill-pulse {
  50% {
    opacity: 0.4;
  }
}
.d12-h1 {
  font-family: ${vd.display};
  font-size: clamp(54px, 9vw, 88px);
  font-weight: 300;
  line-height: 0.96;
  letter-spacing: -0.04em;
  margin: 0 0 26px;
}
.d12-h1-accent {
  font-style: italic;
  background: linear-gradient(120deg, ${vd.accent}, ${vd.accent2});
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.d12-lede {
  font-size: clamp(15px, 1.7vw, 17px);
  line-height: 1.55;
  color: ${vd.inkDim};
  max-width: 460px;
  margin: 0;
  font-weight: 300;
}
.d12-stats {
  margin: 52px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}
@media (max-width: 420px) {
  .d12-stats {
    gap: 24px;
  }
}
.d12-stat-a {
  font-family: ${vd.display};
  font-size: clamp(22px, 3vw, 30px);
  letter-spacing: -0.02em;
  font-weight: 400;
}
.d12-stat-b {
  font-family: ${vd.mono};
  font-size: 10.5px;
  color: ${vd.inkFaint};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-top: 2px;
}
.d12-card {
  background: ${vd.card};
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid ${vd.line};
  border-radius: 16px;
  padding: 36px;
  box-shadow:
    0 40px 100px -30px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  position: relative;
  transition: transform 0.6s cubic-bezier(0.7, -0.2, 0.3, 1.2);
}
.d12-card.hopping {
  transform: scale(0.98);
}
@media (max-width: 720px) {
  .d12-card {
    padding: 28px 22px 26px;
    border-radius: 14px;
  }
}
.d12-shimmer {
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, ${vd.accent2}, transparent);
  opacity: 0.6;
}
.d12-card-title {
  font-family: ${vd.display};
  font-size: 22px;
  font-weight: 400;
  margin-bottom: 4px;
}
.d12-card-sub {
  font-size: 13px;
  color: ${vd.inkFaint};
  margin-bottom: 28px;
}
.d12-field {
  margin-bottom: 18px;
}
.d12-field-label {
  font-family: ${vd.mono};
  font-size: 10px;
  letter-spacing: 0.18em;
  color: ${vd.inkFaint};
  margin-bottom: 8px;
  text-transform: uppercase;
}
.d12-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid ${vd.line};
  border-radius: 10px;
  padding: 14px 16px;
  color: ${vd.ink};
  font-size: 15px;
  font-family: ${vd.mono};
  outline: none;
  transition: all 0.2s;
}
.d12-input::placeholder {
  color: ${vd.inkFaint};
}
.d12-input:focus,
.d12-input.on {
  border-color: ${vd.accent};
  box-shadow: 0 0 0 4px rgba(180, 120, 255, 0.12);
}
.d12-select {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid ${vd.line};
  border-radius: 10px;
  padding: 12px 38px 12px 14px;
  color: ${vd.ink};
  font-size: 13px;
  outline: none;
  font-family: ${vd.sans};
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%23b8a8ff' stroke-width='1.3'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
}
.d12-select:focus {
  border-color: ${vd.accent};
}
.d12-select option {
  background: ${vd.bg};
  color: ${vd.ink};
}
.d12-ttl {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.d12-ttl-btn {
  padding: 10px 0;
  background: rgba(255, 255, 255, 0.03);
  color: ${vd.ink};
  border: 1px solid ${vd.line};
  border-radius: 10px;
  cursor: pointer;
  font-family: ${vd.sans};
  font-size: 13px;
  font-weight: 400;
  transition: all 0.15s;
}
.d12-ttl-btn:hover:not(:disabled) {
  border-color: rgba(180, 160, 255, 0.4);
}
.d12-ttl-btn.on {
  background: linear-gradient(135deg, ${vd.accent}, ${vd.accent2});
  color: #0a0418;
  border: none;
  font-weight: 600;
}
.d12-toggles {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 22px;
}
.d12-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
}
.d12-check.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.d12-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.d12-check-box {
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
.d12-check input:checked + .d12-check-box {
  border-color: ${vd.accent};
  background: ${vd.accent};
}
.d12-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: -4px 0 18px;
}
@media (max-width: 540px) {
  .d12-pwd {
    grid-template-columns: 1fr;
  }
}
.d12-err-inline {
  margin-top: 10px;
  font-family: ${vd.mono};
  font-size: 12px;
  color: #ffb8d9;
}
.d12-submit {
  width: 100%;
  padding: 16px 0;
  background: rgba(255, 255, 255, 0.04);
  color: ${vd.inkFaint};
  border: none;
  border-radius: 12px;
  font-family: ${vd.sans};
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: not-allowed;
  transition: all 0.2s;
}
.d12-submit[data-active="1"]:not(:disabled) {
  background: linear-gradient(135deg, ${vd.accent}, ${vd.accent2});
  color: #0a0418;
  cursor: pointer;
  box-shadow: 0 10px 40px -10px ${vd.accent};
}
.d12-submit[data-active="1"]:not(:disabled):hover {
  filter: brightness(1.08);
}
.d12-submit:disabled {
  cursor: not-allowed;
}
.d12-err-block {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 140, 180, 0.4);
  background: rgba(255, 80, 120, 0.06);
  color: #ffc8dd;
  font-family: ${vd.mono};
  font-size: 12px;
}
.d12-result-kicker {
  font-family: ${vd.mono};
  font-size: 10.5px;
  letter-spacing: 0.2em;
  color: ${vd.accent2};
  text-transform: uppercase;
  margin-bottom: 16px;
}
.d12-result-title {
  font-family: ${vd.display};
  font-size: 32px;
  font-weight: 400;
  letter-spacing: -0.02em;
  margin: 0 0 26px;
  line-height: 1.1;
}
.d12-result-title em {
  font-style: italic;
  color: ${vd.inkDim};
}
.d12-result-url-row {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid ${vd.accent};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.d12-result-url {
  font-family: ${vd.mono};
  font-size: 14px;
  word-break: break-all;
  flex: 1 1 200px;
  min-width: 0;
}
.d12-result-copy {
  background: linear-gradient(135deg, ${vd.accent}, ${vd.accent2});
  color: #0a0418;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.d12-result-copy:hover {
  filter: brightness(1.08);
}
.d12-meta {
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: ${vd.mono};
  font-size: 11.5px;
}
.d12-meta div {
  display: flex;
  gap: 12px;
  align-items: baseline;
}
.d12-meta dt {
  flex: 0 0 90px;
  color: ${vd.accent2};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 10px;
}
.d12-meta dd {
  margin: 0;
  color: ${vd.ink};
}
@media (max-width: 420px) {
  .d12-meta dt {
    flex-basis: 70px;
  }
}
.d12-revoke {
  font-family: ${vd.mono};
  font-size: 11px;
  color: ${vd.inkDim};
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed ${vd.line};
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 22px;
  line-height: 1.6;
}
.d12-revoke-label {
  color: ${vd.inkFaint};
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.d12-revoke code {
  word-break: break-all;
}
.d12-result-foot {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}
.d12-qr {
  padding: 8px;
  background: rgba(180, 160, 255, 0.08);
  border: 1px solid ${vd.line};
  border-radius: 10px;
}
.d12-qr img {
  display: block;
  image-rendering: pixelated;
  filter: brightness(0) saturate(100%) invert(89%) sepia(30%) saturate(2118%)
    hue-rotate(203deg) brightness(104%) contrast(94%);
}
.d12-reset {
  flex: 1;
  min-width: 160px;
  padding: 14px 0;
  background: transparent;
  color: ${vd.ink};
  border: 1px solid ${vd.line};
  border-radius: 12px;
  font-size: 13px;
  cursor: pointer;
  font-family: ${vd.sans};
}
.d12-reset:hover {
  border-color: ${vd.accent};
  color: ${vd.accent2};
}
@media (max-width: 420px) {
  .d12-result-foot {
    flex-direction: column;
    align-items: stretch;
  }
  .d12-qr {
    align-self: center;
  }
}
.d12-footer {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 56px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-family: ${vd.mono};
  font-size: 10px;
  color: ${vd.inkFaint};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-top: 1px solid ${vd.line};
  margin-top: auto;
}
.d12-footer-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.d12-footer-sep {
  color: ${vd.accent};
}
.d12-footer-attrib {
  font-family: ${vd.mono};
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: none;
  color: ${vd.inkFaint};
  text-align: center;
}
.d12-footer-attrib span[aria-label="love"] {
  color: ${vd.accent2};
  letter-spacing: 0;
  margin: 0 1px;
}
.d12-footer-link {
  background: linear-gradient(120deg, ${vd.accent}, ${vd.accent2});
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  text-decoration: none;
  border-bottom: 1px solid ${vd.line};
  padding-bottom: 1px;
  transition: border-color 0.15s;
}
.d12-footer-link:hover {
  border-bottom-color: ${vd.accent2};
}
@media (max-width: 540px) {
  .d12-footer {
    font-size: 9.5px;
    padding: 18px 24px 24px;
    gap: 8px;
  }
  .d12-footer-row {
    gap: 8px;
  }
  .d12-footer-attrib {
    font-size: 9.5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .d12-p-a,
  .d12-p-b,
  .d12-ring,
  .d12-core,
  .d12-pill-dot {
    animation: none !important;
  }
}
`;
