import { useState } from "react";
import { copyToClipboard } from "@/hooks/use-shorten-form";
import { ResultUrlRow } from "@/components/home/result-url-row";
import { ShareRow } from "@/components/home/share-row";
import { RevokeBlock } from "@/components/home/revoke-block";

const COPY_FEEDBACK_MS = 1400;
const SHAKE_MS = 500;

interface ResultPanelProps {
  shortUrl: string;
  expiry: string;
  passwordProtected: boolean;
  usesLeft?: number | undefined;
  deleteUrl?: string | undefined;
  onReset: () => void;
}

/**
 * The post-shortening result panel. Coordinates copy-feedback state across
 * sub-regions (URL row + revoke block) and gates the "Shorten another
 * link" reset behind a one-shot shake-and-nudge if the user hasn't copied
 * the URL yet.
 *
 *  - `copied` / `deleteCopied` — transient (~1.4 s) for the "Copied ✓" label.
 *  - `hasCopiedOnce` — persistent for the doodle-arrow visibility.
 *  - `warned` / `shaking` — gate the reset and trigger the warn animation.
 *  - QR rendering lives in `ResultUrlRow`.
 */
export function ResultPanel({
  shortUrl,
  expiry,
  passwordProtected,
  usesLeft,
  deleteUrl,
  onReset,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [hasCopiedOnce, setHasCopiedOnce] = useState(false);
  const [deleteCopied, setDeleteCopied] = useState(false);
  const [warned, setWarned] = useState(false);
  const [shaking, setShaking] = useState(false);

  const onCopyShort = async () => {
    if (await copyToClipboard(shortUrl)) {
      setCopied(true);
      setHasCopiedOnce(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
  };

  const onCopyDelete = async () => {
    if (!deleteUrl) return;
    if (await copyToClipboard(deleteUrl)) {
      setDeleteCopied(true);
      window.setTimeout(() => setDeleteCopied(false), COPY_FEEDBACK_MS);
    }
  };

  const onResetClick = () => {
    if (!hasCopiedOnce && !warned) {
      setWarned(true);
      setShaking(true);
      window.setTimeout(() => setShaking(false), SHAKE_MS);
      return;
    }
    onReset();
  };

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

      <ResultUrlRow
        shortUrl={shortUrl}
        copied={copied}
        hasCopiedOnce={hasCopiedOnce}
        shaking={shaking}
        onCopy={onCopyShort}
      />

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

      <ShareRow shortUrl={shortUrl} />

      {deleteUrl && (
        <RevokeBlock
          deleteUrl={deleteUrl}
          copied={deleteCopied}
          onCopy={onCopyDelete}
        />
      )}

      <button type="button" className="vp-reset" onClick={onResetClick}>
        Shorten another link
      </button>
    </div>
  );
}
