/**
 * /11 — Modern Matrix.
 *
 * Ported from a Claude Design handoff (VoidHop Landing · direction A).
 * The visual language — radial green bg, SVG glyph rain, scanlines,
 * vignette, split hero, cornered glass card, mono accents — is the
 * designer's; the form underneath is wired to the real useShortenForm
 * hook so it actually shortens URLs.
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

export const Route = createFileRoute("/11")({
  component: Design11,
});

const mx = {
  bgDeep: "#020806",
  ink: "#d6f5df",
  inkDim: "rgba(214, 245, 223, 0.55)",
  inkFaint: "rgba(214, 245, 223, 0.25)",
  accent: "oklch(0.78 0.18 150)",
  accentDim: "oklch(0.78 0.18 150 / 0.15)",
  accentText: "oklch(0.92 0.12 150)",
  line: "rgba(120, 220, 160, 0.14)",
  card: "rgba(10, 28, 18, 0.65)",
  sans: '"Inter Tight", -apple-system, "Helvetica Neue", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
};

function Design11() {
  const f = useShortenForm();

  return (
    <>
      <FontLoader />
      <div className="d11-root">
        <GlyphRain />
        <div className="d11-scanlines" aria-hidden="true" />
        <div className="d11-vignette" aria-hidden="true" />

        <header className="d11-header">
          <Link to="/" className="d11-brand">
            <span className="d11-brand-mark">V</span>
            <span className="d11-brand-word">voidhop</span>
            <span className="d11-brand-tag">v0.3 · beta</span>
          </Link>
          <nav className="d11-nav">
            <Link to="/about">how it works</Link>
            <Link to="/about">privacy</Link>
            <Link to="/designs">gallery</Link>
          </nav>
        </header>

        <main className="d11-main">
          <section className="d11-pitch">
            <div className="d11-kicker">
              <span className="d11-kicker-dot" />
              zero-knowledge · client-side
            </div>
            <h1 className="d11-h1">
              Your URL
              <br />
              never leaves
              <br />
              <em>in the clear.</em>
            </h1>
            <p className="d11-lede">
              Encrypted in your browser before it leaves. The server stores
              ciphertext it can't read, hands out a short key, and forgets
              everything on expiry.
            </p>

            <ol className="d11-steps">
              {STEPS.map(([n, t, d]) => (
                <li key={n}>
                  <span className="d11-step-n">{n}</span>
                  <div>
                    <div className="d11-step-t">{t}</div>
                    <div className="d11-step-d">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="d11-card-wrap">
            <div className="d11-card-label">
              // encrypt — hop — forget
            </div>
            <div className="d11-card">
              <CornerTicks />
              {f.state === "success" && f.result ? (
                <MatrixResult
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
                  <MatrixField label="destination url">
                    <input
                      className="d11-url"
                      type="url"
                      placeholder="https://…"
                      value={f.url}
                      onChange={(e) => f.onUrlChange(e.target.value)}
                      disabled={f.isBusy}
                      spellCheck={false}
                      autoComplete="off"
                      autoFocus
                      required
                    />
                    <div className="d11-cipher">
                      <span className="d11-cipher-arrow">→ </span>
                      <span
                        className={
                          f.url ? "d11-cipher-text on" : "d11-cipher-text"
                        }
                      >
                        {f.url.length > 8
                          ? fakeCipher(f.url, 42)
                          : "·".repeat(42)}
                      </span>
                    </div>
                    {f.inputError && (
                      <div className="d11-err-inline">! {f.inputError}</div>
                    )}
                  </MatrixField>

                  <MatrixField label="auto-expire">
                    <div className="d11-ttl">
                      {TTL_OPTIONS.map((o) => (
                        <button
                          key={o.seconds}
                          type="button"
                          className={`d11-ttl-btn ${f.ttl === o.seconds ? "on" : ""}`}
                          onClick={() => f.setTtl(o.seconds)}
                          disabled={f.isBusy}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </MatrixField>

                  <MatrixField label="usage limit">
                    <select
                      className="d11-select"
                      value={
                        f.usesLeft === undefined ? "" : String(f.usesLeft)
                      }
                      onChange={(e) =>
                        f.setUsesLeft(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      disabled={f.isBusy}
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
                  </MatrixField>

                  <div className="d11-toggles">
                    <MatrixCheckbox
                      checked={f.protect}
                      onChange={f.setProtect}
                      disabled={f.isBusy}
                    >
                      + password
                    </MatrixCheckbox>
                    <MatrixCheckbox
                      checked={f.includeDeletionToken}
                      onChange={f.setIncludeDeletionToken}
                      disabled={f.isBusy}
                    >
                      + revoke token
                    </MatrixCheckbox>
                  </div>

                  {f.protect && (
                    <div className="d11-pwd">
                      <input
                        type="password"
                        className="d11-pwd-input"
                        placeholder="password"
                        value={f.password}
                        onChange={(e) => f.setPassword(e.target.value)}
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        className="d11-pwd-input"
                        placeholder="confirm"
                        value={f.confirmPassword}
                        onChange={(e) => f.setConfirmPassword(e.target.value)}
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                    </div>
                  )}
                  {f.passwordError && (
                    <div className="d11-err-inline">! {f.passwordError}</div>
                  )}

                  <button
                    type="submit"
                    className="d11-submit"
                    disabled={f.isBusy || f.url.trim().length === 0}
                    data-active={f.url.trim().length > 0 ? "1" : "0"}
                  >
                    {f.state === "encrypting"
                      ? "encrypting…"
                      : f.state === "uploading"
                        ? "hopping…"
                        : "encrypt → hop"}
                  </button>

                  {f.errorMessage && (
                    <div className="d11-err-block">
                      <div className="d11-err-head">SEGFAULT</div>
                      <div>{f.errorMessage}</div>
                    </div>
                  )}
                </form>
              )}
            </div>
          </section>
        </main>

        <footer className="d11-footer">
          <div className="d11-footer-row">
            <span>// no cookies · no trackers · no accounts</span>
            <span>AES-256-GCM · PBKDF2-SHA256</span>
          </div>
          <div className="d11-footer-attrib">
            made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="d11-footer-link"
            >
              github
            </a>
          </div>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

const STEPS: ReadonlyArray<readonly [string, string, string]> = [
  ["01", "you encrypt", "AES-256-GCM · key stays in your browser"],
  ["02", "server forwards", "opaque ciphertext · 0 destinations logged"],
  ["03", "server forgets", "auto-expiry · no logs · no telemetry"],
];

function MatrixField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="d11-field">
      <div className="d11-field-label">{label}</div>
      {children}
      {hint && <div className="d11-field-hint">{hint}</div>}
    </div>
  );
}

function MatrixCheckbox({
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
    <label className={`d11-check ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="d11-check-box">
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M1.5 5 L4 7.5 L8.5 2.5"
              stroke="#001a0a"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="d11-check-text">{children}</span>
    </label>
  );
}

function CornerTicks() {
  return (
    <>
      <span className="d11-tick d11-tick-tl" aria-hidden="true" />
      <span className="d11-tick d11-tick-tr" aria-hidden="true" />
      <span className="d11-tick d11-tick-bl" aria-hidden="true" />
      <span className="d11-tick d11-tick-br" aria-hidden="true" />
    </>
  );
}

function MatrixResult({
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
    <div className="d11-result">
      <div className="d11-result-kicker">
        <span className="d11-kicker-dot" />
        link sealed · hopped successfully
      </div>
      <div className="d11-result-title">
        Your link hopped into the void.
      </div>
      <div className="d11-result-url-row">
        <span className="d11-result-url">{shortUrl}</span>
        <button
          type="button"
          className="d11-result-copy"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <dl className="d11-result-meta">
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
        <div className="d11-revoke">
          revoke url:
          <br />
          <code>{deleteUrl}</code>
        </div>
      )}

      <div className="d11-result-foot">
        <div className="d11-qr" ref={qrRef} aria-label="QR code" />
        <button type="button" className="d11-reset" onClick={onReset}>
          hop another
        </button>
      </div>
    </div>
  );
}

function GlyphRain() {
  // Size the SVG to viewport once + on resize. We reuse the original
  // design's approach (SVG text columns animated via a shared keyframe)
  // because it already reads as atmosphere and survives backgrounding.
  const [size, setSize] = useState({ w: 1280, h: 820 });
  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cols = Math.floor(size.w / 28);
  const height = size.h;

  const streams = useMemo(() => {
    const chars = "アイウエオカキクケコサシスセソ01XOZVEN$+=";
    const out: Array<{
      x: number;
      speed: number;
      delay: number;
      glyphs: string[];
      opacity: number;
    }> = [];
    for (let i = 0; i < cols; i++) {
      const len = 8 + Math.floor(Math.random() * 14);
      const speed = 18 + Math.random() * 28;
      const delay = -Math.random() * speed;
      const glyphs = Array.from(
        { length: len },
        () => chars[Math.floor(Math.random() * chars.length)] ?? "0",
      );
      out.push({
        x: i * 28 + 8,
        speed,
        delay,
        glyphs,
        opacity: 0.25 + Math.random() * 0.6,
      });
    }
    return out;
  }, [cols]);

  return (
    <>
      <style>{`@keyframes d11-fall { 0% { transform: translateY(-100%); } 100% { transform: translateY(${height}px); } }`}</style>
      <svg
        className="d11-rain"
        width={size.w}
        height={size.h}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="d11-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mx.accent} stopOpacity="0" />
            <stop offset="0.25" stopColor={mx.accent} stopOpacity="0.35" />
            <stop offset="0.85" stopColor={mx.accent} stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
        </defs>
        {streams.map((s, i) => (
          <g
            key={i}
            style={{
              animation: `d11-fall ${s.speed}s linear ${s.delay}s infinite`,
              opacity: s.opacity,
            }}
          >
            {s.glyphs.map((g, j) => (
              <text
                key={j}
                x={s.x}
                y={j * 18}
                fill={j === s.glyphs.length - 1 ? "#e8ffee" : "url(#d11-fade)"}
                fontSize="14"
                fontFamily={mx.mono}
              >
                {g}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </>
  );
}

// Vanity display — shows "this will look encrypted" while the user
// types. Not real encryption; that happens on submit via WebCrypto.
function fakeCipher(s: string, len = 44): string {
  const base =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let seed = 0;
  for (let i = 0; i < s.length; i++) {
    seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
  }
  let out = "";
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out += base[seed % base.length];
  }
  return out;
}

function FontLoader() {
  useEffect(() => {
    const id = "d11-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d11-root {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at 30% 20%, #0a2014 0%, ${mx.bgDeep} 65%);
  color: ${mx.ink};
  font-family: ${mx.sans};
  overflow-x: hidden;
  isolation: isolate;
}
.d11-rain {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  filter: blur(1.2px);
  opacity: 0.55;
}
.d11-scanlines {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.25) 0px,
    rgba(0, 0, 0, 0.25) 1px,
    transparent 1px,
    transparent 3px
  );
  opacity: 0.35;
}
.d11-vignette {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(0, 0, 0, 0.8) 100%
  );
}
.d11-root > header,
.d11-root > main,
.d11-root > footer {
  position: relative;
  z-index: 3;
}
.d11-header {
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
.d11-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: ${mx.ink};
  text-decoration: none;
}
.d11-brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid ${mx.accent};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${mx.mono};
  font-size: 13px;
  color: ${mx.accentText};
  box-shadow: 0 0 16px ${mx.accentDim};
}
.d11-brand-word {
  font-weight: 600;
  letter-spacing: -0.01em;
  font-size: 17px;
}
.d11-brand-tag {
  font-family: ${mx.mono};
  font-size: 10px;
  color: ${mx.inkFaint};
  margin-left: 6px;
}
.d11-nav {
  display: flex;
  gap: 28px;
  font-size: 13px;
  font-family: ${mx.mono};
  flex-wrap: wrap;
  justify-content: flex-end;
}
.d11-nav a {
  color: ${mx.inkDim};
  text-decoration: none;
}
.d11-nav a:hover {
  color: ${mx.ink};
}
@media (max-width: 540px) {
  .d11-brand-tag {
    display: none;
  }
  .d11-nav {
    gap: 16px;
    font-size: 12px;
  }
}
@media (max-width: 380px) {
  .d11-nav a:nth-child(2) {
    display: none;
  }
}
.d11-main {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
  gap: 64px;
  padding: 32px 56px 64px;
  align-items: start;
}
@media (max-width: 1060px) {
  .d11-main {
    grid-template-columns: 1fr;
    gap: 48px;
  }
}
@media (max-width: 720px) {
  .d11-header,
  .d11-main,
  .d11-footer {
    padding-left: 24px;
    padding-right: 24px;
  }
  .d11-header {
    padding-top: 20px;
    padding-bottom: 16px;
  }
  .d11-main {
    padding-top: 16px;
    padding-bottom: 48px;
    gap: 36px;
  }
}
@media (min-width: 721px) and (max-width: 1060px) {
  .d11-header,
  .d11-main,
  .d11-footer {
    padding-left: 32px;
    padding-right: 32px;
  }
}
.d11-pitch {
  padding-top: 20px;
}
.d11-kicker {
  font-family: ${mx.mono};
  font-size: 11px;
  letter-spacing: 0.22em;
  color: ${mx.accentText};
  margin-bottom: 28px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 10px;
}
.d11-kicker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${mx.accent};
  box-shadow: 0 0 10px ${mx.accent};
  animation: d11-pulse 2.2s ease-in-out infinite;
}
@keyframes d11-pulse {
  50% {
    opacity: 0.35;
  }
}
.d11-h1 {
  font-size: clamp(44px, 6.2vw, 64px);
  font-weight: 500;
  line-height: 1.02;
  letter-spacing: -0.035em;
  margin: 0 0 24px;
  color: #eefff3;
}
.d11-h1 em {
  font-style: italic;
  font-weight: 400;
  color: ${mx.accentText};
}
.d11-lede {
  font-size: 15.5px;
  line-height: 1.55;
  color: ${mx.inkDim};
  max-width: 420px;
  margin: 0;
}
.d11-steps {
  margin: 56px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 18px;
  font-family: ${mx.mono};
  font-size: 12px;
  max-width: 420px;
}
@media (max-width: 1060px) {
  .d11-steps {
    margin-top: 40px;
    max-width: none;
  }
}
.d11-steps li {
  display: grid;
  grid-template-columns: 32px 1fr;
  align-items: baseline;
  gap: 14px;
}
.d11-step-n {
  color: ${mx.accent};
}
.d11-step-t {
  color: ${mx.ink};
  margin-bottom: 2px;
}
.d11-step-d {
  color: ${mx.inkFaint};
}
.d11-card-wrap {
  position: relative;
}
.d11-card-label {
  position: absolute;
  top: -14px;
  left: 24px;
  font-family: ${mx.mono};
  font-size: 10px;
  color: ${mx.accentText};
  letter-spacing: 0.2em;
  background: ${mx.bgDeep};
  padding: 0 10px;
  z-index: 1;
}
.d11-card {
  position: relative;
  background: ${mx.card};
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid ${mx.line};
  border-radius: 4px;
  padding: 40px 36px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 30px 80px -20px rgba(0, 0, 0, 0.8),
    inset 0 0 60px ${mx.accentDim};
}
@media (max-width: 720px) {
  .d11-card {
    padding: 32px 22px 28px;
  }
  .d11-card-label {
    left: 16px;
    font-size: 9.5px;
  }
  .d11-tick-tl,
  .d11-tick-tr {
    top: 6px;
  }
  .d11-tick-bl,
  .d11-tick-br {
    bottom: 6px;
  }
  .d11-tick-tl,
  .d11-tick-bl {
    left: 6px;
  }
  .d11-tick-tr,
  .d11-tick-br {
    right: 6px;
  }
}
.d11-tick {
  position: absolute;
  width: 10px;
  height: 10px;
}
.d11-tick-tl {
  top: 8px;
  left: 8px;
  border-top: 1.5px solid ${mx.accent};
  border-left: 1.5px solid ${mx.accent};
}
.d11-tick-tr {
  top: 8px;
  right: 8px;
  border-top: 1.5px solid ${mx.accent};
  border-right: 1.5px solid ${mx.accent};
}
.d11-tick-bl {
  bottom: 8px;
  left: 8px;
  border-bottom: 1.5px solid ${mx.accent};
  border-left: 1.5px solid ${mx.accent};
}
.d11-tick-br {
  bottom: 8px;
  right: 8px;
  border-bottom: 1.5px solid ${mx.accent};
  border-right: 1.5px solid ${mx.accent};
}
.d11-field {
  margin-bottom: 22px;
}
.d11-field-label {
  font-family: ${mx.mono};
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${mx.inkDim};
  margin-bottom: 8px;
}
.d11-field-hint {
  margin-top: 8px;
  font-size: 12px;
  color: ${mx.inkFaint};
}
.d11-url {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1.5px solid ${mx.line};
  color: ${mx.ink};
  font-size: 17px;
  font-family: ${mx.mono};
  padding: 10px 0;
  outline: none;
  caret-color: ${mx.accent};
  transition: border-color 0.2s;
  border-radius: 0;
}
.d11-url::placeholder {
  color: ${mx.inkFaint};
}
.d11-url:focus,
.d11-url:not(:placeholder-shown) {
  border-bottom-color: ${mx.accent};
}
.d11-cipher {
  margin-top: 10px;
  font-family: ${mx.mono};
  font-size: 11px;
  letter-spacing: 0.05em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.d11-cipher-arrow {
  color: ${mx.accent};
  opacity: 0.7;
}
.d11-cipher-text {
  color: ${mx.inkFaint};
}
.d11-cipher-text.on {
  color: ${mx.accentText};
}
.d11-err-inline {
  margin-top: 10px;
  font-family: ${mx.mono};
  font-size: 12px;
  color: #ff8a8a;
}
.d11-ttl {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.d11-ttl-btn {
  padding: 11px 0;
  background: transparent;
  color: ${mx.ink};
  border: 1px solid ${mx.line};
  border-radius: 3px;
  cursor: pointer;
  font-family: ${mx.mono};
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 400;
  transition: all 0.15s;
}
.d11-ttl-btn:hover:not(:disabled) {
  border-color: ${mx.accent};
  color: ${mx.accentText};
}
.d11-ttl-btn.on {
  background: ${mx.accent};
  color: #001a0a;
  border-color: ${mx.accent};
  font-weight: 600;
}
.d11-select {
  width: 100%;
  background: transparent;
  border: 1px solid ${mx.line};
  border-radius: 3px;
  padding: 10px 32px 10px 12px;
  color: ${mx.ink};
  font-family: ${mx.mono};
  font-size: 13px;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%2378dca0' stroke-width='1.4'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
.d11-select:focus {
  border-color: ${mx.accent};
}
.d11-select option {
  background: ${mx.bgDeep};
  color: ${mx.ink};
}
.d11-toggles {
  display: flex;
  gap: 24px;
  margin: 4px 0 24px;
}
.d11-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.d11-check.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.d11-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.d11-check-box {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1.5px solid rgba(214, 245, 223, 0.35);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.d11-check input:checked + .d11-check-box {
  border-color: ${mx.accent};
  background: ${mx.accent};
}
.d11-check-text {
  font-family: ${mx.mono};
  font-size: 12px;
  letter-spacing: 0.05em;
  color: ${mx.ink};
}
.d11-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: -4px 0 22px;
}
@media (max-width: 540px) {
  .d11-pwd {
    grid-template-columns: 1fr;
  }
}
.d11-pwd-input {
  width: 100%;
  background: rgba(10, 28, 18, 0.4);
  border: 1px solid ${mx.line};
  border-radius: 3px;
  padding: 10px 12px;
  color: ${mx.ink};
  font-family: ${mx.mono};
  font-size: 13px;
  outline: none;
}
.d11-pwd-input:focus {
  border-color: ${mx.accent};
}
.d11-submit {
  width: 100%;
  padding: 16px 0;
  background: transparent;
  color: ${mx.inkFaint};
  border: 1px solid ${mx.line};
  border-radius: 3px;
  cursor: default;
  font-family: ${mx.mono};
  font-size: 13px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 600;
  transition: all 0.2s;
}
.d11-submit[data-active="1"]:not(:disabled) {
  background: ${mx.accent};
  color: #001a0a;
  border-color: ${mx.accent};
  cursor: pointer;
  box-shadow: 0 0 30px ${mx.accentDim};
}
.d11-submit[data-active="1"]:not(:disabled):hover {
  filter: brightness(1.07);
}
.d11-submit:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}
.d11-err-block {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 120, 120, 0.45);
  background: rgba(255, 80, 80, 0.06);
  color: #ffc2c2;
  font-family: ${mx.mono};
  font-size: 12px;
  border-radius: 3px;
}
.d11-err-head {
  color: #ff8080;
  letter-spacing: 0.18em;
  font-weight: 600;
  margin-bottom: 4px;
}
.d11-result-kicker {
  font-family: ${mx.mono};
  font-size: 10.5px;
  color: ${mx.accentText};
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.d11-result-title {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin-bottom: 22px;
  color: #eefff3;
}
.d11-result-url-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1px solid ${mx.accent};
  border-radius: 3px;
  padding: 14px 16px;
  margin-bottom: 14px;
  background: ${mx.accentDim};
  flex-wrap: wrap;
}
.d11-result-url {
  font-family: ${mx.mono};
  font-size: 14px;
  color: #eefff3;
  word-break: break-all;
  flex: 1 1 200px;
  min-width: 0;
}
.d11-result-copy {
  background: transparent;
  border: 1px solid ${mx.accent};
  color: ${mx.accentText};
  padding: 6px 14px;
  border-radius: 2px;
  font-family: ${mx.mono};
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  flex-shrink: 0;
}
.d11-result-copy:hover {
  background: ${mx.accentDim};
}
.d11-result-meta {
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: ${mx.mono};
  font-size: 11.5px;
  color: ${mx.inkDim};
  line-height: 1.6;
}
.d11-result-meta div {
  display: flex;
  gap: 10px;
}
.d11-result-meta dt {
  color: ${mx.accentText};
  flex: 0 0 90px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 10px;
  padding-top: 2px;
}
@media (max-width: 420px) {
  .d11-result-meta dt {
    flex-basis: 70px;
  }
}
.d11-result-meta dd {
  margin: 0;
  color: ${mx.ink};
}
.d11-revoke {
  font-family: ${mx.mono};
  font-size: 11px;
  color: ${mx.inkDim};
  margin-bottom: 22px;
  line-height: 1.6;
}
.d11-revoke code {
  color: ${mx.inkFaint};
  word-break: break-all;
}
.d11-result-foot {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}
@media (max-width: 420px) {
  .d11-result-foot {
    flex-direction: column;
    align-items: stretch;
  }
  .d11-qr {
    align-self: center;
  }
}
.d11-qr {
  padding: 8px;
  background: ${mx.accentDim};
  border: 1px solid ${mx.line};
  border-radius: 3px;
}
.d11-qr img {
  display: block;
  image-rendering: pixelated;
  filter: brightness(0) saturate(100%) invert(93%) sepia(10%) saturate(586%)
    hue-rotate(79deg) brightness(101%) contrast(96%);
}
.d11-reset {
  flex: 1;
  padding: 14px 0;
  background: transparent;
  color: ${mx.ink};
  border: 1px solid ${mx.line};
  border-radius: 3px;
  font-family: ${mx.mono};
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
}
.d11-reset:hover {
  border-color: ${mx.accent};
  color: ${mx.accentText};
}
@media (prefers-reduced-motion: reduce) {
  .d11-rain g {
    animation: none !important;
  }
  .d11-kicker-dot {
    animation: none !important;
  }
}
.d11-footer {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 56px 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: ${mx.mono};
  font-size: 10px;
  color: ${mx.inkFaint};
  letter-spacing: 0.1em;
  border-top: 1px solid ${mx.line};
  margin-top: auto;
}
.d11-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.d11-footer-attrib {
  font-family: ${mx.mono};
  font-size: 10px;
  letter-spacing: 0.08em;
  color: ${mx.inkFaint};
  text-align: center;
}
.d11-footer-attrib span[aria-label="love"] {
  color: ${mx.accentText};
  letter-spacing: 0;
  margin: 0 1px;
}
.d11-footer-link {
  color: ${mx.accentText};
  text-decoration: none;
  border-bottom: 1px solid ${mx.line};
  padding-bottom: 1px;
  transition: border-color 0.15s, color 0.15s;
}
.d11-footer-link:hover {
  border-bottom-color: ${mx.accentText};
  color: #eefff3;
}
@media (max-width: 540px) {
  .d11-footer {
    text-align: center;
    font-size: 9.5px;
    padding: 18px 24px 24px;
    gap: 8px;
  }
  .d11-footer-row {
    justify-content: center;
    gap: 8px;
  }
  .d11-footer-attrib {
    font-size: 9.5px;
  }
}
`;
