import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/6")({
  component: Design6,
});

function Design6() {
  const f = useShortenForm();
  const stage: PipelineStage =
    f.state === "idle"
      ? "idle"
      : f.state === "encrypting"
        ? "encrypting"
        : f.state === "uploading"
          ? "uploading"
          : f.state === "success"
            ? "done"
            : "idle";

  return (
    <>
      <FontLoader />
      <div className="d6-root">
        <GridBackground />
        <div className="d6-vignette" aria-hidden="true" />

        <div className="d6-hud-tl">
          <div className="d6-hud-kv">
            <span className="d6-dim">ID</span>
            <span>VOIDHOP/06</span>
          </div>
          <div className="d6-hud-kv">
            <span className="d6-dim">CIPHER</span>
            <span>AES-256-GCM</span>
          </div>
          <div className="d6-hud-kv">
            <span className="d6-dim">KDF</span>
            <span>PBKDF2·600K</span>
          </div>
        </div>
        <div className="d6-hud-tr">
          <div className="d6-hud-kv">
            <span className="d6-dim">RT</span>
            <span className="d6-live">
              <span className="d6-dot" /> LIVE
            </span>
          </div>
          <div className="d6-hud-kv">
            <span className="d6-dim">TRUST</span>
            <span>ZERO</span>
          </div>
          <div className="d6-hud-kv">
            <span className="d6-dim">LOGS</span>
            <span>NONE</span>
          </div>
        </div>

        <header className="d6-header">
          <Link to="/" className="d6-brand">
            <span className="d6-brand-mark">◢◣</span>
            <span className="d6-glitch" data-text="VOIDHOP">
              VOIDHOP
            </span>
          </Link>
          <Link to="/designs" className="d6-nav">
            /gallery ↗
          </Link>
        </header>

        <main className="d6-main">
          <div className="d6-side">
            <Pipeline stage={stage} />
          </div>

          <div className="d6-form-wrap">
            <p className="d6-sub">NODE·06 / neural-lattice.hud</p>
            <h1 className="d6-h1">
              <span className="d6-glitch" data-text="ENCRYPT">
                ENCRYPT
              </span>
              <br />
              <span className="d6-accent">→ VANISH</span>
            </h1>

            {f.state !== "success" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
                className="d6-form"
              >
                <div className="d6-field">
                  <label className="d6-label">
                    <span className="d6-label-n">01</span>
                    <span>TARGET_URL</span>
                  </label>
                  <div className="d6-input-wrap">
                    <span className="d6-caret">▸</span>
                    <input
                      type="url"
                      className="d6-input"
                      placeholder="https://…"
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
                    <p className="d6-fielderr">! {f.inputError}</p>
                  )}
                </div>

                <div className="d6-grid">
                  <div className="d6-field">
                    <label className="d6-label">
                      <span className="d6-label-n">02</span>
                      <span>TTL</span>
                    </label>
                    <div className="d6-tabs">
                      {TTL_OPTIONS.map((o) => (
                        <button
                          key={o.seconds}
                          type="button"
                          className={`d6-tab ${f.ttl === o.seconds ? "on" : ""}`}
                          onClick={() => f.setTtl(o.seconds)}
                          disabled={f.isBusy}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="d6-field">
                    <label className="d6-label">
                      <span className="d6-label-n">03</span>
                      <span>USES</span>
                    </label>
                    <select
                      className="d6-input d6-select"
                      value={f.usesLeft === undefined ? "" : String(f.usesLeft)}
                      onChange={(e) =>
                        f.setUsesLeft(
                          e.target.value === "" ? undefined : Number(e.target.value),
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

                <div className="d6-toggles">
                  <label className="d6-switch">
                    <input
                      type="checkbox"
                      checked={f.protect}
                      onChange={(e) => f.setProtect(e.target.checked)}
                      disabled={f.isBusy}
                    />
                    <span className="d6-switch-ui" />
                    <span className="d6-switch-text">
                      <span className="d6-label-n">04</span>
                      PASSWORD_LOCK
                    </span>
                  </label>
                  <label className="d6-switch">
                    <input
                      type="checkbox"
                      checked={f.includeDeletionToken}
                      onChange={(e) =>
                        f.setIncludeDeletionToken(e.target.checked)
                      }
                      disabled={f.isBusy}
                    />
                    <span className="d6-switch-ui" />
                    <span className="d6-switch-text">
                      <span className="d6-label-n">05</span>
                      KILL_SWITCH
                    </span>
                  </label>
                </div>

                {f.protect && (
                  <div className="d6-pwd">
                    <input
                      type="password"
                      className="d6-input d6-input-solo"
                      placeholder="password"
                      value={f.password}
                      onChange={(e) => f.setPassword(e.target.value)}
                      disabled={f.isBusy}
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      className="d6-input d6-input-solo"
                      placeholder="confirm"
                      value={f.confirmPassword}
                      onChange={(e) => f.setConfirmPassword(e.target.value)}
                      disabled={f.isBusy}
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {f.passwordError && (
                  <p className="d6-fielderr">! {f.passwordError}</p>
                )}

                <button
                  type="submit"
                  className="d6-submit"
                  disabled={f.isBusy || f.url.trim().length === 0}
                >
                  <span className="d6-submit-label">
                    {f.state === "encrypting"
                      ? "// ENCRYPTING_…"
                      : f.state === "uploading"
                        ? "// UPLOADING_…"
                        : "// COMMIT → VOID"}
                  </span>
                  <span className="d6-submit-arrow">▶▶</span>
                </button>

                {f.errorMessage && (
                  <div className="d6-err">
                    <span className="d6-err-tag">ERR</span>
                    <span>{f.errorMessage}</span>
                  </div>
                )}
              </form>
            )}

            {f.state === "success" && f.result && (
              <HudResult
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
          </div>
        </main>

        <footer className="d6-footer">
          <span>06 · neural-lattice</span>
          <span className="d6-dim">all transmissions local · server=blind</span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

type PipelineStage = "idle" | "encrypting" | "uploading" | "done";

function Pipeline({ stage }: { stage: PipelineStage }) {
  const order: PipelineStage[] = ["idle", "encrypting", "uploading", "done"];
  const currentIdx = order.indexOf(stage);
  const nodes = [
    { label: "URL", hue: "cyan" },
    { label: "PAD", hue: "cyan" },
    { label: "AES-GCM", hue: "pink" },
    { label: "BLOB", hue: "pink" },
    { label: "→ VOID", hue: "cyan" },
  ];
  return (
    <div className="d6-pipe">
      <div className="d6-pipe-head">
        <span className="d6-label-n">∑</span>
        <span>PIPELINE</span>
      </div>
      <div className="d6-pipe-nodes">
        {nodes.map((n, i) => {
          const lit =
            (currentIdx >= 1 && i <= 1) ||
            (currentIdx >= 2 && i <= 3) ||
            currentIdx >= 3;
          return (
            <div key={n.label} className="d6-pipe-row">
              <div
                className={`d6-pipe-node ${lit ? "on" : ""} ${n.hue === "pink" ? "pink" : ""}`}
              >
                <span className="d6-pipe-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="d6-pipe-label">{n.label}</span>
                <span className="d6-pipe-pulse" />
              </div>
              {i < nodes.length - 1 && (
                <div className={`d6-pipe-conn ${lit ? "on" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="d6-pipe-foot">
        <span className="d6-dim">state=</span>
        <span>{stage}</span>
      </div>
    </div>
  );
}

function HudResult({
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
    <div className="d6-result">
      <div className="d6-result-head">
        <span className="d6-dim">[ ok ]</span>
        <span className="d6-glitch" data-text="TRANSMITTED">
          TRANSMITTED
        </span>
      </div>
      <div className="d6-result-url">{shortUrl}</div>
      <div className="d6-result-actions">
        <button
          type="button"
          className="d6-btn"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "✓ copied" : "cp → clip"}
        </button>
        <button type="button" className="d6-btn d6-btn-ghost" onClick={onAnother}>
          ↻ new
        </button>
      </div>
      <div className="d6-result-meta">
        <div>
          <span className="d6-dim">expiry:</span> {expiry}
        </div>
        {passwordProtected && (
          <div>
            <span className="d6-dim">lock:</span> password · attempts=5
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <span className="d6-dim">uses:</span>{" "}
            {usesLeft === 1 ? "1 (burn on read)" : `${usesLeft}`}
          </div>
        )}
      </div>
      {deleteUrl && (
        <div className="d6-revoke">
          <div className="d6-revoke-head">
            <span className="d6-revoke-tag">REVOKE</span>
            <span className="d6-dim">kill-switch</span>
          </div>
          <code>{deleteUrl}</code>
        </div>
      )}
      <div className="d6-qr-row">
        <div className="d6-qr" ref={qrRef} aria-label="QR code" />
        <div className="d6-qr-ticks">
          {[1, 2, 3, 4].map((n) => (
            <div key={n}>
              <span className="d6-dim">t{n}:</span> 0x{Math.floor(Math.random() * 65536).toString(16).padStart(4, "0")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GridBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
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

    let t = 0;
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "#070712";
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1;

      // perspective floor
      const horizon = h * 0.55;
      const cx = w / 2;
      t += 0.4;
      // horizontal receding lines
      for (let i = 1; i < 30; i++) {
        const k = ((i * 20 + t) % 600) / 600;
        const y = horizon + Math.pow(k, 2.4) * (h - horizon);
        ctx.strokeStyle = `rgba(0, 255, 255, ${0.05 + k * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // radial diverging lines
      for (let i = -20; i <= 20; i++) {
        const x = cx + i * 60;
        ctx.strokeStyle = `rgba(255, 0, 110, ${0.04 + Math.abs(i) * 0.002})`;
        ctx.beginPath();
        ctx.moveTo(cx, horizon);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // upper grid
      ctx.strokeStyle = "rgba(0, 255, 255, 0.06)";
      for (let i = 0; i < horizon; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, horizon);
        ctx.stroke();
      }
      raf = window.requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas className="d6-mesh" ref={ref} aria-hidden="true" />;
}

function FontLoader() {
  useEffect(() => {
    const id = "d6-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Share+Tech+Mono&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d6-root {
  position: relative;
  min-height: 100vh;
  background: #070712;
  color: #d6f3ff;
  font-family: "Chakra Petch", ui-sans-serif, sans-serif;
  overflow-x: hidden;
  isolation: isolate;
}
.d6-mesh {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.d6-vignette {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 55%, transparent 0%, rgba(7, 7, 18, 0.8) 75%);
}
.d6-root > header,
.d6-root > main,
.d6-root > footer,
.d6-hud-tl,
.d6-hud-tr {
  position: relative;
  z-index: 3;
}
.d6-hud-tl,
.d6-hud-tr {
  position: fixed;
  top: 20px;
  font-family: "Share Tech Mono", ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border: 1px solid rgba(0, 255, 255, 0.25);
  background: rgba(7, 7, 18, 0.6);
  backdrop-filter: blur(4px);
}
.d6-hud-tl {
  left: 20px;
}
.d6-hud-tr {
  right: 20px;
  text-align: right;
  border-color: rgba(255, 0, 110, 0.25);
}
@media (max-width: 900px) {
  .d6-hud-tl,
  .d6-hud-tr {
    display: none;
  }
}
.d6-hud-kv {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}
.d6-dim {
  color: rgba(214, 243, 255, 0.4);
}
.d6-live {
  color: #39ff14;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.d6-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #39ff14;
  box-shadow: 0 0 8px #39ff14;
  animation: d6-pulse 1.2s ease-in-out infinite;
}
@keyframes d6-pulse {
  50% {
    opacity: 0.25;
  }
}
.d6-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 140px;
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
}
@media (max-width: 900px) {
  .d6-header {
    padding: 22px 28px;
  }
}
.d6-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #d6f3ff;
  text-decoration: none;
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.22em;
}
.d6-brand-mark {
  color: #00ffff;
  text-shadow: 0 0 8px #00ffff;
  font-family: "Share Tech Mono", monospace;
}
.d6-nav {
  color: #d6f3ff;
  text-decoration: none;
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.2em;
  padding: 6px 12px;
  border: 1px solid rgba(0, 255, 255, 0.3);
}
.d6-nav:hover {
  color: #00ffff;
  border-color: #00ffff;
  box-shadow: 0 0 18px rgba(0, 255, 255, 0.5);
}
.d6-glitch {
  position: relative;
  display: inline-block;
}
.d6-glitch::before,
.d6-glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
  clip-path: inset(0 0 0 0);
}
.d6-glitch::before {
  color: #ff006e;
  animation: d6-glitch-a 3s steps(1) infinite;
}
.d6-glitch::after {
  color: #00ffff;
  animation: d6-glitch-b 3.7s steps(1) infinite;
}
@keyframes d6-glitch-a {
  0%,
  84%,
  100% {
    clip-path: inset(100% 0 0 0);
    transform: translate(0, 0);
  }
  85% {
    clip-path: inset(10% 0 70% 0);
    transform: translate(-2px, 1px);
  }
  90% {
    clip-path: inset(50% 0 30% 0);
    transform: translate(1px, -1px);
  }
}
@keyframes d6-glitch-b {
  0%,
  79%,
  100% {
    clip-path: inset(100% 0 0 0);
    transform: translate(0, 0);
  }
  80% {
    clip-path: inset(20% 0 50% 0);
    transform: translate(2px, 0);
  }
  92% {
    clip-path: inset(65% 0 20% 0);
    transform: translate(-1px, 1px);
  }
}
.d6-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 140px;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 60px;
}
@media (max-width: 900px) {
  .d6-main {
    padding: 40px 28px;
    grid-template-columns: 1fr;
  }
}
.d6-pipe {
  border: 1px solid rgba(0, 255, 255, 0.3);
  padding: 20px 18px;
  background: rgba(7, 7, 18, 0.65);
  backdrop-filter: blur(4px);
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  position: sticky;
  top: 20px;
}
.d6-pipe-head {
  display: flex;
  gap: 10px;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(0, 255, 255, 0.2);
  margin-bottom: 12px;
  color: #00ffff;
  letter-spacing: 0.2em;
}
.d6-pipe-nodes {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.d6-pipe-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.d6-pipe-node {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid rgba(0, 255, 255, 0.3);
  background: transparent;
  width: 100%;
  color: rgba(214, 243, 255, 0.6);
  position: relative;
  transition: all 0.25s;
}
.d6-pipe-node.on {
  background: rgba(0, 255, 255, 0.1);
  border-color: #00ffff;
  color: #fff;
  box-shadow: 0 0 16px rgba(0, 255, 255, 0.35);
}
.d6-pipe-node.on.pink {
  background: rgba(255, 0, 110, 0.1);
  border-color: #ff006e;
  box-shadow: 0 0 16px rgba(255, 0, 110, 0.35);
}
.d6-pipe-n {
  color: rgba(214, 243, 255, 0.4);
  font-size: 10px;
}
.d6-pipe-node.on .d6-pipe-n {
  color: #00ffff;
}
.d6-pipe-node.on.pink .d6-pipe-n {
  color: #ff006e;
}
.d6-pipe-label {
  flex: 1;
}
.d6-pipe-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(214, 243, 255, 0.15);
}
.d6-pipe-node.on .d6-pipe-pulse {
  background: #00ffff;
  box-shadow: 0 0 10px #00ffff;
  animation: d6-dotpulse 0.9s ease-in-out infinite;
}
.d6-pipe-node.on.pink .d6-pipe-pulse {
  background: #ff006e;
  box-shadow: 0 0 10px #ff006e;
}
@keyframes d6-dotpulse {
  50% {
    transform: scale(0.6);
    opacity: 0.6;
  }
}
.d6-pipe-conn {
  width: 1px;
  height: 14px;
  margin-left: 20px;
  background: rgba(0, 255, 255, 0.2);
}
.d6-pipe-conn.on {
  background: #00ffff;
  box-shadow: 0 0 6px #00ffff;
}
.d6-pipe-foot {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed rgba(0, 255, 255, 0.2);
  font-size: 11px;
  letter-spacing: 0.15em;
  color: #d6f3ff;
  text-transform: uppercase;
}
.d6-sub {
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.25em;
  color: #00ffff;
  margin: 0 0 14px;
  text-transform: uppercase;
}
.d6-h1 {
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: clamp(56px, 8vw, 104px);
  letter-spacing: 0.02em;
  line-height: 0.95;
  margin: 0 0 40px;
  text-transform: uppercase;
}
.d6-accent {
  color: #ff006e;
  text-shadow: 0 0 22px rgba(255, 0, 110, 0.6);
}
.d6-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.d6-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.d6-label {
  display: flex;
  gap: 10px;
  align-items: center;
  font-family: "Share Tech Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.25em;
  color: #00ffff;
  text-transform: uppercase;
}
.d6-label-n {
  color: #ff006e;
  font-weight: 700;
}
.d6-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid rgba(0, 255, 255, 0.3);
  background: rgba(7, 7, 18, 0.65);
  padding: 0 12px;
}
.d6-input-wrap:focus-within {
  border-color: #00ffff;
  box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.2);
}
.d6-caret {
  color: #00ffff;
}
.d6-input {
  background: transparent;
  border: none;
  color: #d6f3ff;
  padding: 14px 12px;
  font-family: "Share Tech Mono", monospace;
  font-size: 16px;
  outline: none;
  flex: 1;
  min-width: 0;
  border-radius: 0;
}
.d6-input-solo {
  border: 1px solid rgba(0, 255, 255, 0.3);
  background: rgba(7, 7, 18, 0.65);
}
.d6-input-solo:focus {
  border-color: #00ffff;
  box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.2);
}
.d6-input::placeholder {
  color: rgba(214, 243, 255, 0.35);
}
.d6-select {
  appearance: none;
  padding-right: 28px;
  background-image:
    linear-gradient(45deg, transparent 50%, #00ffff 50%),
    linear-gradient(135deg, #00ffff 50%, transparent 50%);
  background-position:
    calc(100% - 14px) 50%,
    calc(100% - 8px) 50%;
  background-size: 6px 6px;
  background-repeat: no-repeat;
}
.d6-select option {
  background: #070712;
}
.d6-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}
@media (max-width: 700px) {
  .d6-grid {
    grid-template-columns: 1fr;
  }
}
.d6-tabs {
  display: flex;
  gap: 0;
  border: 1px solid rgba(0, 255, 255, 0.3);
}
.d6-tab {
  flex: 1;
  background: transparent;
  color: #d6f3ff;
  border: none;
  padding: 12px 14px;
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  border-right: 1px solid rgba(0, 255, 255, 0.3);
}
.d6-tab:last-child {
  border-right: none;
}
.d6-tab:hover:not(:disabled) {
  background: rgba(0, 255, 255, 0.08);
}
.d6-tab.on {
  background: #00ffff;
  color: #070712;
  font-weight: 700;
}
.d6-toggles {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
}
.d6-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.15em;
  color: #d6f3ff;
  text-transform: uppercase;
}
.d6-switch input {
  display: none;
}
.d6-switch-ui {
  position: relative;
  width: 44px;
  height: 20px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.4);
  transition: background 0.2s;
}
.d6-switch-ui::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #00ffff;
  transition: transform 0.2s;
  box-shadow: 0 0 8px #00ffff;
}
.d6-switch input:checked + .d6-switch-ui {
  background: rgba(255, 0, 110, 0.2);
  border-color: #ff006e;
}
.d6-switch input:checked + .d6-switch-ui::after {
  transform: translateX(24px);
  background: #ff006e;
  box-shadow: 0 0 10px #ff006e;
}
.d6-switch-text {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.d6-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 700px) {
  .d6-pwd {
    grid-template-columns: 1fr;
  }
}
.d6-fielderr {
  color: #ff006e;
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  margin: 0;
}
.d6-submit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(90deg, #00ffff, #ff006e);
  color: #070712;
  border: none;
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.22em;
  cursor: pointer;
  text-transform: uppercase;
  position: relative;
  overflow: hidden;
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%
  );
}
.d6-submit:hover:not(:disabled) {
  filter: brightness(1.1) saturate(1.2);
}
.d6-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.d6-submit-arrow {
  font-family: "Share Tech Mono", monospace;
}
.d6-err {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid #ff006e;
  background: rgba(255, 0, 110, 0.08);
  color: #ffb4d5;
  font-family: "Share Tech Mono", monospace;
  font-size: 14px;
}
.d6-err-tag {
  background: #ff006e;
  color: #070712;
  padding: 2px 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
}
.d6-result {
  border: 1px solid #00ffff;
  background: rgba(7, 7, 18, 0.75);
  padding: 30px;
  backdrop-filter: blur(6px);
  box-shadow: 0 0 50px rgba(0, 255, 255, 0.2);
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - 20px),
    calc(100% - 20px) 100%,
    0 100%
  );
}
.d6-result-head {
  display: flex;
  gap: 12px;
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  letter-spacing: 0.2em;
  font-size: 20px;
  margin-bottom: 16px;
  color: #00ffff;
}
.d6-result-url {
  font-family: "Share Tech Mono", monospace;
  font-size: 18px;
  padding: 16px 18px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.4);
  color: #fff;
  word-break: break-all;
  margin-bottom: 16px;
  line-height: 1.5;
}
.d6-result-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.d6-btn {
  background: #00ffff;
  color: #070712;
  border: none;
  padding: 10px 18px;
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  font-weight: 700;
}
.d6-btn:hover:not(:disabled) {
  background: #ff006e;
  color: #fff;
}
.d6-btn-ghost {
  background: transparent;
  color: #d6f3ff;
  border: 1px solid rgba(0, 255, 255, 0.4);
}
.d6-result-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: "Share Tech Mono", monospace;
  font-size: 13px;
  margin-bottom: 18px;
}
.d6-revoke {
  padding: 14px 16px;
  border: 1px dashed #ff006e;
  margin-bottom: 18px;
  background: rgba(255, 0, 110, 0.05);
}
.d6-revoke-head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 6px;
}
.d6-revoke-tag {
  background: #ff006e;
  color: #070712;
  padding: 2px 10px;
  font-family: "Share Tech Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.25em;
  font-weight: 700;
}
.d6-revoke code {
  font-family: "Share Tech Mono", monospace;
  font-size: 12px;
  word-break: break-all;
  color: #ffb4d5;
}
.d6-qr-row {
  display: flex;
  gap: 22px;
  align-items: center;
  padding-top: 18px;
  border-top: 1px dashed rgba(0, 255, 255, 0.25);
}
.d6-qr {
  padding: 10px;
  background: rgba(0, 255, 255, 0.05);
  border: 1px solid rgba(0, 255, 255, 0.35);
}
.d6-qr img {
  display: block;
  image-rendering: pixelated;
  filter: brightness(0) saturate(100%) invert(78%) sepia(66%) saturate(2900%)
    hue-rotate(149deg) brightness(105%) contrast(103%);
}
.d6-qr-ticks {
  font-family: "Share Tech Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #d6f3ff;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.d6-footer {
  display: flex;
  justify-content: space-between;
  padding: 22px 140px;
  border-top: 1px solid rgba(0, 255, 255, 0.2);
  font-family: "Share Tech Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
@media (max-width: 900px) {
  .d6-footer {
    padding: 22px 28px;
  }
}
`;
