/**
 * CreatePage — paste a URL, pick a TTL, get a short URL. SRS §8.1.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateLink } from "@/hooks/use-create-link";
import { TtlSelector } from "@/components/ttl-selector";
import { ShortUrlResult } from "@/components/short-url-result";
import { ErrorDisplay } from "@/components/error-display";
import { validateInputUrl } from "@/utils/url-validation";
import { DEFAULT_TTL_SECONDS, USES_LEFT_OPTIONS } from "@/constants";
import { ApiError } from "@/api/types";
import { CryptoError } from "@/crypto";

export const Route = createFileRoute("/")({
  component: CreatePage,
});

function CreatePage() {
  const [url, setUrl] = useState("");
  const [ttl, setTtl] = useState<number>(DEFAULT_TTL_SECONDS);
  const [inputError, setInputError] = useState<string | null>(null);
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Undefined = unlimited. Other values map to USES_LEFT_OPTIONS.
  const [usesLeft, setUsesLeft] = useState<number | undefined>(undefined);
  const [includeDeletionToken, setIncludeDeletionToken] = useState(false);
  const create = useCreateLink();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    setPasswordError(null);
    const validation = validateInputUrl(url);
    if (!validation.ok) {
      setInputError(humanizeInputError(validation.error.type));
      return;
    }
    if (protect) {
      if (password.length === 0) {
        setPasswordError("Please enter a password.");
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }
    }
    await create.mutate(validation.value, ttl, {
      ...(protect ? { password } : {}),
      ...(usesLeft !== undefined ? { usesLeft } : {}),
      ...(includeDeletionToken ? { includeDeletionToken: true } : {}),
    });
  };

  const onUrlChange = (next: string) => {
    setUrl(next);
    setInputError(null);
    if (create.state === "success" || create.state === "error") {
      create.reset();
    }
  };

  const isBusy = create.state === "encrypting" || create.state === "uploading";

  return (
    <>
      <div className="card">
        <h1 className="card-title">Shorten a URL — privately</h1>
        <p className="field-help">
          The URL is encrypted in your browser before it leaves. The server
          never sees the destination.
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="url-input" className="field-label">
              URL to shorten
            </label>
            <input
              id="url-input"
              type="url"
              className="field-input"
              placeholder="https://example.com/some/long/path"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              disabled={isBusy}
              autoComplete="off"
              spellCheck={false}
              required
            />
            {inputError && (
              <p className="field-help" style={{ color: "var(--error-fg)" }}>
                {inputError}
              </p>
            )}
          </div>

          <div className="field">
            <span className="field-label">Expires in</span>
            <TtlSelector value={ttl} onChange={setTtl} disabled={isBusy} />
            <p className="field-help">
              All links expire automatically — 7 days is the maximum.
            </p>
          </div>

          <div className="field">
            <label className="field-label" style={{ fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={protect}
                onChange={(e) => {
                  setProtect(e.target.checked);
                  setPasswordError(null);
                  if (!e.target.checked) {
                    setPassword("");
                    setConfirmPassword("");
                  }
                }}
                disabled={isBusy}
                style={{ marginRight: 8 }}
              />
              Protect with a password (optional)
            </label>
            {protect ? (
              <div style={{ marginTop: 8 }}>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  disabled={isBusy}
                  autoComplete="new-password"
                  aria-label="Password"
                  style={{ marginBottom: 8 }}
                />
                <input
                  type="password"
                  className="field-input"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  disabled={isBusy}
                  autoComplete="new-password"
                  aria-label="Confirm password"
                />
                {passwordError ? (
                  <p
                    className="field-help"
                    style={{ color: "var(--error-fg)" }}
                  >
                    {passwordError}
                  </p>
                ) : (
                  <p className="field-help">
                    The recipient will need this password to open the link.
                    VoidHop cannot recover it — store it somewhere safe.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="uses-select" className="field-label">
              Usage limit
            </label>
            <select
              id="uses-select"
              className="field-input"
              value={usesLeft === undefined ? "" : String(usesLeft)}
              onChange={(e) => {
                const v = e.target.value;
                setUsesLeft(v === "" ? undefined : Number(v));
              }}
              disabled={isBusy}
            >
              {USES_LEFT_OPTIONS.map((opt) => (
                <option
                  key={opt.value === undefined ? "unlimited" : opt.value}
                  value={opt.value === undefined ? "" : String(opt.value)}
                >
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="field-help">
              Capped at usage count = server deletes the record on the final
              read, independent of the expiry timer. Privacy tradeoff: opting
              in means the server writes to storage on every read, so reads
              become observable in infra logs.
            </p>
          </div>

          <div className="field">
            <label className="field-label" style={{ fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={includeDeletionToken}
                onChange={(e) => setIncludeDeletionToken(e.target.checked)}
                disabled={isBusy}
                style={{ marginRight: 8 }}
              />
              Generate a delete URL (optional)
            </label>
            <p className="field-help">
              Gives you a second URL that destroys the link on demand, before
              the expiry timer. Keep it — losing it means waiting for the
              automatic expiry. The server stores only its hash and never
              learns the token itself.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isBusy || url.trim().length === 0}
          >
            {create.state === "encrypting"
              ? "Encrypting…"
              : create.state === "uploading"
                ? "Uploading…"
                : "Shorten"}
          </button>
        </form>
      </div>

      {create.state === "error" && create.error && (
        <ErrorDisplay
          title="Could not create link"
          message={humanizeCreateError(create.error)}
        />
      )}

      {create.state === "success" && create.result && (
        <ShortUrlResult
          result={create.result}
          onCreateAnother={() => {
            setUrl("");
            setProtect(false);
            setPassword("");
            setConfirmPassword("");
            setPasswordError(null);
            setUsesLeft(undefined);
            setIncludeDeletionToken(false);
            create.reset();
          }}
        />
      )}
    </>
  );
}

function humanizeInputError(type: string): string {
  switch (type) {
    case "EMPTY":
      return "Please enter a URL.";
    case "PARSE_FAILED":
      return "That doesn't look like a valid URL.";
    case "UNSUPPORTED_SCHEME":
      return "Only http:// and https:// URLs are supported.";
    default:
      return "Invalid URL.";
  }
}

function humanizeCreateError(err: CryptoError | ApiError): string {
  if (err instanceof CryptoError) {
    if (err.type === "URL_TOO_LONG") {
      return "This URL is too long to shorten.";
    }
    if (err.type === "PASSWORD_EMPTY") {
      return "Password must not be empty.";
    }
    return "Encryption failed in your browser.";
  }
  switch (err.type) {
    case "RATE_LIMITED":
      return "You've created too many links recently. Try again in a few minutes.";
    case "BUDGET_EXHAUSTED":
      return "VoidHop has reached its daily link creation limit. Try again tomorrow.";
    case "ORIGIN_BUDGET_EXHAUSTED":
      return "This service has reached today's quota for your origin.";
    case "BLOB_TOO_LARGE":
      return "This URL is too long to shorten.";
    case "VALIDATION_ERROR":
      return "The server rejected the request. This usually means the URL is malformed.";
    case "NETWORK_ERROR":
      return "Could not reach VoidHop. Check your connection.";
    case "NOT_FOUND":
      // Should never fire in normal use — the create endpoint is not a
      // 404-able resource. If you see this, the worker is misconfigured:
      // the POST /api/v1/links route is not registered, or wrangler dev
      // is not running. Check the worker console.
      return "VoidHop is misconfigured — the create endpoint is unreachable. If you're running locally, make sure both the frontend and the worker dev server are running, and check the worker console for errors.";
    default:
      return "Something went wrong on the server.";
  }
}
