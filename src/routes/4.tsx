import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/4")({
  component: Design4,
});

function Design4() {
  const f = useShortenForm();

  return (
    <>
      <FontLoader />
      <div className="d4-root">
        <div className="d4-grain" aria-hidden="true" />

        <div className="d4-tape d4-tape-top" aria-hidden="true" />

        <header className="d4-header">
          <Link to="/" className="d4-brand">
            voidhop // ISSUE #04
          </Link>
          <Link to="/designs" className="d4-back">
            [ all issues ]
          </Link>
        </header>

        <div className="d4-stamp" aria-hidden="true">
          CONFIDENTIAL
        </div>

        <main className="d4-main">
          <h1 className="d4-title">
            <span>THIS</span>
            <span className="d4-title-hl">URL</span>
            <span>WILL</span>
            <br />
            <span>NEVER</span>
            <span className="d4-title-strike">LEAVE</span>
            <span className="d4-title-hl">REACH</span>
            <br />
            <span>THE</span>
            <span>SERVER.</span>
          </h1>

          <p className="d4-lede">
            xeroxed by the paranoid, for the paranoid. you paste. the browser
            encrypts. the server stores a blob and nothing else. end of
            transmission.
          </p>

          {f.state !== "success" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                f.submit();
              }}
              className="d4-form"
            >
              <div className="d4-sticker d4-sticker-url">
                <label className="d4-tag d4-tag-yellow">
                  paste·here
                </label>
                <input
                  type="url"
                  className="d4-input"
                  placeholder="https://"
                  value={f.url}
                  onChange={(e) => f.onUrlChange(e.target.value)}
                  disabled={f.isBusy}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  required
                />
                {f.inputError && (
                  <p className="d4-fielderr">{f.inputError}</p>
                )}
              </div>

              <div className="d4-sticker d4-sticker-ttl">
                <label className="d4-tag d4-tag-red">TTL</label>
                <div className="d4-ttl">
                  {TTL_OPTIONS.map((o) => (
                    <button
                      key={o.seconds}
                      type="button"
                      className={`d4-ttl-btn ${f.ttl === o.seconds ? "on" : ""}`}
                      onClick={() => f.setTtl(o.seconds)}
                      disabled={f.isBusy}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="d4-sticker d4-sticker-uses">
                <label className="d4-tag d4-tag-black">reads</label>
                <select
                  className="d4-input"
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

              <div className="d4-sticker d4-sticker-pw">
                <label className="d4-tag d4-tag-red">lock?</label>
                <label className="d4-check">
                  <input
                    type="checkbox"
                    checked={f.protect}
                    onChange={(e) => f.setProtect(e.target.checked)}
                    disabled={f.isBusy}
                  />
                  <span>YES — demand a password from the reader</span>
                </label>
                {f.protect && (
                  <div className="d4-pwd">
                    <input
                      type="password"
                      className="d4-input"
                      placeholder="password"
                      value={f.password}
                      onChange={(e) => f.setPassword(e.target.value)}
                      disabled={f.isBusy}
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      className="d4-input"
                      placeholder="again"
                      value={f.confirmPassword}
                      onChange={(e) => f.setConfirmPassword(e.target.value)}
                      disabled={f.isBusy}
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {f.passwordError && (
                  <p className="d4-fielderr">{f.passwordError}</p>
                )}
              </div>

              <div className="d4-sticker d4-sticker-kill">
                <label className="d4-tag d4-tag-black">kill-switch</label>
                <label className="d4-check">
                  <input
                    type="checkbox"
                    checked={f.includeDeletionToken}
                    onChange={(e) =>
                      f.setIncludeDeletionToken(e.target.checked)
                    }
                    disabled={f.isBusy}
                  />
                  <span>give me a revocation URL</span>
                </label>
              </div>

              <button
                type="submit"
                className="d4-submit"
                disabled={f.isBusy || f.url.trim().length === 0}
              >
                {f.state === "encrypting"
                  ? "▓▓▒░ ENCRYPTING ░▒▓▓"
                  : f.state === "uploading"
                    ? "▓▓▒░ UPLOADING ░▒▓▓"
                    : "PRESS HARD → TRANSMIT"}
              </button>

              {f.errorMessage && (
                <div className="d4-err">
                  <span className="d4-err-stamp">ERROR</span>
                  <span>{f.errorMessage}</span>
                </div>
              )}
            </form>
          )}

          {f.state === "success" && f.result && (
            <ZineResult
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

        <div className="d4-tape d4-tape-bot" aria-hidden="true" />

        <footer className="d4-footer">
          <span>04 / 10</span>
          <span>samizdat · hand-folded</span>
          <span>print + destroy</span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function ZineResult({
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
    <div className="d4-receipt">
      <div className="d4-receipt-stamp">TRANSMITTED</div>
      <div className="d4-receipt-head">
        ▓▓▓ voidhop RECEIPT ▓▓▓ no. {new Date().getTime().toString(36)}
      </div>
      <div className="d4-receipt-url">{shortUrl}</div>
      <div className="d4-receipt-actions">
        <button
          type="button"
          className="d4-btn"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "✓ COPIED" : "COPY"}
        </button>
        <button type="button" className="d4-btn d4-btn-ghost" onClick={onAnother}>
          ANOTHER
        </button>
      </div>
      <dl className="d4-receipt-meta">
        <div>
          <dt>EXPIRES</dt>
          <dd>{expiry}</dd>
        </div>
        {passwordProtected && (
          <div>
            <dt>LOCKED</dt>
            <dd>PASSWORD REQUIRED</dd>
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <dt>READS</dt>
            <dd>
              {usesLeft === 1 ? "1 (self-destruct)" : `${usesLeft} READS`}
            </dd>
          </div>
        )}
      </dl>
      {deleteUrl && (
        <div className="d4-killurl">
          <div className="d4-killurl-tag">▼ REVOKE</div>
          <code>{deleteUrl}</code>
        </div>
      )}
      <div className="d4-qr-row">
        <div className="d4-qr" ref={qrRef} aria-label="QR code" />
        <p className="d4-qr-note">
          CUT·FOLD·PASS ALONG
          <br />
          <span>burn after reading.</span>
        </p>
      </div>
    </div>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d4-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Special+Elite&family=Chivo+Mono:wght@400;600;800&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d4-root {
  position: relative;
  min-height: 100vh;
  background: #ece7dd;
  color: #0d0d0d;
  font-family: "Chivo Mono", ui-monospace, monospace;
  overflow-x: hidden;
  isolation: isolate;
}
.d4-grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.38;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.d4-root > header,
.d4-root > main,
.d4-root > footer,
.d4-root > .d4-tape,
.d4-root > .d4-stamp {
  position: relative;
  z-index: 2;
}
.d4-tape {
  position: sticky;
  height: 24px;
  background:
    repeating-linear-gradient(
      -45deg,
      #f4d03f 0,
      #f4d03f 14px,
      #0d0d0d 14px,
      #0d0d0d 28px
    );
  z-index: 3;
}
.d4-tape-top {
  top: 0;
}
.d4-tape-bot {
  bottom: 0;
}
.d4-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 48px 12px;
  border-bottom: 3px solid #0d0d0d;
  max-width: 920px;
  margin: 0 auto;
  flex-wrap: wrap;
  gap: 12px;
}
.d4-brand {
  font-family: "Special Elite", "Chivo Mono", monospace;
  font-size: 24px;
  color: #0d0d0d;
  text-decoration: none;
  letter-spacing: 0.05em;
}
.d4-back {
  font-family: "Chivo Mono", monospace;
  color: #0d0d0d;
  text-decoration: none;
  font-size: 13px;
  border: 2px solid #0d0d0d;
  padding: 6px 12px;
  background: #f4d03f;
  letter-spacing: 0.06em;
  font-weight: 800;
}
.d4-back:hover {
  background: #0d0d0d;
  color: #f4d03f;
}
.d4-stamp {
  position: absolute;
  top: 100px;
  right: -30px;
  font-family: "Special Elite", monospace;
  font-size: 64px;
  color: #c0392b;
  border: 6px solid #c0392b;
  padding: 14px 36px;
  transform: rotate(-8deg);
  opacity: 0.52;
  letter-spacing: 0.1em;
  pointer-events: none;
  z-index: 4;
  box-shadow: 0 0 0 3px transparent;
  background:
    repeating-linear-gradient(
      -35deg,
      transparent 0 3px,
      rgba(192, 57, 43, 0.08) 3px 5px
    );
}
.d4-main {
  max-width: 920px;
  margin: 0 auto;
  padding: 56px 48px 80px;
  position: relative;
}
.d4-title {
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  font-size: clamp(44px, 6.5vw, 76px);
  line-height: 1.05;
  margin: 0 0 28px;
  letter-spacing: -0.02em;
}
.d4-title span {
  margin-right: 18px;
}
.d4-title-hl {
  background: #f4d03f;
  padding: 0 10px;
  display: inline-block;
  transform: rotate(-1deg);
}
.d4-title-strike {
  text-decoration: line-through;
  text-decoration-thickness: 6px;
  text-decoration-color: #c0392b;
  color: rgba(13, 13, 13, 0.45);
}
.d4-lede {
  font-family: "Special Elite", monospace;
  font-size: 18px;
  line-height: 1.55;
  color: #0d0d0d;
  max-width: 560px;
  margin: 0 0 48px;
  border-left: 6px solid #c0392b;
  padding: 4px 0 4px 18px;
}
.d4-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 26px 24px;
}
@media (max-width: 700px) {
  .d4-form {
    grid-template-columns: 1fr;
  }
}
.d4-sticker {
  position: relative;
  background: #fbf6eb;
  border: 2px solid #0d0d0d;
  padding: 22px 22px 18px;
  box-shadow: 4px 4px 0 #0d0d0d;
}
.d4-sticker-url {
  grid-column: 1 / -1;
  transform: rotate(-0.4deg);
}
.d4-sticker-ttl {
  transform: rotate(0.6deg);
}
.d4-sticker-uses {
  transform: rotate(-0.5deg);
}
.d4-sticker-pw {
  grid-column: 1 / -1;
  transform: rotate(0.3deg);
}
.d4-sticker-kill {
  grid-column: 1 / -1;
  transform: rotate(-0.3deg);
}
.d4-tag {
  position: absolute;
  top: -14px;
  left: 16px;
  padding: 4px 10px;
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 2px solid #0d0d0d;
}
.d4-tag-yellow {
  background: #f4d03f;
}
.d4-tag-red {
  background: #c0392b;
  color: #fbf6eb;
}
.d4-tag-black {
  background: #0d0d0d;
  color: #fbf6eb;
}
.d4-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 2px solid #0d0d0d;
  padding: 8px 2px;
  font-family: "Chivo Mono", monospace;
  font-size: 18px;
  color: #0d0d0d;
  outline: none;
  border-radius: 0;
}
.d4-input:focus {
  border-bottom-color: #c0392b;
}
.d4-input::placeholder {
  color: rgba(13, 13, 13, 0.4);
}
.d4-fielderr {
  margin: 8px 0 0;
  color: #c0392b;
  font-family: "Special Elite", monospace;
  font-size: 14px;
}
.d4-ttl {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.d4-ttl-btn {
  padding: 8px 12px;
  background: #fbf6eb;
  border: 2px solid #0d0d0d;
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.1s;
  text-transform: uppercase;
}
.d4-ttl-btn:hover:not(:disabled) {
  background: #f4d03f;
}
.d4-ttl-btn.on {
  background: #0d0d0d;
  color: #fbf6eb;
}
select.d4-input {
  padding: 8px 2px;
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #0d0d0d 50%),
    linear-gradient(135deg, #0d0d0d 50%, transparent 50%);
  background-position:
    calc(100% - 16px) 54%,
    calc(100% - 10px) 54%;
  background-size: 6px 6px;
  background-repeat: no-repeat;
  padding-right: 26px;
}
.d4-check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 16px;
  font-family: "Chivo Mono", monospace;
  margin-top: 4px;
}
.d4-check input {
  accent-color: #c0392b;
  width: 18px;
  height: 18px;
}
.d4-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
@media (max-width: 560px) {
  .d4-pwd {
    grid-template-columns: 1fr;
  }
}
.d4-submit {
  grid-column: 1 / -1;
  padding: 20px;
  background: #c0392b;
  color: #fbf6eb;
  border: 3px solid #0d0d0d;
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  font-size: 17px;
  letter-spacing: 0.14em;
  cursor: pointer;
  box-shadow: 6px 6px 0 #0d0d0d;
  transition: all 0.1s;
  transform: rotate(-0.5deg);
}
.d4-submit:hover:not(:disabled) {
  transform: rotate(-0.5deg) translate(-2px, -2px);
  box-shadow: 8px 8px 0 #0d0d0d;
}
.d4-submit:active:not(:disabled) {
  transform: rotate(-0.5deg) translate(3px, 3px);
  box-shadow: 3px 3px 0 #0d0d0d;
}
.d4-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.d4-err {
  grid-column: 1 / -1;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  background: #fbf6eb;
  border: 2px solid #c0392b;
  font-family: "Chivo Mono", monospace;
  font-size: 15px;
}
.d4-err-stamp {
  background: #c0392b;
  color: #fbf6eb;
  padding: 4px 10px;
  font-weight: 800;
  letter-spacing: 0.15em;
  font-size: 12px;
}
.d4-receipt {
  position: relative;
  background: #fbf6eb;
  border: 3px solid #0d0d0d;
  padding: 40px 32px 32px;
  box-shadow: 8px 8px 0 #0d0d0d;
}
.d4-receipt-stamp {
  position: absolute;
  top: 24px;
  right: -16px;
  background: #0d0d0d;
  color: #f4d03f;
  padding: 8px 16px;
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  letter-spacing: 0.2em;
  font-size: 14px;
  transform: rotate(4deg);
  box-shadow: 3px 3px 0 #c0392b;
}
.d4-receipt-head {
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px dashed #0d0d0d;
}
.d4-receipt-url {
  background: #f4d03f;
  padding: 18px;
  border: 2px solid #0d0d0d;
  font-family: "Chivo Mono", monospace;
  font-size: 16px;
  word-break: break-all;
  margin-bottom: 18px;
  line-height: 1.5;
}
.d4-receipt-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 22px;
}
.d4-btn {
  background: #0d0d0d;
  color: #fbf6eb;
  border: 2px solid #0d0d0d;
  padding: 10px 18px;
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
}
.d4-btn-ghost {
  background: #fbf6eb;
  color: #0d0d0d;
}
.d4-btn:hover:not(:disabled) {
  background: #c0392b;
  color: #fbf6eb;
  border-color: #c0392b;
}
.d4-receipt-meta {
  margin: 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.d4-receipt-meta div {
  display: flex;
  gap: 12px;
  font-size: 13px;
  font-family: "Chivo Mono", monospace;
}
.d4-receipt-meta dt {
  background: #c0392b;
  color: #fbf6eb;
  padding: 2px 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  min-width: 86px;
  text-align: center;
}
.d4-receipt-meta dd {
  margin: 0;
}
.d4-killurl {
  padding: 14px 16px;
  background: #fbf6eb;
  border: 2px dashed #c0392b;
  margin-bottom: 20px;
}
.d4-killurl-tag {
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  color: #c0392b;
  letter-spacing: 0.1em;
  font-size: 11px;
  margin-bottom: 6px;
}
.d4-killurl code {
  font-family: "Chivo Mono", monospace;
  font-size: 12px;
  word-break: break-all;
}
.d4-qr-row {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-top: 20px;
  border-top: 2px dashed #0d0d0d;
}
.d4-qr {
  padding: 8px;
  background: #fbf6eb;
  border: 2px solid #0d0d0d;
  transform: rotate(-2deg);
}
.d4-qr img {
  display: block;
  image-rendering: pixelated;
  mix-blend-mode: multiply;
}
.d4-qr-note {
  margin: 0;
  font-family: "Special Elite", monospace;
  font-size: 16px;
}
.d4-qr-note span {
  color: #c0392b;
  font-family: "Chivo Mono", monospace;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.08em;
}
.d4-footer {
  display: flex;
  justify-content: space-between;
  max-width: 920px;
  margin: 0 auto;
  padding: 24px 48px 40px;
  font-family: "Chivo Mono", monospace;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
`;
