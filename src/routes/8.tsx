import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/8")({
  component: Design8,
});

function Design8() {
  const f = useShortenForm();
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (f.state === "success" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [f.state]);

  return (
    <>
      <FontLoader />
      <ScrollProgress />
      <div className="d8-root">
        <nav className="d8-nav">
          <Link to="/" className="d8-nav-brand">
            voidhop
          </Link>
          <Link to="/designs" className="d8-nav-link">
            ↑ surface
          </Link>
        </nav>

        <section className="d8-hero d8-section">
          <RabbitGlyph />
          <p className="d8-kicker">viii · the rabbit hole</p>
          <h1 className="d8-hero-h1">
            Down, and
            <br />
            <em>down,</em>
            <br />
            and down.
          </h1>
          <p className="d8-hero-sub">
            Scroll. At the bottom there is a url that no one else can read.
          </p>
          <div className="d8-down" aria-hidden="true">
            <span>↓</span>
          </div>
        </section>

        <section className="d8-section d8-stage d8-stage-1" data-stage="1">
          <div className="d8-reveal">
            <p className="d8-narr">
              <em>First,</em> the address you would hide.
            </p>
            <form
              className="d8-form"
              onSubmit={(e) => {
                e.preventDefault();
                f.submit();
              }}
              id="d8-form"
            >
              <label className="d8-field">
                <span className="d8-field-label">the url</span>
                <input
                  type="url"
                  className="d8-input d8-input-big"
                  placeholder="https://"
                  value={f.url}
                  onChange={(e) => f.onUrlChange(e.target.value)}
                  disabled={f.isBusy}
                  spellCheck={false}
                  autoComplete="off"
                  required
                />
              </label>
              {f.inputError && (
                <p className="d8-fielderr">{f.inputError}</p>
              )}
            </form>
          </div>
        </section>

        <section className="d8-section d8-stage d8-stage-2" data-stage="2">
          <div className="d8-reveal">
            <p className="d8-narr">
              <em>Then,</em> how long it should survive beneath.
            </p>
            <div className="d8-ttl">
              {TTL_OPTIONS.map((o, i) => (
                <button
                  key={o.seconds}
                  type="button"
                  className={`d8-ttl-card ${f.ttl === o.seconds ? "on" : ""}`}
                  onClick={() => f.setTtl(o.seconds)}
                  disabled={f.isBusy}
                  style={{ transform: `rotate(${(i - 1) * 0.6}deg)` }}
                  form="d8-form"
                >
                  <span className="d8-ttl-num">{o.label.split(" ")[0]}</span>
                  <span className="d8-ttl-unit">
                    {o.label.split(" ")[1]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="d8-section d8-stage d8-stage-3" data-stage="3">
          <div className="d8-reveal">
            <p className="d8-narr">
              <em>A watchword,</em> perhaps, for the careful.
            </p>
            <label className="d8-check d8-check-lg">
              <input
                type="checkbox"
                checked={f.protect}
                onChange={(e) => f.setProtect(e.target.checked)}
                disabled={f.isBusy}
                form="d8-form"
              />
              <span>seal it with a password</span>
            </label>
            {f.protect && (
              <div className="d8-pwd">
                <input
                  type="password"
                  className="d8-input"
                  placeholder="password"
                  value={f.password}
                  onChange={(e) => f.setPassword(e.target.value)}
                  disabled={f.isBusy}
                  autoComplete="new-password"
                  form="d8-form"
                />
                <input
                  type="password"
                  className="d8-input"
                  placeholder="again"
                  value={f.confirmPassword}
                  onChange={(e) => f.setConfirmPassword(e.target.value)}
                  disabled={f.isBusy}
                  autoComplete="new-password"
                  form="d8-form"
                />
              </div>
            )}
            {f.passwordError && (
              <p className="d8-fielderr">{f.passwordError}</p>
            )}
            <p className="d8-narr-small">
              A recipient will need it, too. Share it separately.
            </p>
          </div>
        </section>

        <section className="d8-section d8-stage d8-stage-4" data-stage="4">
          <div className="d8-reveal">
            <p className="d8-narr">
              <em>And the small matters:</em> readings and revocation.
            </p>
            <div className="d8-small-grid">
              <label className="d8-field">
                <span className="d8-field-label">readings</span>
                <select
                  className="d8-input"
                  value={f.usesLeft === undefined ? "" : String(f.usesLeft)}
                  onChange={(e) =>
                    f.setUsesLeft(
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  disabled={f.isBusy}
                  form="d8-form"
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
              </label>
              <label className="d8-check">
                <input
                  type="checkbox"
                  checked={f.includeDeletionToken}
                  onChange={(e) => f.setIncludeDeletionToken(e.target.checked)}
                  disabled={f.isBusy}
                  form="d8-form"
                />
                <span>keep a key to revoke it</span>
              </label>
            </div>
          </div>
        </section>

        <section className="d8-section d8-stage d8-stage-5" data-stage="5">
          <div className="d8-reveal d8-reveal-center">
            <p className="d8-narr">
              <em>At last,</em> release it into the void.
            </p>
            <button
              type="submit"
              className="d8-submit"
              disabled={f.isBusy || f.url.trim().length === 0}
              form="d8-form"
            >
              {f.state === "encrypting"
                ? "encrypting…"
                : f.state === "uploading"
                  ? "falling…"
                  : "let go"}
            </button>
            {f.errorMessage && <p className="d8-err">{f.errorMessage}</p>}
          </div>
        </section>

        <section
          className="d8-section d8-stage d8-stage-final"
          data-stage="6"
          ref={resultRef}
        >
          <div className="d8-reveal d8-reveal-center">
            {f.state === "success" && f.result ? (
              <HoleResult
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
            ) : (
              <p className="d8-narr d8-narr-void">
                <em>and here,</em> at the bottom, is where your url will land.
              </p>
            )}
          </div>
        </section>
      </div>

      <style>{css}</style>
    </>
  );
}

function HoleResult({
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
    <div className="d8-result">
      <p className="d8-narr">
        <em>it has fallen.</em>
      </p>
      <div className="d8-result-url">{shortUrl}</div>
      <div className="d8-result-actions">
        <button
          type="button"
          className="d8-btn"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
        <button type="button" className="d8-btn d8-btn-ghost" onClick={onAnother}>
          climb out
        </button>
      </div>
      <dl className="d8-meta">
        <div>
          <dt>expires</dt>
          <dd>{expiry}</dd>
        </div>
        {passwordProtected && (
          <div>
            <dt>sealed</dt>
            <dd>with a watchword</dd>
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <dt>readings</dt>
            <dd>
              {usesLeft === 1 ? "burns on first" : `${usesLeft} left`}
            </dd>
          </div>
        )}
      </dl>
      {deleteUrl && (
        <div className="d8-revoke">
          <div className="d8-revoke-title">revocation</div>
          <code>{deleteUrl}</code>
        </div>
      )}
      <div className="d8-qr-wrap">
        <div className="d8-qr" ref={qrRef} aria-label="QR code" />
      </div>
    </div>
  );
}

function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fade body background through the journey
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("d8-in");
          }
        }
      },
      { threshold: 0.25 },
    );
    document.querySelectorAll(".d8-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="d8-progress" aria-hidden="true">
      <div className="d8-progress-bar" style={{ transform: `scaleY(${p})` }} />
    </div>
  );
}

function RabbitGlyph() {
  return (
    <svg
      className="d8-rabbit"
      viewBox="0 0 180 240"
      aria-hidden="true"
    >
      <g fill="#1a1429">
        <ellipse cx="64" cy="50" rx="12" ry="46" />
        <ellipse cx="116" cy="50" rx="12" ry="46" />
        <circle cx="90" cy="130" r="46" />
        <ellipse cx="90" cy="200" rx="60" ry="26" />
        <circle cx="78" cy="122" r="3" fill="#f6a96b" />
        <circle cx="102" cy="122" r="3" fill="#f6a96b" />
      </g>
    </svg>
  );
}

function FontLoader() {
  useEffect(() => {
    const id = "d8-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d8-root {
  background: linear-gradient(
    180deg,
    #f6a96b 0%,
    #c0755a 12%,
    #6a4b6b 28%,
    #2a2151 46%,
    #0a0a1f 68%,
    #000 100%
  );
  color: #f5e9d0;
  font-family: "DM Sans", ui-sans-serif, sans-serif;
  min-height: 100vh;
  font-size: 17px;
  line-height: 1.55;
}
.d8-progress {
  position: fixed;
  top: 0;
  right: 0;
  width: 2px;
  height: 100vh;
  z-index: 100;
  background: rgba(245, 233, 208, 0.1);
}
.d8-progress-bar {
  width: 100%;
  height: 100%;
  background: #f6a96b;
  transform-origin: top;
}
.d8-nav {
  position: fixed;
  top: 28px;
  left: 0;
  right: 0;
  z-index: 50;
  max-width: 900px;
  margin: 0 auto;
  padding: 0 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.d8-nav-brand {
  font-family: "Playfair Display", serif;
  font-style: italic;
  font-size: 18px;
  color: #f5e9d0;
  text-decoration: none;
  mix-blend-mode: difference;
}
.d8-nav-link {
  font-family: "DM Sans", sans-serif;
  font-size: 12px;
  letter-spacing: 0.2em;
  color: #f5e9d0;
  text-decoration: none;
  text-transform: uppercase;
  padding: 8px 14px;
  border: 1px solid rgba(245, 233, 208, 0.35);
  border-radius: 20px;
  mix-blend-mode: difference;
}
.d8-nav-link:hover {
  background: rgba(245, 233, 208, 0.12);
}
.d8-section {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 40px;
  position: relative;
}
.d8-hero {
  text-align: center;
}
.d8-rabbit {
  width: 110px;
  height: auto;
  margin: 0 auto 32px;
  filter: drop-shadow(0 6px 18px rgba(26, 20, 41, 0.6));
  animation: d8-hop 4s ease-in-out infinite;
}
@keyframes d8-hop {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
.d8-kicker {
  font-family: "DM Sans", sans-serif;
  font-size: 13px;
  letter-spacing: 0.32em;
  color: rgba(26, 20, 41, 0.7);
  text-transform: uppercase;
  margin: 0 0 24px;
}
.d8-hero-h1 {
  font-family: "Playfair Display", serif;
  font-weight: 400;
  font-size: clamp(60px, 10vw, 136px);
  line-height: 0.92;
  margin: 0 0 28px;
  color: #1a1429;
  letter-spacing: -0.02em;
}
.d8-hero-h1 em {
  font-style: italic;
  color: #6a4b6b;
}
.d8-hero-sub {
  font-size: 18px;
  color: rgba(26, 20, 41, 0.75);
  max-width: 420px;
  margin: 0 auto 48px;
  font-family: "DM Sans", sans-serif;
}
.d8-down {
  margin-top: 40px;
  font-size: 22px;
  color: rgba(26, 20, 41, 0.55);
  animation: d8-bounce 2.2s ease-in-out infinite;
}
@keyframes d8-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(10px);
  }
}
.d8-reveal {
  max-width: 640px;
  width: 100%;
  opacity: 0;
  transform: translateY(40px);
  transition:
    opacity 0.8s ease-out,
    transform 0.8s ease-out;
}
.d8-reveal-center {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.d8-reveal.d8-in {
  opacity: 1;
  transform: translateY(0);
}
.d8-narr {
  font-family: "Playfair Display", serif;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.3;
  margin: 0 0 32px;
  color: #f5e9d0;
  font-weight: 400;
}
.d8-narr em {
  font-style: italic;
  color: #f6a96b;
}
.d8-narr-small {
  font-family: "Playfair Display", serif;
  font-style: italic;
  font-size: 18px;
  color: rgba(245, 233, 208, 0.6);
  margin: 24px 0 0;
}
.d8-narr-void {
  color: rgba(245, 233, 208, 0.4);
  font-size: 28px;
}
.d8-narr-void em {
  color: rgba(245, 233, 208, 0.75);
}
.d8-field {
  display: block;
}
.d8-field-label {
  display: block;
  font-family: "DM Sans", sans-serif;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 10px;
  color: rgba(245, 233, 208, 0.6);
}
.d8-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(245, 233, 208, 0.4);
  color: #fff;
  padding: 14px 2px;
  font-family: "DM Sans", sans-serif;
  font-size: 18px;
  outline: none;
  border-radius: 0;
}
.d8-input::placeholder {
  color: rgba(245, 233, 208, 0.3);
}
.d8-input:focus {
  border-bottom-color: #f6a96b;
}
.d8-input-big {
  font-family: "Playfair Display", serif;
  font-style: italic;
  font-size: clamp(26px, 3vw, 36px);
  padding: 20px 2px;
}
select.d8-input {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0 L6 8 L12 0' fill='none' stroke='%23f6a96b' stroke-width='1.3'/></svg>");
  background-repeat: no-repeat;
  background-position: right 4px center;
  padding-right: 22px;
}
select.d8-input option {
  background: #1a1429;
  color: #f5e9d0;
}
.d8-fielderr {
  color: #f6a96b;
  margin: 12px 0 0;
  font-size: 15px;
  font-family: "DM Sans", sans-serif;
}
.d8-ttl {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}
.d8-ttl-card {
  width: 150px;
  height: 200px;
  background: rgba(245, 233, 208, 0.05);
  border: 1px solid rgba(245, 233, 208, 0.25);
  color: #f5e9d0;
  cursor: pointer;
  font-family: "Playfair Display", serif;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(6px);
  transition: all 0.25s;
}
.d8-ttl-card:hover:not(:disabled) {
  border-color: rgba(246, 169, 107, 0.6);
  background: rgba(246, 169, 107, 0.08);
}
.d8-ttl-card.on {
  background: #f6a96b;
  border-color: #f6a96b;
  color: #1a1429;
  box-shadow: 0 20px 40px rgba(246, 169, 107, 0.4);
}
.d8-ttl-num {
  font-size: 56px;
  font-style: italic;
  font-weight: 400;
  line-height: 1;
}
.d8-ttl-unit {
  font-family: "DM Sans", sans-serif;
  font-size: 13px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.d8-check {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  font-family: "DM Sans", sans-serif;
  font-size: 16px;
  color: #f5e9d0;
}
.d8-check-lg {
  font-size: 20px;
}
.d8-check input {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(245, 233, 208, 0.5);
  background: transparent;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
}
.d8-check input:checked {
  background: #f6a96b;
  border-color: #f6a96b;
}
.d8-check input:checked::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1a1429;
}
.d8-pwd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 24px;
}
@media (max-width: 560px) {
  .d8-pwd {
    grid-template-columns: 1fr;
  }
}
.d8-small-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  align-items: end;
}
@media (max-width: 600px) {
  .d8-small-grid {
    grid-template-columns: 1fr;
  }
}
.d8-submit {
  margin-top: 16px;
  padding: 28px 56px;
  background: transparent;
  color: #f5e9d0;
  border: 1px solid #f5e9d0;
  font-family: "Playfair Display", serif;
  font-style: italic;
  font-size: 32px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s;
}
.d8-submit:hover:not(:disabled) {
  background: #f5e9d0;
  color: #0a0a1f;
  transform: scale(1.03);
}
.d8-submit:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.d8-err {
  margin-top: 18px;
  color: #f6a96b;
  font-family: "DM Sans", sans-serif;
  font-size: 15px;
}
.d8-stage-final {
  background: #000;
}
.d8-result {
  text-align: left;
  max-width: 560px;
  margin: 0 auto;
}
.d8-result-url {
  font-family: "Playfair Display", serif;
  font-style: italic;
  font-size: clamp(22px, 3vw, 32px);
  color: #fff;
  padding: 28px;
  background: rgba(245, 233, 208, 0.04);
  border: 1px solid rgba(245, 233, 208, 0.3);
  border-radius: 10px;
  word-break: break-all;
  line-height: 1.4;
  margin-bottom: 20px;
}
.d8-result-actions {
  display: flex;
  gap: 14px;
  margin-bottom: 32px;
  justify-content: center;
}
.d8-btn {
  background: #f5e9d0;
  color: #0a0a1f;
  border: none;
  padding: 14px 26px;
  border-radius: 999px;
  font-family: "DM Sans", sans-serif;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  letter-spacing: 0.02em;
}
.d8-btn:hover {
  background: #f6a96b;
}
.d8-btn-ghost {
  background: transparent;
  color: #f5e9d0;
  border: 1px solid rgba(245, 233, 208, 0.5);
}
.d8-btn-ghost:hover {
  background: rgba(245, 233, 208, 0.08);
  color: #f5e9d0;
}
.d8-meta {
  margin: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: "DM Sans", sans-serif;
}
.d8-meta div {
  display: flex;
  gap: 16px;
  font-size: 15px;
}
.d8-meta dt {
  min-width: 100px;
  color: rgba(245, 233, 208, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 11px;
  padding-top: 2px;
}
.d8-meta dd {
  margin: 0;
  font-family: "Playfair Display", serif;
  font-style: italic;
  color: #f5e9d0;
}
.d8-revoke {
  padding: 16px 18px;
  border: 1px dashed rgba(246, 169, 107, 0.5);
  background: rgba(246, 169, 107, 0.06);
  margin-bottom: 24px;
  border-radius: 8px;
}
.d8-revoke-title {
  font-family: "DM Sans", sans-serif;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #f6a96b;
  margin-bottom: 6px;
}
.d8-revoke code {
  word-break: break-all;
  font-family: "DM Sans", sans-serif;
  font-size: 13px;
  color: rgba(245, 233, 208, 0.85);
}
.d8-qr-wrap {
  display: flex;
  justify-content: center;
}
.d8-qr {
  padding: 14px;
  background: #fff;
  border-radius: 12px;
}
.d8-qr img {
  display: block;
  image-rendering: pixelated;
}
`;
