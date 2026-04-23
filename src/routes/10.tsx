import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/10")({
  component: Design10,
});

function Design10() {
  const f = useShortenForm();
  const [lean, setLean] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const xn = (e.clientX / w - 0.5) * 2;
    const yn = (e.clientY / h - 0.5) * 2;
    setLean({ x: xn * 4, y: yn * 2 });
  };

  return (
    <>
      <FontLoader />
      <div className="d10-root" onMouseMove={onMove}>
        <div className="d10-grain" aria-hidden="true" />
        <div className="d10-stars" aria-hidden="true">
          <StarField />
        </div>

        <header className="d10-header">
          <Link to="/" className="d10-brand">
            V<span>·</span>H
          </Link>
          <Link to="/designs" className="d10-nav">
            X / X
          </Link>
        </header>

        <main className="d10-stage">
          <div
            className="d10-slab-wrap"
            style={{
              transform: `perspective(1400px) rotateY(${-4 + lean.x}deg) rotateX(${2 - lean.y}deg)`,
            }}
          >
            <div className="d10-slab">
              <div className="d10-slab-face">
                <div className="d10-mono-title">
                  <span className="d10-mono-i">X</span>
                  <span className="d10-mono-dot">·</span>
                  <span className="d10-mono-ii">OBSIDIAN</span>
                </div>

                <h1 className="d10-h1">
                  A monolith
                  <br />
                  that
                  <br />
                  <span className="d10-h1-accent">remembers nothing.</span>
                </h1>

                {f.state !== "success" && (
                  <form
                    className="d10-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      f.submit();
                    }}
                  >
                    <div className="d10-row">
                      <span className="d10-row-i">01</span>
                      <input
                        type="url"
                        className="d10-input d10-input-big"
                        placeholder="enter url"
                        value={f.url}
                        onChange={(e) => f.onUrlChange(e.target.value)}
                        disabled={f.isBusy}
                        spellCheck={false}
                        autoComplete="off"
                        autoFocus
                        required
                      />
                    </div>
                    {f.inputError && <p className="d10-fielderr">{f.inputError}</p>}

                    <div className="d10-row">
                      <span className="d10-row-i">02</span>
                      <div className="d10-row-label">expiry</div>
                      <div className="d10-row-val">
                        {TTL_OPTIONS.map((o) => (
                          <button
                            key={o.seconds}
                            type="button"
                            className={`d10-chip ${f.ttl === o.seconds ? "on" : ""}`}
                            onClick={() => f.setTtl(o.seconds)}
                            disabled={f.isBusy}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="d10-row">
                      <span className="d10-row-i">03</span>
                      <div className="d10-row-label">uses</div>
                      <div className="d10-row-val">
                        <select
                          className="d10-input d10-select"
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
                              value={
                                o.value === undefined ? "" : String(o.value)
                              }
                            >
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="d10-row">
                      <span className="d10-row-i">04</span>
                      <div className="d10-row-label">lock</div>
                      <div className="d10-row-val">
                        <label className="d10-sw">
                          <input
                            type="checkbox"
                            checked={f.protect}
                            onChange={(e) => f.setProtect(e.target.checked)}
                            disabled={f.isBusy}
                          />
                          <span className="d10-sw-ui" />
                          <span>password</span>
                        </label>
                        <label className="d10-sw">
                          <input
                            type="checkbox"
                            checked={f.includeDeletionToken}
                            onChange={(e) =>
                              f.setIncludeDeletionToken(e.target.checked)
                            }
                            disabled={f.isBusy}
                          />
                          <span className="d10-sw-ui" />
                          <span>revoke-key</span>
                        </label>
                      </div>
                    </div>

                    {f.protect && (
                      <div className="d10-pwd">
                        <input
                          type="password"
                          className="d10-input"
                          placeholder="password"
                          value={f.password}
                          onChange={(e) => f.setPassword(e.target.value)}
                          disabled={f.isBusy}
                          autoComplete="new-password"
                        />
                        <input
                          type="password"
                          className="d10-input"
                          placeholder="confirm"
                          value={f.confirmPassword}
                          onChange={(e) => f.setConfirmPassword(e.target.value)}
                          disabled={f.isBusy}
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                    {f.passwordError && (
                      <p className="d10-fielderr">{f.passwordError}</p>
                    )}

                    <button
                      type="submit"
                      className="d10-submit"
                      disabled={f.isBusy || f.url.trim().length === 0}
                    >
                      <span>
                        {f.state === "encrypting"
                          ? "encrypting"
                          : f.state === "uploading"
                            ? "transmitting"
                            : "commit"}
                      </span>
                      <span className="d10-submit-glyph" aria-hidden="true">
                        ▮
                      </span>
                    </button>
                    {f.errorMessage && (
                      <div className="d10-err">{f.errorMessage}</div>
                    )}
                  </form>
                )}

                {f.state === "success" && f.result && (
                  <SlabResult
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

                <div className="d10-footline">
                  <span>VOIDHOP / X.monolith</span>
                  <span>AES-256 · PBKDF2·600K · ZERO-KNOWLEDGE</span>
                </div>
              </div>
              <div className="d10-slab-glow" aria-hidden="true" />
            </div>
            <div className="d10-shadow" aria-hidden="true" />
          </div>
        </main>
      </div>

      <style>{css}</style>
    </>
  );
}

function SlabResult({
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
    <div className="d10-result">
      <div className="d10-result-label">◆ COMMITTED TO THE VOID</div>
      <div className="d10-result-url">{shortUrl}</div>
      <div className="d10-result-actions">
        <button
          type="button"
          className="d10-btn"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
        <button type="button" className="d10-btn d10-btn-ghost" onClick={onAnother}>
          new
        </button>
      </div>
      <dl className="d10-meta">
        <div>
          <dt>expiry</dt>
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
            <dt>uses</dt>
            <dd>{usesLeft === 1 ? "one (self-destruct)" : `${usesLeft}`}</dd>
          </div>
        )}
      </dl>
      {deleteUrl && (
        <div className="d10-revoke">
          <div className="d10-revoke-label">revocation</div>
          <code>{deleteUrl}</code>
        </div>
      )}
      <div className="d10-qr-row">
        <div className="d10-qr" ref={qrRef} aria-label="QR code" />
        <p className="d10-qr-note">
          scan to ferry the cipher
          <br />
          <span>share out of band</span>
        </p>
      </div>
    </div>
  );
}

function StarField() {
  const stars = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    s: Math.random() * 1.4 + 0.3,
    d: Math.random() * 4 + 2,
  }));
  return (
    <>
      {stars.map((s) => (
        <span
          key={s.id}
          className="d10-star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            animationDelay: `${s.d}s`,
          }}
        />
      ))}
    </>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d10-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d10-root {
  position: relative;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 50% 30%, #0b0f22 0%, #030408 55%, #000 100%);
  color: #e6eaff;
  font-family: "Plus Jakarta Sans", ui-sans-serif, sans-serif;
  overflow: hidden;
  isolation: isolate;
}
.d10-grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.25;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.5 0 0 0 0 0.9 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.d10-stars {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.d10-star {
  position: absolute;
  background: #e6eaff;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(230, 234, 255, 0.9);
  animation: d10-twinkle 6s ease-in-out infinite;
}
@keyframes d10-twinkle {
  0%,
  100% {
    opacity: 0.15;
  }
  50% {
    opacity: 0.85;
  }
}
.d10-header {
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 48px;
}
.d10-brand {
  font-family: "Unbounded", sans-serif;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.3em;
  color: #e6eaff;
  text-decoration: none;
  display: inline-flex;
  gap: 4px;
}
.d10-brand span {
  color: #0055ff;
}
.d10-nav {
  font-family: "Unbounded", sans-serif;
  font-weight: 300;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: rgba(230, 234, 255, 0.6);
  text-decoration: none;
}
.d10-nav:hover {
  color: #0055ff;
}
.d10-stage {
  position: relative;
  z-index: 2;
  padding: 40px 40px 80px;
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 100px);
}
.d10-slab-wrap {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  width: 100%;
  max-width: 720px;
}
.d10-slab {
  position: relative;
  background:
    linear-gradient(180deg, #0e0e14 0%, #050509 100%);
  border: 1px solid rgba(85, 107, 255, 0.25);
  border-radius: 0;
  padding: 2px;
  box-shadow:
    inset 0 1px 0 rgba(230, 234, 255, 0.08),
    inset 0 -1px 0 rgba(0, 85, 255, 0.3),
    0 40px 120px rgba(0, 85, 255, 0.18),
    0 2px 0 rgba(0, 85, 255, 0.1);
  transform-style: preserve-3d;
}
.d10-slab-face {
  position: relative;
  padding: 56px 56px 48px;
  background:
    linear-gradient(180deg, rgba(14, 14, 20, 0.9), rgba(5, 5, 9, 0.97)),
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.01) 0 2px,
      transparent 2px 4px
    );
  border-top: 1px solid rgba(230, 234, 255, 0.08);
}
.d10-slab-face::before {
  content: "";
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  bottom: 12px;
  border: 1px solid rgba(230, 234, 255, 0.04);
  pointer-events: none;
}
.d10-slab-glow {
  position: absolute;
  inset: -30px;
  z-index: -1;
  background: radial-gradient(
    ellipse at 50% 100%,
    rgba(0, 85, 255, 0.45) 0%,
    rgba(0, 85, 255, 0.12) 40%,
    transparent 72%
  );
  filter: blur(30px);
  pointer-events: none;
}
.d10-shadow {
  position: absolute;
  bottom: -50px;
  left: 12%;
  right: 12%;
  height: 40px;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.8) 0%,
    transparent 70%
  );
  filter: blur(16px);
  z-index: -2;
}
.d10-mono-title {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 28px;
  font-family: "Unbounded", sans-serif;
  font-weight: 300;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: rgba(230, 234, 255, 0.55);
}
.d10-mono-dot {
  color: #0055ff;
}
.d10-mono-ii {
  color: #0055ff;
  font-weight: 600;
}
.d10-h1 {
  font-family: "Unbounded", sans-serif;
  font-weight: 300;
  font-size: clamp(46px, 6.5vw, 78px);
  line-height: 1;
  letter-spacing: -0.02em;
  margin: 0 0 52px;
  color: #e6eaff;
}
.d10-h1-accent {
  font-weight: 800;
  color: #0055ff;
  text-shadow: 0 0 30px rgba(0, 85, 255, 0.5);
}
.d10-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.d10-row {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid rgba(230, 234, 255, 0.08);
}
.d10-row-i {
  font-family: "Unbounded", sans-serif;
  font-weight: 600;
  color: #0055ff;
  letter-spacing: 0.2em;
  font-size: 11px;
  min-width: 30px;
}
.d10-row-label {
  font-family: "Unbounded", sans-serif;
  font-weight: 300;
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(230, 234, 255, 0.5);
  min-width: 70px;
}
.d10-row-val {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.d10-input {
  background: transparent;
  border: none;
  color: #e6eaff;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 17px;
  padding: 8px 2px;
  outline: none;
  width: 100%;
  border-radius: 0;
}
.d10-input-big {
  font-family: "Unbounded", sans-serif;
  font-weight: 300;
  font-size: clamp(22px, 3vw, 32px);
  letter-spacing: -0.01em;
  padding: 14px 0;
  border-bottom: 1px solid rgba(230, 234, 255, 0.3);
}
.d10-input-big:focus {
  border-bottom-color: #0055ff;
  box-shadow: 0 1px 0 0 #0055ff;
}
.d10-input::placeholder {
  color: rgba(230, 234, 255, 0.25);
}
.d10-select {
  appearance: none;
  background: rgba(230, 234, 255, 0.04);
  border: 1px solid rgba(230, 234, 255, 0.15);
  padding: 10px 28px 10px 14px;
  font-family: "Plus Jakarta Sans", sans-serif;
  color: #e6eaff;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%230055ff' stroke-width='1.5'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  width: auto;
  min-width: 240px;
}
.d10-select option {
  background: #0e0e14;
}
.d10-chip {
  background: transparent;
  border: 1px solid rgba(230, 234, 255, 0.2);
  color: #e6eaff;
  padding: 8px 14px;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: all 0.2s;
}
.d10-chip:hover:not(:disabled) {
  border-color: rgba(0, 85, 255, 0.7);
  color: #e6eaff;
}
.d10-chip.on {
  background: #0055ff;
  border-color: #0055ff;
  color: #fff;
  box-shadow: 0 0 20px rgba(0, 85, 255, 0.6);
}
.d10-sw {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  color: #e6eaff;
  padding-right: 12px;
}
.d10-sw input {
  display: none;
}
.d10-sw-ui {
  position: relative;
  width: 36px;
  height: 18px;
  background: rgba(230, 234, 255, 0.08);
  border: 1px solid rgba(230, 234, 255, 0.2);
  border-radius: 999px;
  transition: all 0.2s;
}
.d10-sw-ui::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: rgba(230, 234, 255, 0.6);
  border-radius: 50%;
  transition: transform 0.2s;
}
.d10-sw input:checked + .d10-sw-ui {
  background: rgba(0, 85, 255, 0.3);
  border-color: #0055ff;
}
.d10-sw input:checked + .d10-sw-ui::after {
  transform: translateX(18px);
  background: #0055ff;
  box-shadow: 0 0 12px #0055ff;
}
.d10-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(230, 234, 255, 0.08);
}
.d10-pwd .d10-input {
  background: rgba(230, 234, 255, 0.04);
  border: 1px solid rgba(230, 234, 255, 0.15);
  padding: 12px 14px;
}
.d10-pwd .d10-input:focus {
  border-color: #0055ff;
  box-shadow: 0 0 0 2px rgba(0, 85, 255, 0.3);
}
@media (max-width: 560px) {
  .d10-pwd {
    grid-template-columns: 1fr;
  }
}
.d10-fielderr {
  color: #ff6b6b;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 13px;
  margin: 0;
  padding: 8px 0;
  font-weight: 500;
}
.d10-submit {
  margin-top: 24px;
  padding: 22px 28px;
  background: #0055ff;
  color: #fff;
  border: none;
  font-family: "Unbounded", sans-serif;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 0 40px rgba(0, 85, 255, 0.5);
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
}
.d10-submit::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: left 0.5s;
}
.d10-submit:hover:not(:disabled)::before {
  left: 100%;
}
.d10-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 0 60px rgba(0, 85, 255, 0.8);
}
.d10-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.d10-submit-glyph {
  color: #fff;
  font-size: 14px;
  letter-spacing: 0;
}
.d10-err {
  margin-top: 14px;
  padding: 14px 16px;
  background: rgba(255, 107, 107, 0.08);
  border: 1px solid rgba(255, 107, 107, 0.4);
  color: #ffb4b4;
  font-size: 14px;
}
.d10-result {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.d10-result-label {
  font-family: "Unbounded", sans-serif;
  font-weight: 600;
  letter-spacing: 0.3em;
  font-size: 12px;
  color: #0055ff;
}
.d10-result-url {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 19px;
  padding: 20px 22px;
  background: rgba(0, 85, 255, 0.06);
  border: 1px solid rgba(0, 85, 255, 0.35);
  color: #fff;
  word-break: break-all;
  line-height: 1.5;
}
.d10-result-actions {
  display: flex;
  gap: 10px;
}
.d10-btn {
  background: #0055ff;
  color: #fff;
  border: none;
  padding: 12px 22px;
  font-family: "Unbounded", sans-serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  cursor: pointer;
}
.d10-btn-ghost {
  background: transparent;
  border: 1px solid rgba(230, 234, 255, 0.25);
  color: #e6eaff;
}
.d10-btn:hover:not(:disabled) {
  filter: brightness(1.15);
}
.d10-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.d10-meta div {
  display: flex;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(230, 234, 255, 0.08);
  font-size: 14px;
}
.d10-meta dt {
  min-width: 90px;
  font-family: "Unbounded", sans-serif;
  font-size: 11px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgba(230, 234, 255, 0.5);
  padding-top: 2px;
}
.d10-meta dd {
  margin: 0;
  color: #e6eaff;
}
.d10-revoke {
  padding: 16px 18px;
  background: rgba(0, 85, 255, 0.06);
  border-left: 3px solid #0055ff;
}
.d10-revoke-label {
  font-family: "Unbounded", sans-serif;
  font-size: 11px;
  letter-spacing: 0.25em;
  color: #0055ff;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.d10-revoke code {
  word-break: break-all;
  font-size: 13px;
  color: rgba(230, 234, 255, 0.9);
}
.d10-qr-row {
  display: flex;
  align-items: center;
  gap: 22px;
}
.d10-qr {
  padding: 10px;
  background: #fff;
}
.d10-qr img {
  display: block;
  image-rendering: pixelated;
}
.d10-qr-note {
  font-family: "Plus Jakarta Sans", sans-serif;
  margin: 0;
  font-size: 14px;
  color: rgba(230, 234, 255, 0.85);
  line-height: 1.5;
}
.d10-qr-note span {
  color: rgba(230, 234, 255, 0.5);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-family: "Unbounded", sans-serif;
}
.d10-footline {
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid rgba(230, 234, 255, 0.08);
  display: flex;
  justify-content: space-between;
  font-family: "Unbounded", sans-serif;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(230, 234, 255, 0.35);
  gap: 14px;
  flex-wrap: wrap;
}
`;
