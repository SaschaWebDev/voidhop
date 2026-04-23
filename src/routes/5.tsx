import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/5")({
  component: Design5,
});

function Design5() {
  const f = useShortenForm();

  return (
    <>
      <FontLoader />
      <div className="d5-root">
        <div className="d5-parchment" aria-hidden="true" />

        <header className="d5-header">
          <Link to="/" className="d5-brand">
            <Sigil small />
            <span className="d5-brand-text">VOIDHOP</span>
          </Link>
          <Link to="/designs" className="d5-nav">
            Index
          </Link>
        </header>

        <main className="d5-main">
          <div className="d5-folio">
            <p className="d5-eye">Folio V · Ars Obscura</p>
            <h1 className="d5-title">
              De Urbis
              <br />
              <span className="d5-title-frak">Occultatione</span>
            </h1>
            <Rule />
            <p className="d5-lede">
              <span className="d5-dropcap">B</span>ring forth a URL; it shall
              be wound into cipher by thine own browser ere it departs.{" "}
              <em>
                The Vessel holds only the shadow of the message — never its
                substance.
              </em>
            </p>

            {f.state !== "success" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
                className="d5-form"
              >
                <div className="d5-sigil-wrap">
                  <Sigil active={f.isBusy} />
                </div>

                <Section roman="I" title="The Address" />
                <input
                  type="url"
                  className="d5-input"
                  placeholder="https://…"
                  value={f.url}
                  onChange={(e) => f.onUrlChange(e.target.value)}
                  disabled={f.isBusy}
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  required
                />
                {f.inputError && (
                  <p className="d5-fielderr">☙ {f.inputError}</p>
                )}

                <Section roman="II" title="The Span" />
                <div className="d5-ttl">
                  {TTL_OPTIONS.map((o) => (
                    <button
                      key={o.seconds}
                      type="button"
                      className={`d5-ttl-btn ${f.ttl === o.seconds ? "on" : ""}`}
                      onClick={() => f.setTtl(o.seconds)}
                      disabled={f.isBusy}
                    >
                      <span className="d5-ttl-roman">
                        {romanize(o.seconds)}
                      </span>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>

                <Section roman="III" title="The Readings" />
                <select
                  className="d5-input d5-select"
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

                <Section roman="IV" title="The Warding" />
                <label className="d5-check">
                  <input
                    type="checkbox"
                    checked={f.protect}
                    onChange={(e) => f.setProtect(e.target.checked)}
                    disabled={f.isBusy}
                  />
                  <span>Bind it with a pass-phrase</span>
                </label>
                {f.protect && (
                  <div className="d5-pwd">
                    <input
                      type="password"
                      className="d5-input"
                      placeholder="pass-phrase"
                      value={f.password}
                      onChange={(e) => f.setPassword(e.target.value)}
                      disabled={f.isBusy}
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      className="d5-input"
                      placeholder="speak again"
                      value={f.confirmPassword}
                      onChange={(e) => f.setConfirmPassword(e.target.value)}
                      disabled={f.isBusy}
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {f.passwordError && (
                  <p className="d5-fielderr">☙ {f.passwordError}</p>
                )}

                <Section roman="V" title="The Undoing" />
                <label className="d5-check">
                  <input
                    type="checkbox"
                    checked={f.includeDeletionToken}
                    onChange={(e) =>
                      f.setIncludeDeletionToken(e.target.checked)
                    }
                    disabled={f.isBusy}
                  />
                  <span>Grant me a key to unmake it</span>
                </label>

                <button
                  type="submit"
                  className="d5-submit"
                  disabled={f.isBusy || f.url.trim().length === 0}
                >
                  <span className="d5-submit-orn">☤</span>
                  <span>
                    {f.state === "encrypting"
                      ? "Inscribing…"
                      : f.state === "uploading"
                        ? "Committing to the Vessel…"
                        : "Seal & Dispatch"}
                  </span>
                  <span className="d5-submit-orn">☤</span>
                </button>

                {f.errorMessage && (
                  <div className="d5-err">
                    <span className="d5-err-icon">☠</span>
                    <div>
                      <strong>The rite is broken.</strong>
                      <br />
                      {f.errorMessage}
                    </div>
                  </div>
                )}
              </form>
            )}

            {f.state === "success" && f.result && (
              <SealResult
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

        <footer className="d5-footer">
          <span>V · X</span>
          <span className="d5-footer-mid">Hermetic Cipher</span>
          <span>MMXXVI</span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function Section({ roman, title }: { roman: string; title: string }) {
  return (
    <div className="d5-section">
      <span className="d5-section-roman">{roman}.</span>
      <span className="d5-section-title">{title}</span>
      <span className="d5-section-rule" aria-hidden="true" />
    </div>
  );
}

function Rule() {
  return (
    <div className="d5-rule" aria-hidden="true">
      <span>✧</span>
      <span className="d5-rule-line" />
      <span>✦</span>
      <span className="d5-rule-line" />
      <span>✧</span>
    </div>
  );
}

function Sigil({
  small = false,
  active = false,
}: {
  small?: boolean;
  active?: boolean;
}) {
  return (
    <svg
      className={`d5-sigil ${small ? "d5-sigil-sm" : ""} ${active ? "d5-sigil-active" : ""}`}
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      <g stroke="currentColor" fill="none" strokeWidth="1">
        <circle cx="100" cy="100" r="90" />
        <circle cx="100" cy="100" r="72" opacity="0.7" />
        <circle cx="100" cy="100" r="52" opacity="0.5" />
        <path
          d="M100 10 L190 100 L100 190 L10 100 Z"
          strokeWidth="0.75"
          opacity="0.7"
        />
        <path
          d="M40 40 L160 160 M160 40 L40 160"
          strokeWidth="0.5"
          opacity="0.35"
        />
        <circle cx="100" cy="100" r="24" strokeWidth="1.5" />
        <text
          x="100"
          y="107"
          textAnchor="middle"
          fontFamily="UnifrakturMaguntia, serif"
          fontSize="28"
          fill="currentColor"
          stroke="none"
        >
          V
        </text>
      </g>
      <g className="d5-sigil-runes">
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x = 100 + Math.cos(rad) * 82;
          const y = 100 + Math.sin(rad) * 82;
          const glyph = ["☿", "♃", "♄", "♂", "♀", "☉"][i];
          return (
            <text
              key={deg}
              x={x}
              y={y + 5}
              textAnchor="middle"
              fontFamily="Cinzel, serif"
              fontSize="14"
              fill="currentColor"
            >
              {glyph}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

function romanize(seconds: number): string {
  if (seconds === 3600) return "I";
  if (seconds === 86400) return "XXIV";
  if (seconds === 604800) return "VII";
  return "";
}

function SealResult({
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
    <div className="d5-seal-card">
      <div className="d5-seal-wax">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <radialGradient id="wax5" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#c9241a" />
              <stop offset="55%" stopColor="#8b0000" />
              <stop offset="100%" stopColor="#3d0000" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="54" fill="url(#wax5)" />
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke="#3d0000"
            strokeWidth="1"
            opacity="0.5"
          />
          <text
            x="60"
            y="72"
            textAnchor="middle"
            fontFamily="UnifrakturMaguntia, serif"
            fontSize="48"
            fill="#fce8c8"
          >
            V
          </text>
        </svg>
      </div>
      <p className="d5-seal-flourish">
        <em>Sealed, and sent forth.</em>
      </p>
      <div className="d5-seal-url">{shortUrl}</div>
      <div className="d5-seal-actions">
        <button
          type="button"
          className="d5-btn"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "Copied" : "Take a copy"}
        </button>
        <button type="button" className="d5-btn d5-btn-ghost" onClick={onAnother}>
          Another rite
        </button>
      </div>
      <dl className="d5-seal-meta">
        <div>
          <dt>Expiry</dt>
          <dd>{expiry}</dd>
        </div>
        {passwordProtected && (
          <div>
            <dt>Warding</dt>
            <dd>bound by pass-phrase</dd>
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <dt>Readings</dt>
            <dd>
              {usesLeft === 1
                ? "shall be consumed on first reading"
                : `${usesLeft} readings hence`}
            </dd>
          </div>
        )}
      </dl>
      {deleteUrl && (
        <div className="d5-revoke">
          <div className="d5-revoke-title">Key of Unmaking</div>
          <code>{deleteUrl}</code>
        </div>
      )}
      <div className="d5-qr-row">
        <div className="d5-qr" ref={qrRef} aria-label="QR code" />
        <p>
          <em>A likeness of the key, struck in pitch.</em>
        </p>
      </div>
    </div>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d5-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;800&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=UnifrakturMaguntia&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d5-root {
  position: relative;
  min-height: 100vh;
  background: #e8dcc0;
  color: #3a2817;
  font-family: "EB Garamond", Georgia, serif;
  font-size: 18px;
  line-height: 1.7;
  overflow-x: hidden;
}
.d5-parchment {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 25%, rgba(184, 134, 11, 0.12), transparent 60%),
    radial-gradient(circle at 18% 90%, rgba(139, 0, 0, 0.08), transparent 55%),
    radial-gradient(circle at 90% 70%, rgba(58, 40, 23, 0.08), transparent 55%);
}
.d5-parchment::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='3'/><feColorMatrix values='0 0 0 0 0.23 0 0 0 0 0.16 0 0 0 0 0.09 0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.22;
  mix-blend-mode: multiply;
}
.d5-root > header,
.d5-root > main,
.d5-root > footer {
  position: relative;
  z-index: 1;
}
.d5-header {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 56px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(58, 40, 23, 0.4);
}
.d5-brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: #3a2817;
  text-decoration: none;
}
.d5-brand-text {
  font-family: "Cinzel", serif;
  font-weight: 600;
  letter-spacing: 0.3em;
  font-size: 18px;
  color: #3a2817;
}
.d5-nav {
  font-family: "Cinzel", serif;
  font-weight: 500;
  letter-spacing: 0.25em;
  font-size: 13px;
  color: #8b0000;
  text-decoration: none;
  padding: 8px 16px;
  border: 1px solid rgba(139, 0, 0, 0.5);
}
.d5-nav:hover {
  background: rgba(139, 0, 0, 0.08);
}
.d5-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 36px 56px 40px;
}
.d5-folio {
  background:
    linear-gradient(180deg, rgba(253, 246, 225, 0.6), rgba(253, 246, 225, 0.35));
  padding: 60px 64px;
  border: 1px solid rgba(58, 40, 23, 0.45);
  box-shadow:
    inset 0 0 60px rgba(58, 40, 23, 0.15),
    0 20px 60px rgba(58, 40, 23, 0.18);
  position: relative;
}
.d5-folio::before,
.d5-folio::after {
  content: "";
  position: absolute;
  top: 18px;
  bottom: 18px;
  width: 1px;
  background: rgba(184, 134, 11, 0.5);
}
.d5-folio::before {
  left: 18px;
}
.d5-folio::after {
  right: 18px;
}
.d5-eye {
  font-family: "Cinzel", serif;
  text-align: center;
  letter-spacing: 0.4em;
  font-size: 12px;
  color: #b8860b;
  margin: 0 0 16px;
  text-transform: uppercase;
}
.d5-title {
  text-align: center;
  font-family: "Cinzel", serif;
  font-weight: 400;
  font-size: clamp(48px, 7vw, 78px);
  line-height: 1.02;
  margin: 0 0 12px;
  color: #3a2817;
  letter-spacing: 0.02em;
}
.d5-title-frak {
  font-family: "UnifrakturMaguntia", serif;
  color: #8b0000;
  font-size: 1.15em;
  letter-spacing: 0.02em;
}
.d5-rule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 24px 0 32px;
  color: #b8860b;
  font-size: 14px;
}
.d5-rule-line {
  width: 80px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    #b8860b 30%,
    #b8860b 70%,
    transparent
  );
}
.d5-lede {
  font-size: 19px;
  line-height: 1.75;
  color: #3a2817;
  margin: 0 0 36px;
  text-align: justify;
  hyphens: auto;
}
.d5-lede em {
  color: #8b0000;
  font-style: italic;
}
.d5-dropcap {
  float: left;
  font-family: "UnifrakturMaguntia", serif;
  font-size: 78px;
  line-height: 0.85;
  color: #8b0000;
  padding: 6px 10px 0 0;
  margin-top: 4px;
}
.d5-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
}
.d5-sigil-wrap {
  display: flex;
  justify-content: center;
  margin: 8px 0 24px;
  color: #8b0000;
}
.d5-sigil {
  width: 140px;
  height: 140px;
  color: #8b0000;
  opacity: 0.85;
}
.d5-sigil-sm {
  width: 32px;
  height: 32px;
  opacity: 1;
}
.d5-sigil-runes {
  transform-origin: 100px 100px;
  animation: d5-rotate 32s linear infinite;
}
.d5-sigil-active .d5-sigil-runes {
  animation: d5-rotate 3s linear infinite;
}
.d5-sigil-active {
  filter: drop-shadow(0 0 14px rgba(139, 0, 0, 0.7));
}
@keyframes d5-rotate {
  from {
    transform: rotate(0deg);
    transform-origin: 100px 100px;
  }
  to {
    transform: rotate(360deg);
    transform-origin: 100px 100px;
  }
}
.d5-section {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin: 20px 0 4px;
  font-family: "Cinzel", serif;
  letter-spacing: 0.15em;
  color: #8b0000;
}
.d5-section-roman {
  font-weight: 600;
  font-size: 14px;
  color: #b8860b;
  min-width: 36px;
}
.d5-section-title {
  font-weight: 500;
  font-size: 14px;
  text-transform: uppercase;
}
.d5-section-rule {
  flex: 1;
  height: 1px;
  background: rgba(139, 0, 0, 0.3);
}
.d5-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(58, 40, 23, 0.5);
  color: #3a2817;
  padding: 10px 4px;
  font-family: "EB Garamond", serif;
  font-size: 19px;
  outline: none;
  border-radius: 0;
}
.d5-input:focus {
  border-bottom-color: #8b0000;
  box-shadow: 0 1px 0 0 #8b0000;
}
.d5-input::placeholder {
  color: rgba(58, 40, 23, 0.4);
  font-style: italic;
}
.d5-select {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='10'><path d='M2 2 L7 8 L12 2' fill='none' stroke='%238b0000' stroke-width='1.4'/></svg>");
  background-repeat: no-repeat;
  background-position: right 4px center;
  padding-right: 28px;
}
.d5-ttl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
@media (max-width: 620px) {
  .d5-ttl {
    grid-template-columns: 1fr;
  }
}
.d5-ttl-btn {
  background: rgba(253, 246, 225, 0.5);
  border: 1px solid rgba(58, 40, 23, 0.4);
  padding: 14px 16px;
  cursor: pointer;
  font-family: "EB Garamond", serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.d5-ttl-btn:hover:not(:disabled) {
  background: rgba(139, 0, 0, 0.06);
  border-color: rgba(139, 0, 0, 0.6);
}
.d5-ttl-btn.on {
  background: #8b0000;
  border-color: #8b0000;
  color: #fce8c8;
}
.d5-ttl-roman {
  font-family: "Cinzel", serif;
  font-weight: 600;
  letter-spacing: 0.15em;
  font-size: 14px;
  color: #b8860b;
}
.d5-ttl-btn.on .d5-ttl-roman {
  color: #fce8c8;
}
.d5-check {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  font-family: "EB Garamond", serif;
  font-size: 19px;
  color: #3a2817;
  font-style: italic;
  width: fit-content;
}
.d5-check input {
  width: 18px;
  height: 18px;
  accent-color: #8b0000;
}
.d5-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}
@media (max-width: 620px) {
  .d5-pwd {
    grid-template-columns: 1fr;
  }
}
.d5-fielderr {
  color: #8b0000;
  font-style: italic;
  margin: 4px 0 0;
  font-size: 16px;
}
.d5-submit {
  margin-top: 24px;
  padding: 22px;
  background: linear-gradient(180deg, #a01423, #8b0000 70%, #6b0000);
  color: #fce8c8;
  border: 1px solid #3d0000;
  font-family: "Cinzel", serif;
  font-weight: 500;
  font-size: 18px;
  letter-spacing: 0.18em;
  cursor: pointer;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  box-shadow:
    inset 0 1px 0 rgba(252, 232, 200, 0.2),
    0 8px 20px rgba(58, 40, 23, 0.3);
}
.d5-submit:hover:not(:disabled) {
  background: linear-gradient(180deg, #b8142a, #9b0000 70%, #7b0000);
}
.d5-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.d5-submit-orn {
  color: #fce8c8;
  font-size: 20px;
  opacity: 0.85;
}
.d5-err {
  margin-top: 14px;
  padding: 14px 18px;
  display: flex;
  gap: 14px;
  background: rgba(139, 0, 0, 0.08);
  border: 1px solid rgba(139, 0, 0, 0.4);
  font-family: "EB Garamond", serif;
  font-size: 16px;
  color: #3a2817;
}
.d5-err-icon {
  color: #8b0000;
  font-size: 24px;
}
.d5-seal-card {
  background:
    linear-gradient(180deg, rgba(253, 246, 225, 0.6), rgba(253, 246, 225, 0.35));
  border: 1px solid rgba(58, 40, 23, 0.45);
  padding: 50px 50px 44px;
  position: relative;
  box-shadow:
    inset 0 0 40px rgba(58, 40, 23, 0.1),
    0 20px 50px rgba(58, 40, 23, 0.2);
}
.d5-seal-wax {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%) rotate(-8deg);
  width: 120px;
  height: 120px;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
}
.d5-seal-flourish {
  margin-top: 60px;
  text-align: center;
  font-family: "Cinzel", serif;
  letter-spacing: 0.2em;
  color: #b8860b;
  font-size: 13px;
  margin-bottom: 24px;
}
.d5-seal-flourish em {
  font-style: italic;
  color: #8b0000;
  font-family: "EB Garamond", serif;
  font-size: 22px;
  letter-spacing: 0.02em;
  display: block;
  margin-top: 4px;
}
.d5-seal-url {
  background: rgba(253, 246, 225, 0.6);
  border: 1px dashed rgba(139, 0, 0, 0.5);
  padding: 20px 24px;
  font-family: "EB Garamond", serif;
  font-size: 20px;
  color: #3a2817;
  word-break: break-all;
  margin-bottom: 22px;
  line-height: 1.5;
}
.d5-seal-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 26px;
}
.d5-btn {
  background: #8b0000;
  color: #fce8c8;
  border: 1px solid #3d0000;
  padding: 10px 20px;
  font-family: "Cinzel", serif;
  font-size: 14px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.d5-btn-ghost {
  background: transparent;
  color: #8b0000;
  border-color: #8b0000;
}
.d5-btn:hover:not(:disabled) {
  background: #a01423;
  color: #fce8c8;
  border-color: #3d0000;
}
.d5-seal-meta {
  margin: 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: "EB Garamond", serif;
  font-size: 17px;
}
.d5-seal-meta div {
  display: flex;
  gap: 14px;
}
.d5-seal-meta dt {
  min-width: 110px;
  color: #8b0000;
  font-family: "Cinzel", serif;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding-top: 3px;
}
.d5-seal-meta dd {
  margin: 0;
  font-style: italic;
}
.d5-revoke {
  padding: 16px 20px;
  border-left: 3px solid #8b0000;
  background: rgba(139, 0, 0, 0.06);
  margin-bottom: 20px;
}
.d5-revoke-title {
  font-family: "Cinzel", serif;
  letter-spacing: 0.2em;
  color: #8b0000;
  font-size: 12px;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.d5-revoke code {
  word-break: break-all;
  font-family: "EB Garamond", serif;
  font-size: 14px;
  color: #3a2817;
}
.d5-qr-row {
  display: flex;
  align-items: center;
  gap: 22px;
  padding-top: 22px;
  border-top: 1px dashed rgba(58, 40, 23, 0.4);
}
.d5-qr {
  padding: 8px;
  background: rgba(253, 246, 225, 0.6);
  border: 1px solid rgba(58, 40, 23, 0.45);
}
.d5-qr img {
  display: block;
  image-rendering: pixelated;
  mix-blend-mode: multiply;
}
.d5-qr-row p {
  margin: 0;
  font-family: "EB Garamond", serif;
  font-size: 18px;
}
.d5-qr-row em {
  color: #8b0000;
  font-style: italic;
}
.d5-footer {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 56px 40px;
  display: flex;
  justify-content: space-between;
  font-family: "Cinzel", serif;
  letter-spacing: 0.25em;
  font-size: 11px;
  color: #8b0000;
  text-transform: uppercase;
}
.d5-footer-mid {
  color: #b8860b;
}
`;
