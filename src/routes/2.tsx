import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/2")({
  component: Design2,
});

function Design2() {
  const f = useShortenForm();

  return (
    <>
      <FontLoader />
      <div className="d2-root">
        <PortalCanvas busy={f.isBusy} />
        <div className="d2-grain" aria-hidden="true" />

        <header className="d2-header">
          <Link to="/" className="d2-brand">
            <span className="d2-brand-mark">◐</span>
            <span>voidhop</span>
          </Link>
          <Link to="/designs" className="d2-navlink">
            all variants →
          </Link>
        </header>

        <main className="d2-main">
          <div className="d2-eyebrow">II · EVENT HORIZON</div>
          <h1 className="d2-title">
            Past the rim,
            <br />
            <em>nothing watches.</em>
          </h1>
          <p className="d2-lede">
            Your URL is encrypted in your browser and thrown into the well.
            We keep only the ciphertext. Return before the expiry collapses
            the record.
          </p>

          {f.state !== "success" && (
            <form
              className="d2-form"
              onSubmit={(e) => {
                e.preventDefault();
                f.submit();
              }}
            >
              <div className="d2-portal-wrap">
                <div className="d2-portal" aria-hidden="true" />
                <input
                  type="url"
                  className="d2-url"
                  placeholder="paste a url into the void"
                  value={f.url}
                  onChange={(e) => f.onUrlChange(e.target.value)}
                  disabled={f.isBusy}
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  required
                />
              </div>
              {f.inputError && (
                <p className="d2-fielderr">{f.inputError}</p>
              )}

              <div className="d2-grid">
                <div className="d2-field">
                  <label className="d2-label">Expiry</label>
                  <div className="d2-pillrow">
                    {TTL_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        type="button"
                        className={`d2-pill ${f.ttl === opt.seconds ? "d2-pill-on" : ""}`}
                        onClick={() => f.setTtl(opt.seconds)}
                        disabled={f.isBusy}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="d2-field">
                  <label className="d2-label">Reads</label>
                  <select
                    className="d2-select"
                    value={f.usesLeft === undefined ? "" : String(f.usesLeft)}
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
                </div>
              </div>

              <div className="d2-toggles">
                <label className="d2-toggle">
                  <input
                    type="checkbox"
                    checked={f.protect}
                    onChange={(e) => f.setProtect(e.target.checked)}
                    disabled={f.isBusy}
                  />
                  <span>Seal with a password</span>
                </label>
                <label className="d2-toggle">
                  <input
                    type="checkbox"
                    checked={f.includeDeletionToken}
                    onChange={(e) =>
                      f.setIncludeDeletionToken(e.target.checked)
                    }
                    disabled={f.isBusy}
                  />
                  <span>Give me a revocation token</span>
                </label>
              </div>

              {f.protect && (
                <div className="d2-pwd">
                  <input
                    type="password"
                    className="d2-input"
                    placeholder="password"
                    value={f.password}
                    onChange={(e) => f.setPassword(e.target.value)}
                    disabled={f.isBusy}
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    className="d2-input"
                    placeholder="confirm"
                    value={f.confirmPassword}
                    onChange={(e) => f.setConfirmPassword(e.target.value)}
                    disabled={f.isBusy}
                    autoComplete="new-password"
                  />
                </div>
              )}
              {f.passwordError && (
                <p className="d2-fielderr">{f.passwordError}</p>
              )}

              <button
                type="submit"
                className="d2-submit"
                disabled={f.isBusy || f.url.trim().length === 0}
              >
                <span>
                  {f.state === "encrypting"
                    ? "Encrypting…"
                    : f.state === "uploading"
                      ? "Crossing the horizon…"
                      : "Release into the void"}
                </span>
                <span className="d2-submit-arrow">⤳</span>
              </button>

              {f.errorMessage && (
                <div className="d2-err">
                  <strong>Reflected.</strong> {f.errorMessage}
                </div>
              )}
            </form>
          )}

          {f.state === "success" && f.result && (
            <PortalResult
              shortUrl={f.result.shortUrl}
              expiry={formatExpiry(f.result.expiresAt)}
              passwordProtected={f.result.passwordProtected}
              {...(f.result.usesLeft !== undefined
                ? { usesLeft: f.result.usesLeft }
                : {})}
              {...(f.result.deleteUrl !== undefined
                ? { deleteUrl: f.result.deleteUrl }
                : {})}
              onAnother={f.reset}
            />
          )}
        </main>

        <footer className="d2-footer">
          <span>II / X</span>
          <span className="d2-footer-meta">
            Event Horizon · designed for VoidHop
          </span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function PortalResult({
  shortUrl,
  expiry,
  passwordProtected,
  usesLeft,
  deleteUrl,
  onAnother,
}: {
  shortUrl: string;
  expiry: string;
  passwordProtected: boolean;
  usesLeft?: number;
  deleteUrl?: string;
  onAnother: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!qrRef.current) return;
    const qr = qrcode(0, "M");
    qr.addData(shortUrl);
    qr.make();
    qrRef.current.innerHTML = qr.createImgTag(3, 0);
  }, [shortUrl]);

  return (
    <div className="d2-result">
      <div className="d2-result-eyebrow">RETURNED</div>
      <div className="d2-result-url">{shortUrl}</div>
      <div className="d2-result-actions">
        <button
          type="button"
          className="d2-pill d2-pill-on"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
        <button type="button" className="d2-pill" onClick={onAnother}>
          send another
        </button>
      </div>
      <dl className="d2-result-meta">
        <div>
          <dt>collapses</dt>
          <dd>{expiry}</dd>
        </div>
        {passwordProtected && (
          <div>
            <dt>seal</dt>
            <dd>password required</dd>
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <dt>reads</dt>
            <dd>
              {usesLeft === 1 ? "self-destruct after one" : `${usesLeft} reads`}
            </dd>
          </div>
        )}
      </dl>
      {deleteUrl && (
        <div className="d2-delete">
          <div className="d2-delete-label">revocation</div>
          <code>{deleteUrl}</code>
        </div>
      )}
      <div className="d2-qr-wrap">
        <div className="d2-qr" ref={qrRef} aria-label="QR code" />
        <div className="d2-qr-caption">scan · share · trust nobody</div>
      </div>
    </div>
  );
}

function PortalCanvas({ busy }: { busy: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Particles drift inward along a log-spiral
    const N = 220;
    const particles = Array.from({ length: N }, () => ({
      r: 80 + Math.random() * 600,
      theta: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.7,
      size: 0.5 + Math.random() * 1.8,
      hue: 260 + Math.random() * 40,
    }));

    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(5, 4, 26, 0.22)";
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = Math.min(h * 0.52, h - 260);

      // portal rim glow
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
      grad.addColorStop(0, "rgba(139, 92, 246, 0.28)");
      grad.addColorStop(0.55, "rgba(55, 48, 163, 0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const pull = busyRef.current ? 2.5 : 1;
      for (const p of particles) {
        p.theta += 0.012 * p.speed;
        p.r -= p.speed * 0.4 * pull;
        if (p.r < 40) {
          p.r = 400 + Math.random() * 300;
          p.theta = Math.random() * Math.PI * 2;
        }
        const x = cx + Math.cos(p.theta) * p.r;
        const y = cy + Math.sin(p.theta) * p.r;
        ctx.fillStyle = `hsla(${p.hue}, 90%, ${60 + Math.random() * 15}%, ${Math.min(1, 0.1 + (400 - p.r) / 600)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // inner void disc
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fill();
      // rim highlight
      ctx.strokeStyle = "rgba(139, 92, 246, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 62, 0, Math.PI * 2);
      ctx.stroke();

      raf = window.requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas className="d2-canvas" ref={ref} aria-hidden="true" />;
}

function FontLoader() {
  useEffect(() => {
    const id = "d2-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,500&family=Geist+Mono:wght@400;600&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d2-root {
  position: relative;
  min-height: 100vh;
  background:
    radial-gradient(ellipse 120% 80% at 50% 30%, #120c3a 0%, #05041a 60%, #02010a 100%);
  color: #e4e0ff;
  font-family: "Fraunces", Georgia, serif;
  overflow: hidden;
  isolation: isolate;
}
.d2-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.d2-grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.d2-root > header,
.d2-root > main,
.d2-root > footer {
  position: relative;
  z-index: 2;
}
.d2-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 40px;
}
.d2-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #e4e0ff;
  text-decoration: none;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.d2-brand-mark {
  color: #a78bfa;
  font-size: 22px;
  filter: drop-shadow(0 0 10px rgba(167, 139, 250, 0.8));
}
.d2-navlink {
  color: rgba(228, 224, 255, 0.7);
  text-decoration: none;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.d2-navlink:hover {
  color: #e4e0ff;
}
.d2-main {
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 40px 80px;
  text-align: center;
}
.d2-eyebrow {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.28em;
  color: #a78bfa;
  text-transform: uppercase;
  margin-bottom: 28px;
  text-shadow: 0 0 16px rgba(167, 139, 250, 0.45);
}
.d2-title {
  font-family: "Fraunces", serif;
  font-weight: 300;
  font-size: clamp(46px, 7vw, 82px);
  line-height: 0.95;
  letter-spacing: -0.02em;
  margin: 0 0 28px;
}
.d2-title em {
  font-style: italic;
  color: #c4b5fd;
  font-weight: 500;
}
.d2-lede {
  max-width: 500px;
  margin: 0 auto 80px;
  font-size: 17px;
  line-height: 1.6;
  color: rgba(228, 224, 255, 0.7);
  font-family: "Geist Mono", ui-monospace, monospace;
}
.d2-form {
  text-align: left;
}
.d2-portal-wrap {
  position: relative;
  margin-bottom: 18px;
  display: flex;
  justify-content: center;
}
.d2-portal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 540px;
  height: 540px;
  max-width: 90vw;
  max-height: 90vw;
  border-radius: 50%;
  border: 1px solid rgba(139, 92, 246, 0.25);
  box-shadow:
    inset 0 0 80px rgba(139, 92, 246, 0.25),
    0 0 80px rgba(139, 92, 246, 0.15);
  z-index: 0;
  pointer-events: none;
  animation: d2-pulse 6s ease-in-out infinite;
}
@keyframes d2-pulse {
  0%,
  100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
  }
}
.d2-url {
  width: 100%;
  max-width: 580px;
  background: rgba(5, 4, 26, 0.65);
  border: none;
  border-bottom: 1px solid rgba(167, 139, 250, 0.4);
  color: #fff;
  font-family: "Fraunces", serif;
  font-style: italic;
  font-size: clamp(22px, 3.5vw, 36px);
  text-align: center;
  padding: 24px 20px;
  outline: none;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(6px);
}
.d2-url::placeholder {
  color: rgba(196, 181, 253, 0.45);
  font-style: italic;
}
.d2-url:focus {
  border-bottom-color: #a78bfa;
  box-shadow: 0 1px 0 0 #a78bfa;
}
.d2-fielderr {
  color: #f87171;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 13px;
  margin: 0 0 16px;
  text-align: center;
}
.d2-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 40px 0 24px;
}
@media (max-width: 560px) {
  .d2-grid {
    grid-template-columns: 1fr;
  }
}
.d2-label {
  display: block;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(196, 181, 253, 0.8);
  margin-bottom: 10px;
}
.d2-pillrow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.d2-pill {
  background: transparent;
  color: #e4e0ff;
  border: 1px solid rgba(139, 92, 246, 0.35);
  padding: 10px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  transition: all 0.18s;
}
.d2-pill:hover:not(:disabled) {
  border-color: rgba(167, 139, 250, 0.8);
  background: rgba(139, 92, 246, 0.08);
}
.d2-pill-on {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: #fff;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.7);
}
.d2-select,
.d2-input {
  width: 100%;
  background: rgba(5, 4, 26, 0.55);
  border: 1px solid rgba(139, 92, 246, 0.35);
  color: #e4e0ff;
  padding: 12px 14px;
  border-radius: 4px;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 13px;
  outline: none;
}
.d2-select:focus,
.d2-input:focus {
  border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}
.d2-select option {
  background: #0a0820;
}
.d2-toggles {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 8px 0 28px;
}
.d2-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: "Fraunces", serif;
  font-size: 16px;
  color: rgba(228, 224, 255, 0.85);
  cursor: pointer;
}
.d2-toggle input {
  accent-color: #8b5cf6;
  width: 18px;
  height: 18px;
}
.d2-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 560px) {
  .d2-pwd {
    grid-template-columns: 1fr;
  }
}
.d2-submit {
  appearance: none;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  border: none;
  padding: 20px 28px;
  border-radius: 999px;
  font-family: "Fraunces", serif;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(167, 139, 250, 0.4),
    0 20px 40px rgba(139, 92, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: transform 0.2s;
}
.d2-submit:hover:not(:disabled) {
  transform: translateY(-2px);
}
.d2-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.d2-submit-arrow {
  font-size: 24px;
  font-family: "Geist Mono", monospace;
}
.d2-err {
  margin-top: 18px;
  padding: 14px 16px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(239, 68, 68, 0.08);
  color: #fecaca;
  border-radius: 6px;
  font-family: "Geist Mono", monospace;
  font-size: 13px;
}
.d2-result {
  margin-top: 40px;
  text-align: left;
  background: rgba(16, 10, 50, 0.65);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  padding: 32px;
  backdrop-filter: blur(12px);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
}
.d2-result-eyebrow {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.28em;
  color: #a78bfa;
  margin-bottom: 14px;
}
.d2-result-url {
  font-family: "Geist Mono", monospace;
  font-size: 18px;
  word-break: break-all;
  color: #fff;
  padding: 18px 20px;
  background: rgba(5, 4, 26, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 6px;
  margin-bottom: 16px;
  line-height: 1.5;
}
.d2-result-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.d2-result-meta {
  margin: 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: "Geist Mono", monospace;
  font-size: 13px;
}
.d2-result-meta div {
  display: flex;
  gap: 12px;
}
.d2-result-meta dt {
  color: #a78bfa;
  min-width: 110px;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.2em;
  padding-top: 2px;
}
.d2-result-meta dd {
  margin: 0;
  color: #e4e0ff;
}
.d2-delete {
  background: rgba(5, 4, 26, 0.6);
  padding: 14px 16px;
  border-left: 3px solid #8b5cf6;
  margin-bottom: 20px;
  font-family: "Geist Mono", monospace;
  font-size: 12px;
}
.d2-delete-label {
  color: #a78bfa;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 10px;
  margin-bottom: 6px;
}
.d2-delete code {
  color: #fca5a5;
  word-break: break-all;
}
.d2-qr-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
}
.d2-qr {
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  display: inline-block;
}
.d2-qr img {
  display: block;
  image-rendering: pixelated;
}
.d2-qr-caption {
  font-family: "Fraunces", serif;
  font-style: italic;
  color: rgba(228, 224, 255, 0.65);
}
.d2-footer {
  display: flex;
  justify-content: space-between;
  padding: 24px 40px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(228, 224, 255, 0.45);
}
`;
