import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

export const Route = createFileRoute("/1")({
  component: Design1,
});

function Design1() {
  const f = useShortenForm();

  return (
    <>
      <FontLoader />
      <div className="d1-root">
        <MatrixRainCanvas />
        <div className="d1-scanlines" aria-hidden="true" />
        <div className="d1-vignette" aria-hidden="true" />

        <header className="d1-header">
          <span className="d1-brand">voidhop://</span>
          <Link to="/designs" className="d1-navlink">
            [INDEX]
          </Link>
        </header>

        <main className="d1-main">
          <div className="d1-frame">
            <div className="d1-frame-top">
              <span>╭──── TERMINAL :: /dev/void0 ────╮</span>
              <span className="d1-frame-topright">[ENC:AES-256-GCM]</span>
            </div>

            <pre className="d1-ascii">{ASCII_RABBIT}</pre>

            <p className="d1-boot">
              <span className="d1-dim">&gt;</span> WAKE, NEO.
              <br />
              <span className="d1-dim">&gt;</span> THE WHITE RABBIT HOPS INTO
              THE VOID.
              <br />
              <span className="d1-dim">&gt;</span> ENCRYPT-THEN-EXIT. THE
              SERVER LEARNS NOTHING.
            </p>

            {f.state !== "success" && (
              <form
                className="d1-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
              >
                <label className="d1-prompt-row">
                  <span className="d1-prompt">voidhop:~$ hop --url</span>
                  <input
                    type="url"
                    className="d1-input"
                    placeholder="https://…"
                    value={f.url}
                    onChange={(e) => f.onUrlChange(e.target.value)}
                    disabled={f.isBusy}
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus
                    required
                  />
                </label>
                {f.inputError && (
                  <p className="d1-error">! {f.inputError}</p>
                )}

                <div className="d1-row">
                  <span className="d1-prompt">--ttl</span>
                  <div className="d1-ttl-row">
                    {TTL_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        type="button"
                        className={`d1-pill ${f.ttl === opt.seconds ? "d1-pill-on" : ""}`}
                        onClick={() => f.setTtl(opt.seconds)}
                        disabled={f.isBusy}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="d1-row">
                  <label className="d1-check">
                    <input
                      type="checkbox"
                      checked={f.protect}
                      onChange={(e) => f.setProtect(e.target.checked)}
                      disabled={f.isBusy}
                    />
                    <span>--password</span>
                  </label>
                  {f.protect && (
                    <div className="d1-pwd">
                      <input
                        type="password"
                        className="d1-input"
                        placeholder="****"
                        value={f.password}
                        onChange={(e) => f.setPassword(e.target.value)}
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        className="d1-input"
                        placeholder="confirm"
                        value={f.confirmPassword}
                        onChange={(e) =>
                          f.setConfirmPassword(e.target.value)
                        }
                        disabled={f.isBusy}
                        autoComplete="new-password"
                      />
                    </div>
                  )}
                </div>
                {f.passwordError && (
                  <p className="d1-error">! {f.passwordError}</p>
                )}

                <div className="d1-row">
                  <span className="d1-prompt">--uses</span>
                  <select
                    className="d1-input d1-select"
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
                        key={o.value ?? "unlimited"}
                        value={o.value === undefined ? "" : String(o.value)}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="d1-row">
                  <label className="d1-check">
                    <input
                      type="checkbox"
                      checked={f.includeDeletionToken}
                      onChange={(e) =>
                        f.setIncludeDeletionToken(e.target.checked)
                      }
                      disabled={f.isBusy}
                    />
                    <span>--delete-token</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="d1-run"
                  disabled={f.isBusy || f.url.trim().length === 0}
                >
                  <span className="d1-run-caret">▶</span>{" "}
                  {f.state === "encrypting"
                    ? "ENCRYPTING…"
                    : f.state === "uploading"
                      ? "UPLOADING…"
                      : "EXECUTE"}
                  <span className="d1-cursor">█</span>
                </button>

                {f.errorMessage && (
                  <div className="d1-errblock">
                    <div className="d1-errhead">SEGFAULT</div>
                    <div>{f.errorMessage}</div>
                  </div>
                )}
              </form>
            )}

            {f.state === "success" && f.result && (
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
                onAnother={f.reset}
              />
            )}

            <div className="d1-frame-bot">
              <span>╰────────────────────────────────╯</span>
            </div>
          </div>
        </main>

        <footer className="d1-footer">
          <Link to="/" className="d1-footer-link">
            exit(0) → voidhop
          </Link>
          <span className="d1-footer-meta">design·01 · matrix</span>
        </footer>
      </div>

      <style>{css}</style>
    </>
  );
}

function MatrixResult({
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
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    const qr = qrcode(0, "M");
    qr.addData(shortUrl);
    qr.make();
    qrRef.current.innerHTML = qr.createImgTag(3, 0);
  }, [shortUrl]);

  const [revealed, setRevealed] = useState("");
  useEffect(() => {
    setRevealed("");
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setRevealed(shortUrl.slice(0, i));
      if (i >= shortUrl.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [shortUrl]);

  return (
    <div className="d1-result">
      <div className="d1-result-head">&gt; TRANSMISSION COMPLETE</div>
      <div className="d1-result-url">
        {revealed}
        <span className="d1-cursor">█</span>
      </div>
      <div className="d1-result-actions">
        <button
          type="button"
          className="d1-pill"
          onClick={async () => {
            if (await copyToClipboard(shortUrl)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "[COPIED]" : "[COPY]"}
        </button>
        <button type="button" className="d1-pill" onClick={onAnother}>
          [NEW]
        </button>
      </div>
      <div className="d1-result-meta">
        <div>
          <span className="d1-dim">expires:</span> {expiry}
        </div>
        {passwordProtected && (
          <div>
            <span className="d1-dim">lock:</span> password required
          </div>
        )}
        {usesLeft !== undefined && (
          <div>
            <span className="d1-dim">uses:</span> self-destruct after{" "}
            {usesLeft === 1 ? "1 read" : `${usesLeft} reads`}
          </div>
        )}
        {deleteUrl && (
          <div className="d1-result-delete">
            <div className="d1-dim">delete-url:</div>
            <code>{deleteUrl}</code>
          </div>
        )}
      </div>
      <div className="d1-qr" ref={qrRef} aria-label="QR code" />
    </div>
  );
}

function MatrixRainCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const glyphs =
      "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ01101000VOIDHOP";
    const fontSize = 14;
    let columns = Math.floor(w / fontSize);
    let drops: number[] = new Array(columns)
      .fill(1)
      .map(() => Math.random() * -20);

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      columns = Math.floor(w / fontSize);
      drops = new Array(columns).fill(1).map(() => Math.random() * -20);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      for (let i = 0; i < columns; i++) {
        const ch = glyphs.charAt(Math.floor(Math.random() * glyphs.length));
        const x = i * fontSize;
        const d = drops[i] ?? 0;
        const y = d * fontSize;
        ctx.fillStyle = y > h - 20 ? "#d2ffd6" : "#00ff41";
        ctx.globalAlpha = Math.random() * 0.5 + 0.5;
        ctx.fillText(ch, x, y);
        ctx.globalAlpha = 1;
        drops[i] = y > h && Math.random() > 0.975 ? 1 : d + 1;
      }
      raf = window.requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return <canvas className="d1-rain" ref={ref} aria-hidden="true" />;
}

function FontLoader() {
  useEffect(() => {
    const id = "d1-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const ASCII_RABBIT = `        /\\_/\\
       ( o.o )
        > ^ <
   follow the rabbit`;

const css = `
.d1-root {
  position: relative;
  min-height: 100vh;
  background: #000;
  color: #00ff41;
  font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 14px;
  line-height: 1.55;
  overflow: hidden;
  isolation: isolate;
}
.d1-rain {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  opacity: 0.35;
  pointer-events: none;
}
.d1-scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.25) 3px,
    rgba(0, 0, 0, 0) 4px
  );
  mix-blend-mode: multiply;
}
.d1-vignette {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.75) 85%,
    rgba(0, 0, 0, 0.95) 100%
  );
}
.d1-root > header,
.d1-root > main,
.d1-root > footer {
  position: relative;
  z-index: 3;
}
.d1-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px dashed rgba(0, 255, 65, 0.25);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}
.d1-brand {
  color: #00ff41;
  font-weight: 800;
  text-shadow: 0 0 8px rgba(0, 255, 65, 0.6);
}
.d1-navlink {
  color: #00ff41;
  text-decoration: none;
  opacity: 0.75;
}
.d1-navlink:hover {
  opacity: 1;
  text-shadow: 0 0 6px #00ff41;
}
.d1-main {
  min-height: calc(100vh - 130px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 48px 24px;
}
.d1-frame {
  width: 100%;
  max-width: 680px;
  background: rgba(0, 0, 0, 0.78);
  border: 1px solid rgba(0, 255, 65, 0.35);
  box-shadow:
    0 0 0 1px rgba(0, 255, 65, 0.1),
    0 0 60px rgba(0, 255, 65, 0.08) inset,
    0 0 40px rgba(0, 255, 65, 0.08);
  padding: 24px 28px 20px;
  backdrop-filter: blur(2px);
}
.d1-frame-top,
.d1-frame-bot {
  display: flex;
  justify-content: space-between;
  letter-spacing: 0.08em;
  font-size: 11px;
  opacity: 0.7;
}
.d1-frame-bot {
  margin-top: 14px;
}
.d1-ascii {
  color: #d2ffd6;
  font-size: 12px;
  line-height: 1.25;
  margin: 18px 0 14px;
  white-space: pre;
  text-shadow: 0 0 8px rgba(0, 255, 65, 0.45);
}
.d1-boot {
  margin: 0 0 24px;
  color: #a7f3b5;
}
.d1-dim {
  color: #008f11;
}
.d1-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.d1-prompt-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.d1-prompt {
  color: #008f11;
  font-size: 12px;
  letter-spacing: 0.05em;
}
.d1-input {
  background: transparent;
  color: #00ff41;
  border: none;
  border-bottom: 1px solid rgba(0, 255, 65, 0.5);
  font-family: inherit;
  font-size: 15px;
  padding: 6px 0;
  outline: none;
  caret-color: #00ff41;
  border-radius: 0;
}
.d1-input::placeholder {
  color: rgba(0, 143, 17, 0.7);
}
.d1-input:focus {
  border-bottom-color: #00ff41;
  box-shadow: 0 1px 0 0 #00ff41;
}
.d1-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #00ff41 50%),
    linear-gradient(135deg, #00ff41 50%, transparent 50%);
  background-position:
    calc(100% - 16px) 50%,
    calc(100% - 10px) 50%;
  background-size:
    6px 6px,
    6px 6px;
  background-repeat: no-repeat;
  padding-right: 28px;
}
.d1-select option {
  background: #000;
  color: #00ff41;
}
.d1-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.d1-ttl-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.d1-pill {
  appearance: none;
  background: transparent;
  color: #00ff41;
  border: 1px solid rgba(0, 255, 65, 0.45);
  padding: 6px 12px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.12s;
}
.d1-pill:hover:not(:disabled) {
  background: rgba(0, 255, 65, 0.15);
}
.d1-pill-on {
  background: #00ff41;
  color: #000;
  border-color: #00ff41;
  box-shadow: 0 0 12px rgba(0, 255, 65, 0.8);
}
.d1-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  width: fit-content;
}
.d1-check input {
  accent-color: #00ff41;
}
.d1-pwd {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.d1-pwd .d1-input {
  flex: 1;
  min-width: 180px;
}
.d1-run {
  appearance: none;
  margin-top: 12px;
  padding: 14px 20px;
  background: #00ff41;
  color: #000;
  border: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow:
    0 0 0 1px #00ff41 inset,
    0 0 24px rgba(0, 255, 65, 0.5);
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
}
.d1-run:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
.d1-run-caret {
  font-size: 10px;
}
.d1-cursor {
  display: inline-block;
  width: 0.65em;
  animation: d1-blink 1s steps(2) infinite;
}
@keyframes d1-blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}
.d1-error {
  color: #ff4141;
  font-size: 12px;
  margin: 0;
  text-shadow: 0 0 6px rgba(255, 65, 65, 0.5);
}
.d1-errblock {
  margin-top: 12px;
  border: 1px solid rgba(255, 65, 65, 0.6);
  padding: 12px 14px;
  color: #ff8080;
}
.d1-errhead {
  font-weight: 800;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  color: #ff4141;
}
.d1-result {
  margin-top: 8px;
}
.d1-result-head {
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #d2ffd6;
  text-shadow: 0 0 10px rgba(0, 255, 65, 0.6);
  margin-bottom: 10px;
}
.d1-result-url {
  font-size: 17px;
  word-break: break-all;
  color: #d2ffd6;
  border: 1px solid rgba(0, 255, 65, 0.35);
  background: rgba(0, 255, 65, 0.06);
  padding: 14px 16px;
  margin-bottom: 14px;
  line-height: 1.5;
}
.d1-result-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.d1-result-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 16px;
}
.d1-result-delete code {
  display: block;
  color: #a7f3b5;
  word-break: break-all;
  margin-top: 4px;
  font-size: 11px;
}
.d1-qr {
  display: inline-block;
  padding: 10px;
  background: #000;
  border: 1px solid rgba(0, 255, 65, 0.4);
  filter: hue-rotate(-30deg) saturate(1.5);
}
.d1-qr img {
  display: block;
  image-rendering: pixelated;
  filter: brightness(0) saturate(100%) invert(64%) sepia(67%) saturate(3660%)
    hue-rotate(83deg) brightness(105%) contrast(104%);
}
.d1-footer {
  display: flex;
  justify-content: space-between;
  padding: 18px 24px;
  border-top: 1px dashed rgba(0, 255, 65, 0.25);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.d1-footer-link {
  color: #00ff41;
  text-decoration: none;
}
.d1-footer-link:hover {
  text-shadow: 0 0 8px #00ff41;
}
.d1-footer-meta {
  opacity: 0.55;
}
`;
