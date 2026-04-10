/**
 * CopyButton — copy-to-clipboard with visual feedback. SRS FR-CREATE-07.
 *
 * Falls back to `document.execCommand('copy')` when the async clipboard
 * API is unavailable (e.g., insecure context).
 */

import { useCallback, useState } from "react";

export interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        ok = legacyCopy(text);
      }
    } catch {
      ok = legacyCopy(text);
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <button
      type="button"
      className="btn"
      onClick={onCopy}
      aria-label={`${label} to clipboard`}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function legacyCopy(text: string): boolean {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
