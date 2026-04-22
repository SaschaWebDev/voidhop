/**
 * ShortUrlResult — display the short URL, copy button, QR code, and expiry.
 * SRS FR-CREATE-06..09.
 */

import { useEffect, useRef } from "react";
import qrcode from "qrcode-generator";
import { CopyButton } from "./copy-button";
import type { ShortLinkResult } from "@/hooks/use-create-link";

export interface ShortUrlResultProps {
  result: ShortLinkResult;
  onCreateAnother: () => void;
}

export function ShortUrlResult({ result, onCreateAnother }: ShortUrlResultProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    const qr = qrcode(0, "M");
    qr.addData(result.shortUrl);
    qr.make();
    // qrcode-generator emits an inline <img> tag.
    qrRef.current.innerHTML = qr.createImgTag(4, 0);
  }, [result.shortUrl]);

  const expiry = formatExpiry(result.expiresAt);

  return (
    <div className="card msg-success" role="status" aria-live="polite">
      <h2 className="card-title">Your short URL</h2>
      <div className="result-url">
        <input
          type="text"
          value={result.shortUrl}
          readOnly
          aria-label="Short URL"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={result.shortUrl} />
      </div>
      <p className="result-meta">Expires {expiry}</p>
      {result.usesLeft !== undefined ? (
        <p className="result-meta" style={{ color: "var(--accent-fg)" }}>
          Self-destructs after{" "}
          {result.usesLeft === 1 ? "one read" : `${result.usesLeft} reads`}.
        </p>
      ) : null}
      {result.passwordProtected ? (
        <p className="result-meta" style={{ color: "var(--accent-fg)" }}>
          Password-protected. Share the password with the recipient{" "}
          <em>separately</em> — not in the same message as this link.
        </p>
      ) : null}
      {result.deleteUrl ? (
        <div
          className="result-url"
          style={{ marginTop: 12 }}
          aria-label="Delete URL"
        >
          <input
            type="text"
            value={result.deleteUrl}
            readOnly
            aria-label="Delete URL"
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton text={result.deleteUrl} />
        </div>
      ) : null}
      {result.deleteUrl ? (
        <p className="result-meta" style={{ color: "var(--warning-fg)" }}>
          <strong>Delete URL</strong> — save this separately. Anyone with it
          can destroy the link. You won't see it again.
        </p>
      ) : null}
      <div className="result-qr" ref={qrRef} aria-label="QR code" />
      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={onCreateAnother}>
          Create another
        </button>
      </div>
    </div>
  );
}

function formatExpiry(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    return `on ${date} ${time} UTC`;
  } catch {
    return "soon";
  }
}
