/**
 * RedirectStatus — "Redirecting…" splash with constant-text manual fallback.
 * SRS FR-REDIRECT-07 / FR-REDIRECT-08 / SR-INPUT-06.
 *
 * The fallback link's visible text is the constant string "Click here to
 * proceed" — never the destination URL itself. The href is the
 * canonical `validated.href` form, never the raw decrypted string.
 */

export interface RedirectStatusProps {
  status: string;
  /** Validated URL.href — only set during the 'redirecting' state */
  destinationHref?: string | null;
}

export function RedirectStatus({ status, destinationHref }: RedirectStatusProps) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <p className="splash-status">{status}</p>
      {destinationHref ? (
        <p>
          <a href={destinationHref} rel="noopener noreferrer">
            Click here to proceed
          </a>
        </p>
      ) : null}
    </div>
  );
}
