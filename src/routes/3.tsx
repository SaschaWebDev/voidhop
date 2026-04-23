import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/3")({
  component: Design3,
});

function Design3() {
  const f = useShortenForm();

  return (
    <>
      <FontLoader />
      <div className="d3-root">
        <div className="d3-paper" aria-hidden="true" />
        <RabbitSilhouette />

        <header className="d3-header">
          <Link to="/" className="d3-brand">
            VoidHop
          </Link>
          <nav className="d3-nav">
            <span className="d3-roman">III</span>
            <Link to="/designs" className="d3-navlink">
              the other plates
            </Link>
          </nav>
        </header>

        <main className="d3-main">
          <div className="d3-frame">
            <OrnamentCorners />
            <p className="d3-kicker">— A CURIOUS COMPENDIUM —</p>
            <h1 className="d3-title">
              <span className="d3-dropcap">T</span>he Rabbit's
              <br />
              <em>Hasty Missive</em>
            </h1>
            <p className="d3-hairline" />
            <p className="d3-lede">
              Herein a URL is enciphered, folded, and sent down the rabbit-hole
              so that none but its rightful bearer may read it.
              <em> The Host learns nothing.</em>
            </p>

            {f.state !== "success" && (
              <form
                className="d3-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
              >
                <div className="d3-field">
                  <label className="d3-label">I. Thy URL</label>
                  <input
                    type="url"
                    className="d3-input"
                    placeholder="https://…"
                    value={f.url}
                    onChange={(e) => f.onUrlChange(e.target.value)}
                    disabled={f.isBusy}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    required
                  />
                  {f.inputError && (
                    <p className="d3-fielderr">‡ {f.inputError}</p>
                  )}
                </div>

                <div className="d3-row">
                  <div className="d3-field">
                    <label className="d3-label">II. Duration</label>
                    <div className="d3-ttl">
                      {TTL_OPTIONS.map((o) => (
                        <button
                          key={o.seconds}
                          type="button"
                          className={`d3-ttl-opt ${f.ttl === o.seconds ? "on" : ""}`}
                          onClick={() => f.setTtl(o.seconds)}
                          disabled={f.isBusy}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="d3-field">
                    <label className="d3-label">III. Readings</label>
                    <select
                      className="d3-input"
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
                  </div>
                </div>

                <div className="d3-field">
                  <label className="d3-check">
                    <input
                      type="checkbox"
                      checked={f.protect}
                      onChange={(e) => f.setProtect(e.target.checked)}
                      disabled={f.isBusy}
                    />
                    <span>Guard it with a watchword</span>
                  </label>
                  {f.protect && (
                    <div className="d3-pwd">
                      <input
                        type="password"
                        className="d3-input"
                        placeholder="watchword"
                        value={f.password}
                        onChange={(e) => f.setPassword(e.target.value)}
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        className="d3-input"
                        placeholder="repeated, lest it be forgot"
                        value={f.confirmPassword}
                        onChange={(e) => f.setConfirmPassword(e.target.value)}
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                    </div>
                  )}
                  {f.passwordError && (
                    <p className="d3-fielderr">‡ {f.passwordError}</p>
                  )}
                </div>

                <div className="d3-field">
                  <label className="d3-check">
                    <input
                      type="checkbox"
                      checked={f.includeDeletionToken}
                      onChange={(e) =>
                        f.setIncludeDeletionToken(e.target.checked)
                      }
                      disabled={f.isBusy}
                    />
                    <span>Keep a key to revoke it</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="d3-submit"
                  disabled={f.isBusy || f.url.trim().length === 0}
                >
                  <span className="d3-submit-sep">❦</span>
                  <span>
                    {f.state === "encrypting"
                      ? "Enciphering…"
                      : f.state === "uploading"
                        ? "Entrusting to the rabbit…"
                        : "Send it down the hole"}
                  </span>
                  <span className="d3-submit-sep">❦</span>
                </button>

                {f.errorMessage && (
                  <p className="d3-err">
                    <em>A misfortune:</em> {f.errorMessage}
                  </p>
                )}
              </form>
            )}

            {f.state === "success" && f.result && (
              <TarotResult
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
            <OrnamentCorners bottom />
          </div>
        </main>

        <footer className="d3-footer">
          <em>Plate III of X · Wonderland Gothic</em>
          <Link to="/" className="d3-footer-link">
            ← Return to the study
          </Link>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function TarotResult({
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
    <div className="d3-tarot">
      <div className="d3-tarot-header">
        <span>✦</span>
        <span>THE SEALED LETTER</span>
        <span>✦</span>
      </div>
      <div className="d3-tarot-body">
        <div className="d3-tarot-url">{shortUrl}</div>
        <div className="d3-tarot-actions">
          <button
            type="button"
            className="d3-btn"
            onClick={async () => {
              if (await copyToClipboard(shortUrl)) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? "Copied" : "Take a copy"}
          </button>
          <button type="button" className="d3-btn d3-btn-ghost" onClick={onAnother}>
            Write another
          </button>
        </div>
        <div className="d3-tarot-facts">
          <p>
            <em>Expires</em> {expiry}
          </p>
          {passwordProtected && (
            <p>
              <em>Sealed</em> with a watchword — share it separately
            </p>
          )}
          {usesLeft !== undefined && (
            <p>
              <em>Readings</em>{" "}
              {usesLeft === 1
                ? "it shall burn after a single reading"
                : `${usesLeft} readings remain before it is consumed`}
            </p>
          )}
        </div>
        {deleteUrl && (
          <div className="d3-seal">
            <div className="d3-seal-wax">R</div>
            <div className="d3-seal-text">
              <p className="d3-seal-title">Key of Revocation</p>
              <code>{deleteUrl}</code>
              <p className="d3-seal-note">
                Guard this dearly — it undoes the letter at any hour.
              </p>
            </div>
          </div>
        )}
        <div className="d3-qr-row">
          <div className="d3-qr" ref={qrRef} aria-label="QR code" />
          <div className="d3-qr-note">
            <p>A portrait of the key, for pockets and pilgrims.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrnamentCorners({ bottom }: { bottom?: boolean }) {
  const flip = bottom ? " d3-orn-bot" : "";
  return (
    <>
      <svg
        className={`d3-orn d3-orn-tl${flip}`}
        viewBox="0 0 60 60"
        aria-hidden="true"
      >
        <path
          d="M2 58 V20 Q2 2 20 2 H58"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M8 58 V24 Q8 8 24 8 H58"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.7"
        />
        <circle cx="20" cy="20" r="2.5" fill="currentColor" />
        <path
          d="M14 14 Q24 8 34 14 M14 14 Q8 24 14 34"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.65"
        />
      </svg>
      <svg
        className={`d3-orn d3-orn-tr${flip}`}
        viewBox="0 0 60 60"
        aria-hidden="true"
      >
        <path
          d="M58 58 V20 Q58 2 40 2 H2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M52 58 V24 Q52 8 36 8 H2"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.7"
        />
        <circle cx="40" cy="20" r="2.5" fill="currentColor" />
        <path
          d="M46 14 Q36 8 26 14 M46 14 Q52 24 46 34"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.65"
        />
      </svg>
    </>
  );
}

function RabbitSilhouette() {
  return (
    <svg
      className="d3-rabbit"
      viewBox="0 0 200 260"
      aria-hidden="true"
    >
      <g fill="currentColor" opacity="0.08">
        <ellipse cx="75" cy="60" rx="18" ry="50" />
        <ellipse cx="125" cy="60" rx="18" ry="50" />
        <circle cx="100" cy="150" r="55" />
        <ellipse cx="100" cy="220" rx="70" ry="35" />
      </g>
      <circle cx="100" cy="140" r="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d3-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,700;1,400;1,500&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d3-root {
  position: relative;
  min-height: 100vh;
  background: #f1e9d8;
  color: #2b1b17;
  font-family: "Crimson Pro", Georgia, serif;
  font-size: 17px;
  line-height: 1.7;
  overflow-x: hidden;
}
.d3-paper {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 30%, rgba(107, 15, 26, 0.05), transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(169, 132, 53, 0.06), transparent 40%);
}
.d3-paper::after {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.14;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3'/><feColorMatrix values='0 0 0 0 0.17 0 0 0 0 0.10 0 0 0 0 0.09 0 0 0 0.8 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.d3-rabbit {
  position: absolute;
  top: 180px;
  right: -50px;
  width: 320px;
  height: 420px;
  color: #6b0f1a;
  z-index: 1;
  pointer-events: none;
  transform: rotate(-6deg);
}
.d3-root > header,
.d3-root > main,
.d3-root > footer {
  position: relative;
  z-index: 2;
}
.d3-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 28px 48px 18px;
  border-bottom: 1px solid rgba(107, 15, 26, 0.25);
  max-width: 880px;
  margin: 0 auto;
}
.d3-brand {
  font-family: "Cormorant Garamond", serif;
  font-size: 30px;
  font-weight: 500;
  font-style: italic;
  color: #6b0f1a;
  text-decoration: none;
  letter-spacing: 0.02em;
}
.d3-nav {
  display: flex;
  gap: 20px;
  align-items: baseline;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
}
.d3-roman {
  color: #a98435;
  font-size: 22px;
  letter-spacing: 0.15em;
}
.d3-navlink {
  color: #6b0f1a;
  text-decoration: none;
  border-bottom: 1px solid rgba(107, 15, 26, 0.4);
}
.d3-navlink:hover {
  border-bottom-color: #6b0f1a;
}
.d3-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 48px 48px 60px;
}
.d3-frame {
  position: relative;
  padding: 80px 72px 60px;
  border: 1px solid rgba(107, 15, 26, 0.4);
  background: rgba(253, 248, 237, 0.6);
  box-shadow:
    0 0 0 6px #f1e9d8,
    0 0 0 7px rgba(107, 15, 26, 0.25);
}
.d3-orn {
  position: absolute;
  width: 72px;
  height: 72px;
  color: #6b0f1a;
}
.d3-orn-tl {
  top: 12px;
  left: 12px;
}
.d3-orn-tr {
  top: 12px;
  right: 12px;
}
.d3-orn-tl.d3-orn-bot {
  top: auto;
  bottom: 12px;
  left: 12px;
  transform: scaleY(-1);
}
.d3-orn-tr.d3-orn-bot {
  top: auto;
  bottom: 12px;
  right: 12px;
  transform: scaleY(-1);
}
.d3-kicker {
  text-align: center;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  letter-spacing: 0.3em;
  color: #a98435;
  font-size: 13px;
  margin: 0 0 16px;
}
.d3-title {
  text-align: center;
  font-family: "Cormorant Garamond", serif;
  font-weight: 500;
  font-size: clamp(48px, 7vw, 80px);
  line-height: 1.02;
  margin: 0;
  color: #2b1b17;
}
.d3-title em {
  font-style: italic;
  color: #6b0f1a;
  font-weight: 500;
}
.d3-dropcap {
  font-size: 1.1em;
  color: #6b0f1a;
}
.d3-hairline {
  margin: 28px auto;
  width: 220px;
  height: 0;
  border: none;
  border-top: 1px solid rgba(107, 15, 26, 0.6);
  position: relative;
}
.d3-hairline::before {
  content: "❦";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fdf8ed;
  color: #a98435;
  padding: 0 12px;
  font-size: 14px;
}
.d3-lede {
  text-align: center;
  font-size: 19px;
  max-width: 500px;
  margin: 0 auto 40px;
  color: #3a2a24;
  line-height: 1.65;
}
.d3-lede em {
  color: #6b0f1a;
  font-style: italic;
}
.d3-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.d3-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.d3-label {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 20px;
  color: #6b0f1a;
  letter-spacing: 0.02em;
}
.d3-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(107, 15, 26, 0.5);
  color: #2b1b17;
  padding: 8px 2px 10px;
  font-family: "Crimson Pro", serif;
  font-size: 19px;
  outline: none;
  border-radius: 0;
}
.d3-input:focus {
  border-bottom-color: #6b0f1a;
  box-shadow: 0 1px 0 0 #6b0f1a;
}
.d3-fielderr {
  color: #6b0f1a;
  font-style: italic;
  font-size: 15px;
  margin: 0;
}
.d3-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
@media (max-width: 620px) {
  .d3-row {
    grid-template-columns: 1fr;
  }
}
.d3-ttl {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.d3-ttl-opt {
  background: transparent;
  border: 1px solid rgba(107, 15, 26, 0.4);
  color: #2b1b17;
  padding: 8px 14px;
  cursor: pointer;
  font-family: "Crimson Pro", serif;
  font-size: 16px;
  transition: all 0.2s;
}
.d3-ttl-opt:hover:not(:disabled) {
  background: rgba(107, 15, 26, 0.07);
}
.d3-ttl-opt.on {
  background: #6b0f1a;
  color: #f5e9d0;
  border-color: #6b0f1a;
}
select.d3-input {
  padding: 8px 2px 10px;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%236b0f1a'/></svg>");
  background-repeat: no-repeat;
  background-position: right 2px center;
  padding-right: 20px;
}
.d3-check {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 20px;
  color: #6b0f1a;
  cursor: pointer;
  width: fit-content;
}
.d3-check input {
  accent-color: #6b0f1a;
  width: 16px;
  height: 16px;
}
.d3-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}
@media (max-width: 620px) {
  .d3-pwd {
    grid-template-columns: 1fr;
  }
}
.d3-submit {
  margin-top: 12px;
  background: #6b0f1a;
  color: #f5e9d0;
  border: none;
  padding: 20px 32px;
  font-family: "Cormorant Garamond", serif;
  font-size: 22px;
  font-style: italic;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(245, 233, 208, 0.15),
    0 4px 0 0 #3d0810;
  transition: transform 0.1s;
}
.d3-submit:hover:not(:disabled) {
  transform: translateY(-1px);
}
.d3-submit:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: inset 0 0 0 1px rgba(245, 233, 208, 0.15), 0 1px 0 0 #3d0810;
}
.d3-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.d3-submit-sep {
  color: #a98435;
  font-size: 18px;
}
.d3-err {
  color: #6b0f1a;
  font-style: italic;
  font-size: 17px;
  margin: 12px 0 0;
  padding: 14px 18px;
  background: rgba(107, 15, 26, 0.08);
  border-left: 3px solid #6b0f1a;
}
.d3-tarot {
  margin-top: 8px;
  background: #fdf8ed;
  border: 1px solid rgba(107, 15, 26, 0.4);
  padding: 0;
  box-shadow:
    0 0 0 6px #f1e9d8,
    0 0 0 7px rgba(107, 15, 26, 0.5),
    0 30px 60px rgba(43, 27, 23, 0.2);
}
.d3-tarot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 36px;
  background: #6b0f1a;
  color: #f5e9d0;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 14px;
  letter-spacing: 0.3em;
}
.d3-tarot-body {
  padding: 40px 40px 36px;
}
.d3-tarot-url {
  font-family: "Cormorant Garamond", serif;
  font-size: 22px;
  color: #2b1b17;
  word-break: break-all;
  padding: 22px 24px;
  background: rgba(169, 132, 53, 0.08);
  border: 1px dashed rgba(107, 15, 26, 0.4);
  margin-bottom: 20px;
  line-height: 1.55;
}
.d3-tarot-actions {
  display: flex;
  gap: 14px;
  margin-bottom: 24px;
}
.d3-btn {
  background: #6b0f1a;
  color: #f5e9d0;
  border: 1px solid #6b0f1a;
  padding: 10px 20px;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 18px;
  cursor: pointer;
}
.d3-btn-ghost {
  background: transparent;
  color: #6b0f1a;
}
.d3-btn:hover:not(:disabled) {
  background: #8b1423;
  color: #f5e9d0;
  border-color: #8b1423;
}
.d3-tarot-facts p {
  margin: 0 0 6px;
  font-size: 17px;
  color: #3a2a24;
}
.d3-tarot-facts em {
  color: #6b0f1a;
  font-style: italic;
  margin-right: 10px;
}
.d3-seal {
  margin-top: 24px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 22px;
  background: rgba(107, 15, 26, 0.06);
  border-left: 3px solid #6b0f1a;
}
.d3-seal-wax {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, #a01423 0%, #6b0f1a 55%, #3d0810 100%);
  color: #f5e9d0;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 -6px 10px rgba(0, 0, 0, 0.4),
    inset 0 4px 6px rgba(255, 255, 255, 0.3),
    0 4px 6px rgba(43, 27, 23, 0.3);
  transform: rotate(-8deg);
}
.d3-seal-text {
  flex: 1;
  min-width: 0;
}
.d3-seal-title {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  color: #6b0f1a;
  font-size: 20px;
  margin: 0 0 6px;
}
.d3-seal-text code {
  display: block;
  word-break: break-all;
  font-family: "Crimson Pro", serif;
  font-size: 14px;
  color: #3a2a24;
  margin-bottom: 6px;
}
.d3-seal-note {
  margin: 0;
  font-style: italic;
  color: #6b0f1a;
  font-size: 14px;
}
.d3-qr-row {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px dashed rgba(107, 15, 26, 0.3);
}
.d3-qr {
  padding: 10px;
  background: #fdf8ed;
  border: 1px solid rgba(107, 15, 26, 0.4);
}
.d3-qr img {
  display: block;
  image-rendering: pixelated;
  mix-blend-mode: multiply;
}
.d3-qr-note {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 18px;
  color: #6b0f1a;
}
.d3-footer {
  display: flex;
  justify-content: space-between;
  max-width: 780px;
  margin: 0 auto;
  padding: 24px 48px 40px;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 15px;
  color: #6b0f1a;
}
.d3-footer-link {
  color: #6b0f1a;
  text-decoration: none;
  border-bottom: 1px solid rgba(107, 15, 26, 0.4);
}
`;
