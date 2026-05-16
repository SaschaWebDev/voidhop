/**
 * Home — Void Portal.
 *
 * VoidHop's landing-and-tool page. Originally explored as design /12 in
 * a Claude Design handoff and then promoted here. Deep cosmic gradient
 * with a live SVG-only portal (rotating rings, drifting particles,
 * event-horizon disc), a glassy form card overlaid. Wired straight to
 * the existing useShortenForm hook so the AES-256-GCM client-side
 * crypto path is unchanged from the previous CreatePage.
 *
 * Fonts are self-hosted via @fontsource/* — no cross-origin requests
 * (matches the project's zero-external-deps stance enforced by
 * scripts/check-no-external-deps.mjs).
 */

import "@fontsource/fraunces/300.css";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/300-italic.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import {
  useShortenForm,
  copyToClipboard,
  formatExpiry,
} from "@/hooks/use-shorten-form";
import {
  PasswordCopyIcon,
  PasswordEyeIcon,
  PasswordRefreshIcon,
  IconWhatsApp,
  IconTelegram,
  IconEmail,
  IconShare,
  IconDoodlyArrow,
} from "@/components/icons";
import { Stars, VoidPortal, vp } from "@/components/void-portal";
import { generatePassword } from "@/utils/generate-password";
import { REPO_URL, TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

import "./index.css";

export const Route = createFileRoute("/")({
  component: Home,
});

const COPY_FEEDBACK_MS = 1500;

const VOID_STATS = [
  ["AES-256 GCM", "Military Grade Encryption"],
  ["0 logs", "forever"],
] as const;

function Home() {
  const f = useShortenForm();
  const hopping = f.isBusy;
  const [showPassword, setShowPassword] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);

  return (
    <>
      <div className="vp-root">
        <Stars />
        <VoidPortal />
        <div className="vp-noise" aria-hidden="true" />

        <header className="vp-header">
          <Link to="/" className="vp-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              aria-hidden="true"
              className="vp-mark"
            >
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke={vp.accent}
                strokeOpacity="0.5"
              />
              <circle cx="14" cy="14" r="5" fill={vp.accent} />
            </svg>
            <span className="vp-wordmark">voidhop</span>
          </Link>
          <nav className="vp-nav">
            <Link to="/about">About</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </header>

        <main className="vp-main">
          <section className="vp-pitch">
            <div className="vp-pill">
              <span className="vp-pill-dot" />
              encrypted · client-side · zero-knowledge
            </div>

            <h1 className="vp-h1">
              Warp right <span className="vp-h1-accent">through the</span>
              <br />
              <span className="vp-h1-accent">void.</span>
            </h1>

            <p className="vp-lede">
              Your short link takes you to your destination without anyone
              knowing where you're going (even us). The URL is encrypted in your
              local browser and deleted immediately. No accounts. No tracking.
              Just void.
            </p>

            <ul className="vp-stats">
              {VOID_STATS.map(([a, b]) => (
                <li key={a}>
                  <div className="vp-stat-a">{a}</div>
                  <div className="vp-stat-b">{b}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className={`vp-card${hopping ? " hopping" : ""}`}>
            <div className="vp-shimmer" aria-hidden="true" />

            {f.state === "success" && f.result ? (
              <VoidResult
                shortUrl={f.result.shortUrl}
                expiry={formatExpiry(f.result.expiresAt)}
                passwordProtected={f.result.passwordProtected}
                usesLeft={f.result.usesLeft}
                deleteUrl={f.result.deleteUrl}
                onReset={f.reset}
              />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
              >
                <div className="vp-card-title">Shorten a link</div>
                <div className="vp-card-sub">Your URL is only known to you</div>

                <VoidField label="destination" htmlFor="vp-destination">
                  <input
                    id="vp-destination"
                    type="text"
                    inputMode="url"
                    className={`vp-input${f.url ? " on" : ""}`}
                    placeholder="https://yourdestination.com"
                    value={f.url}
                    onChange={(e) => f.onUrlChange(e.target.value)}
                    disabled={hopping}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoFocus
                    required
                  />
                  {f.inputError && (
                    <div className="vp-err-inline">{f.inputError}</div>
                  )}
                </VoidField>

                <VoidField label="expires in" labelId="vp-ttl-label">
                  <div
                    className="vp-ttl"
                    role="radiogroup"
                    aria-labelledby="vp-ttl-label"
                  >
                    {TTL_OPTIONS.map((o) => {
                      const checked = f.ttl === o.seconds;
                      return (
                        <button
                          key={o.seconds}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          className={`vp-ttl-btn${checked ? " on" : ""}`}
                          onClick={() => f.setTtl(o.seconds)}
                          disabled={hopping}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </VoidField>

                <VoidField label="usage limit" htmlFor="vp-uses-left">
                  <select
                    id="vp-uses-left"
                    className="vp-select"
                    value={f.usesLeft === undefined ? "" : String(f.usesLeft)}
                    onChange={(e) =>
                      f.setUsesLeft(
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    disabled={hopping}
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
                </VoidField>

                <div className="vp-toggles">
                  <VoidCheckbox
                    checked={f.protect}
                    onChange={f.setProtect}
                    disabled={hopping}
                  >
                    Redirect requires password
                  </VoidCheckbox>
                </div>

                {f.protect && (
                  <div className="vp-pwd">
                    <div className="vp-pwd-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="vp-pwd-input"
                        placeholder="password"
                        value={f.password}
                        onChange={(e) => f.setPassword(e.target.value)}
                        disabled={hopping}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={`vp-pwd-btn${pwCopied ? " vp-pwd-btn-copied" : ""}`}
                        onClick={async () => {
                          if (pwCopied || f.password.length === 0) return;
                          if (await copyToClipboard(f.password)) {
                            setShowPassword(false);
                            setPwCopied(true);
                            window.setTimeout(
                              () => setPwCopied(false),
                              COPY_FEEDBACK_MS,
                            );
                          }
                        }}
                        title={pwCopied ? "copied" : "copy password"}
                        tabIndex={-1}
                        disabled={hopping || f.password.length === 0}
                      >
                        <PasswordCopyIcon copied={pwCopied} />
                      </button>
                      <button
                        type="button"
                        className="vp-pwd-btn"
                        onClick={() => setShowPassword((v) => !v)}
                        title={showPassword ? "hide password" : "show password"}
                        tabIndex={-1}
                        disabled={hopping || f.password.length === 0}
                      >
                        <PasswordEyeIcon shown={showPassword} />
                      </button>
                      <button
                        type="button"
                        className="vp-pwd-btn"
                        onClick={() => {
                          f.setPassword(generatePassword());
                          setShowPassword(true);
                        }}
                        title="generate random password"
                        tabIndex={-1}
                        disabled={hopping}
                      >
                        <PasswordRefreshIcon />
                      </button>
                    </div>
                  </div>
                )}
                {f.passwordError && (
                  <div className="vp-err-inline">{f.passwordError}</div>
                )}

                <button
                  type="submit"
                  className="vp-submit"
                  data-active={f.url.trim().length > 0 ? "1" : "0"}
                  disabled={hopping || f.url.trim().length === 0}
                >
                  {f.state === "encrypting"
                    ? "Encrypting locally…"
                    : f.state === "uploading"
                      ? "Hopping…"
                      : "Create Short Link"}
                </button>

                {f.errorMessage && (
                  <div className="vp-err-block">{f.errorMessage}</div>
                )}
              </form>
            )}
          </section>
        </main>

        <footer className="vp-footer">
          <div className="vp-footer-row">
            <span>No cookies · no trackers · no accounts</span>
            <span className="vp-footer-sep">◦</span>
            <span>AES-256-GCM · PBKDF2-SHA256</span>
          </div>
          <div className="vp-footer-attrib">
            Made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="vp-footer-link"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}

/**
 * Form-field wrapper that renders a small uppercase label above its child
 * control.
 *
 * - When `htmlFor` is provided the label is a real `<label htmlFor>`,
 *   associating it with a single input/select for screen-reader users.
 * - When `labelId` is provided instead, the label gets that `id`. The
 *   child container (e.g. a TTL button group) can then reference it via
 *   `aria-labelledby` to name a non-input group.
 *
 * Pass exactly one of the two, or neither for a purely visual label.
 */
function VoidField({
  label,
  htmlFor,
  labelId,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="vp-field">
      {htmlFor ? (
        <label className="vp-field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className="vp-field-label" id={labelId}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function VoidCheckbox({
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
    <label className={`vp-check${disabled ? " disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="vp-check-box">
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M1.5 5 L4 7.5 L8.5 2.5"
              stroke="#0a0418"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{children}</span>
    </label>
  );
}

function VoidResult({
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
  usesLeft?: number | undefined;
  deleteUrl?: string | undefined;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [hasCopiedOnce, setHasCopiedOnce] = useState(false);
  const [deleteCopied, setDeleteCopied] = useState(false);
  const [warned, setWarned] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Render the QR as a JSX <img> sourced from a data URL — avoids
  // assigning library-emitted HTML via innerHTML.
  useEffect(() => {
    const qr = qrcode(0, "M");
    qr.addData(shortUrl);
    qr.make();
    setQrSrc(qr.createDataURL(4, 2));
  }, [shortUrl]);

  return (
    <div className="vp-result">
      <span className="vp-sr-only" aria-live="polite">
        {copied
          ? "Short URL copied to clipboard."
          : deleteCopied
            ? "Delete URL copied to clipboard."
            : ""}
      </span>
      <div className="vp-result-kicker">
        Shortened · Only you know the destination
      </div>
      <h2 className="vp-result-title">
        Done. <em>Here's your link.</em>
      </h2>

      <div className="vp-result-row">
        <div className={`vp-result-url-row${shaking ? " warn" : ""}`}>
          {!hasCopiedOnce && (
            <div className="vp-doodly-arrow" aria-hidden="true">
              <span className="vp-doodly-text">copy this</span>
              <IconDoodlyArrow />
            </div>
          )}
          <span className="vp-result-url">{shortUrl}</span>
          <button
            type="button"
            className="vp-result-copy"
            onClick={async () => {
              if (await copyToClipboard(shortUrl)) {
                setCopied(true);
                setHasCopiedOnce(true);
                window.setTimeout(() => setCopied(false), 1400);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <div className="vp-qr" aria-label="QR code">
          {qrSrc ? <img src={qrSrc} alt="" /> : null}
        </div>
      </div>

      <dl className="vp-meta">
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
                ? "self-destruct after first use"
                : `${usesLeft} usages remain`}
            </dd>
          </div>
        )}
      </dl>

      <div className="vp-share">
        <span className="vp-share-label">SHARE VIA</span>
        <div className="vp-share-icons">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shortUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vp-share-icon"
            title="share via WhatsApp"
          >
            <IconWhatsApp />
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(shortUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vp-share-icon"
            title="share via Telegram"
          >
            <IconTelegram />
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("Short link")}&body=${encodeURIComponent(shortUrl)}`}
            className="vp-share-icon"
            title="share via email"
          >
            <IconEmail />
          </a>
          {canShare && (
            <button
              type="button"
              className="vp-share-icon"
              onClick={() => {
                navigator
                  .share({ title: "voidhop", url: shortUrl })
                  .catch(() => {});
              }}
              title="share link"
            >
              <IconShare />
            </button>
          )}
        </div>
      </div>

      {deleteUrl && (
        <div className="vp-revoke">
          <div className="vp-revoke-text">
            <div className="vp-revoke-label">
              <span className="vp-revoke-label-key">DELETE URL</span> · save
              this for deletion
            </div>
            <code>{deleteUrl}</code>
          </div>
          <button
            type="button"
            className="vp-revoke-copy"
            onClick={async () => {
              if (await copyToClipboard(deleteUrl)) {
                setDeleteCopied(true);
                window.setTimeout(() => setDeleteCopied(false), 1400);
              }
            }}
          >
            {deleteCopied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      )}

      <button
        type="button"
        className="vp-reset"
        onClick={() => {
          if (!hasCopiedOnce && !warned) {
            setWarned(true);
            setShaking(true);
            window.setTimeout(() => setShaking(false), 500);
            return;
          }
          onReset();
        }}
      >
        Shorten another link
      </button>
    </div>
  );
}

