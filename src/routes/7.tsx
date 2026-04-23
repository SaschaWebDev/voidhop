import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/7")({
  component: Design7,
});

function Design7() {
  const f = useShortenForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      <FontLoader />
      <div className="d7-root">
        <header className="d7-header">
          <Link to="/" className="d7-brand">
            voidhop
          </Link>
          <Link to="/designs" className="d7-nav">
            07 ⁄ 10
          </Link>
        </header>

        <main className="d7-main">
          <h1 className="d7-h1">
            A short url.
            <br />
            <span className="d7-h1-mute">Nothing more.</span>
          </h1>

          <p className="d7-p">
            We can't read the destination. Neither can our server.
          </p>

          {f.state !== "success" && (
            <form
              className="d7-form"
              onSubmit={(e) => {
                e.preventDefault();
                f.submit();
              }}
            >
              <div className="d7-line">
                <label htmlFor="d7-url" className="d7-lineLabel">
                  url
                </label>
                <input
                  id="d7-url"
                  type="url"
                  className="d7-lineInput"
                  placeholder="https://"
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
                <p className="d7-fielderr">{f.inputError}</p>
              )}

              <div className="d7-line">
                <span className="d7-lineLabel">expires</span>
                <div className="d7-ttl">
                  {TTL_OPTIONS.map((o) => (
                    <button
                      key={o.seconds}
                      type="button"
                      className={`d7-ttl-opt ${f.ttl === o.seconds ? "on" : ""}`}
                      onClick={() => f.setTtl(o.seconds)}
                      disabled={f.isBusy}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="d7-disclose"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? "− hide" : "+ show"} advanced
              </button>

              {showAdvanced && (
                <div className="d7-advanced">
                  <div className="d7-line">
                    <label className="d7-lineLabel">uses</label>
                    <select
                      className="d7-lineInput"
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

                  <div className="d7-line d7-line-check">
                    <span className="d7-lineLabel">password</span>
                    <label className="d7-check">
                      <input
                        type="checkbox"
                        checked={f.protect}
                        onChange={(e) => f.setProtect(e.target.checked)}
                        disabled={f.isBusy}
                      />
                      <span>require one</span>
                    </label>
                  </div>
                  {f.protect && (
                    <div className="d7-pwd">
                      <input
                        type="password"
                        className="d7-lineInput"
                        placeholder="password"
                        value={f.password}
                        onChange={(e) => f.setPassword(e.target.value)}
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        className="d7-lineInput"
                        placeholder="again"
                        value={f.confirmPassword}
                        onChange={(e) =>
                          f.setConfirmPassword(e.target.value)
                        }
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                    </div>
                  )}
                  {f.passwordError && (
                    <p className="d7-fielderr">{f.passwordError}</p>
                  )}

                  <div className="d7-line d7-line-check">
                    <span className="d7-lineLabel">revoke</span>
                    <label className="d7-check">
                      <input
                        type="checkbox"
                        checked={f.includeDeletionToken}
                        onChange={(e) =>
                          f.setIncludeDeletionToken(e.target.checked)
                        }
                        disabled={f.isBusy}
                      />
                      <span>give me a delete url</span>
                    </label>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="d7-submit"
                disabled={f.isBusy || f.url.trim().length === 0}
              >
                {f.state === "encrypting"
                  ? "encrypting"
                  : f.state === "uploading"
                    ? "uploading"
                    : "shorten"}
                <span className="d7-accent-arrow" aria-hidden="true">
                  →
                </span>
              </button>

              {f.errorMessage && (
                <p className="d7-err">{f.errorMessage}</p>
              )}
            </form>
          )}

          {f.state === "success" && f.result && (
            <MinimalResult
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

        <footer className="d7-footer">
          <span>voidhop</span>
          <span>a privacy exercise in restraint</span>
          <span>mmxxvi</span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function MinimalResult({
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
    const qr = qrcode(0, "L");
    qr.addData(shortUrl);
    qr.make();
    qrRef.current.innerHTML = qr.createImgTag(3, 0);
  }, [shortUrl]);

  return (
    <div className="d7-result">
      <div className="d7-line">
        <span className="d7-lineLabel">ready</span>
        <span className="d7-result-url">{shortUrl}</span>
      </div>
      <div className="d7-line">
        <span className="d7-lineLabel">expires</span>
        <span>{expiry}</span>
      </div>
      {passwordProtected && (
        <div className="d7-line">
          <span className="d7-lineLabel">locked</span>
          <span>password required</span>
        </div>
      )}
      {usesLeft !== undefined && (
        <div className="d7-line">
          <span className="d7-lineLabel">uses</span>
          <span>
            {usesLeft === 1 ? "one (self-destruct)" : `${usesLeft}`}
          </span>
        </div>
      )}
      {deleteUrl && (
        <div className="d7-line d7-line-wrap">
          <span className="d7-lineLabel">revoke</span>
          <code className="d7-result-delete">{deleteUrl}</code>
        </div>
      )}
      <div className="d7-line">
        <span className="d7-lineLabel">qr</span>
        <div className="d7-qr" ref={qrRef} aria-label="QR code" />
      </div>
      <div className="d7-result-actions">
        <button
          type="button"
          className="d7-action"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
        <button type="button" className="d7-action" onClick={onAnother}>
          new
        </button>
      </div>
    </div>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d7-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d7-root {
  min-height: 100vh;
  background: #fafaf7;
  color: #0a0a0a;
  font-family: "Instrument Sans", ui-sans-serif, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  letter-spacing: -0.005em;
}
.d7-header {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 56px 48px 0;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.d7-brand {
  font-family: "Instrument Sans", sans-serif;
  font-weight: 500;
  font-size: 15px;
  letter-spacing: -0.01em;
  color: #0a0a0a;
  text-decoration: none;
}
.d7-nav {
  font-family: "Instrument Sans", sans-serif;
  font-size: 13px;
  color: #0a0a0a;
  opacity: 0.5;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.d7-nav:hover {
  opacity: 1;
}
.d7-main {
  flex: 1;
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 140px 48px 80px;
}
.d7-h1 {
  font-family: "Instrument Sans", sans-serif;
  font-weight: 500;
  font-size: clamp(44px, 6vw, 68px);
  line-height: 1.02;
  letter-spacing: -0.03em;
  margin: 0 0 28px;
  color: #0a0a0a;
}
.d7-h1-mute {
  color: #aaa9a2;
}
.d7-p {
  font-size: 18px;
  color: #4a4a45;
  margin: 0 0 96px;
  max-width: 460px;
  line-height: 1.45;
}
.d7-form {
  border-top: 1px solid #0a0a0a;
}
.d7-line {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
  border-bottom: 1px solid rgba(10, 10, 10, 0.1);
}
.d7-line-wrap {
  align-items: flex-start;
}
.d7-lineLabel {
  font-size: 13px;
  color: #0a0a0a;
  opacity: 0.55;
  letter-spacing: 0.02em;
  text-transform: lowercase;
}
.d7-lineInput {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  font-family: "Instrument Sans", sans-serif;
  font-size: 18px;
  color: #0a0a0a;
  outline: none;
  letter-spacing: -0.01em;
  border-radius: 0;
}
.d7-lineInput::placeholder {
  color: rgba(10, 10, 10, 0.3);
}
.d7-lineInput:focus {
  outline: none;
}
select.d7-lineInput {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%230a0a0a' stroke-width='1.2'/></svg>");
  background-repeat: no-repeat;
  background-position: right 2px center;
  padding-right: 18px;
}
.d7-ttl {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.d7-ttl-opt {
  background: transparent;
  border: none;
  padding: 0;
  font-family: "Instrument Sans", sans-serif;
  font-size: 17px;
  color: #0a0a0a;
  opacity: 0.4;
  cursor: pointer;
  transition: opacity 0.15s;
  letter-spacing: -0.01em;
}
.d7-ttl-opt:hover:not(:disabled) {
  opacity: 0.7;
}
.d7-ttl-opt.on {
  opacity: 1;
  position: relative;
}
.d7-ttl-opt.on::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -4px;
  height: 2px;
  background: #ff3b00;
}
.d7-disclose {
  background: transparent;
  border: none;
  padding: 20px 0;
  font-family: "Instrument Sans", sans-serif;
  font-size: 14px;
  color: #0a0a0a;
  opacity: 0.5;
  cursor: pointer;
  text-align: left;
  border-bottom: 1px solid rgba(10, 10, 10, 0.1);
  width: 100%;
}
.d7-disclose:hover {
  opacity: 1;
}
.d7-advanced {
  animation: d7-open 0.2s ease-out;
}
@keyframes d7-open {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.d7-line-check {
  padding: 20px 0;
}
.d7-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 17px;
  font-family: "Instrument Sans", sans-serif;
  letter-spacing: -0.01em;
}
.d7-check input {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid #0a0a0a;
  background: transparent;
  position: relative;
  cursor: pointer;
  border-radius: 0;
}
.d7-check input:checked {
  background: #0a0a0a;
}
.d7-check input:checked::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 5px;
  width: 4px;
  height: 8px;
  border-right: 2px solid #fafaf7;
  border-bottom: 2px solid #fafaf7;
  transform: rotate(45deg);
}
.d7-pwd {
  display: grid;
  grid-template-columns: 120px 1fr 1fr;
  gap: 24px 12px;
  padding: 0 0 20px;
  align-items: center;
}
.d7-pwd input:first-child {
  grid-column: 2;
}
.d7-pwd input:nth-child(2) {
  grid-column: 3;
}
@media (max-width: 600px) {
  .d7-pwd {
    grid-template-columns: 120px 1fr;
  }
  .d7-pwd input:nth-child(2) {
    grid-column: 2;
  }
}
.d7-fielderr {
  font-size: 14px;
  color: #ff3b00;
  margin: 0;
  padding: 12px 0;
  border-bottom: 1px solid rgba(10, 10, 10, 0.1);
}
.d7-submit {
  width: 100%;
  background: transparent;
  border: none;
  padding: 32px 0;
  font-family: "Instrument Sans", sans-serif;
  font-size: 22px;
  color: #0a0a0a;
  cursor: pointer;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #0a0a0a;
  letter-spacing: -0.02em;
  font-weight: 500;
  transition: padding 0.15s;
}
.d7-submit:hover:not(:disabled) {
  padding-left: 12px;
}
.d7-submit:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.d7-accent-arrow {
  color: #0a0a0a;
  transition: color 0.15s, transform 0.15s;
}
.d7-submit:hover:not(:disabled) .d7-accent-arrow {
  color: #ff3b00;
  transform: translateX(4px);
}
.d7-err {
  color: #ff3b00;
  font-size: 15px;
  margin: 20px 0 0;
}
.d7-result {
  border-top: 1px solid #0a0a0a;
  animation: d7-fade 0.3s ease-out;
}
@keyframes d7-fade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
.d7-result-url {
  font-size: 20px;
  font-weight: 500;
  word-break: break-all;
  color: #0a0a0a;
}
.d7-result-delete {
  font-family: "Instrument Sans", sans-serif;
  font-size: 13px;
  word-break: break-all;
  color: rgba(10, 10, 10, 0.7);
  line-height: 1.45;
}
.d7-qr {
  display: inline-block;
}
.d7-qr img {
  display: block;
  image-rendering: pixelated;
  background: #fafaf7;
}
.d7-result-actions {
  display: flex;
  gap: 32px;
  padding: 24px 0 0;
}
.d7-action {
  background: transparent;
  border: none;
  padding: 0;
  font-family: "Instrument Sans", sans-serif;
  font-size: 16px;
  color: #0a0a0a;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
.d7-action:hover {
  color: #ff3b00;
}
.d7-footer {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 48px 48px 64px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #0a0a0a;
  opacity: 0.4;
  letter-spacing: 0.02em;
  gap: 20px;
  flex-wrap: wrap;
}
`;
