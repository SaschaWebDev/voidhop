/**
 * ErrorDisplay — uniform error rendering. SRS FR-CREATE-13 / FR-REDIRECT-09.
 *
 * Surface only human-readable messages; never echo decrypted URLs into the
 * DOM as text content (SR-INPUT-06).
 */

export interface ErrorDisplayProps {
  title: string;
  message?: string;
}

export function ErrorDisplay({ title, message }: ErrorDisplayProps) {
  return (
    <div className="msg msg-error" role="alert">
      <p>
        <strong>{title}</strong>
      </p>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
