interface RevokeBlockProps {
  deleteUrl: string;
  copied: boolean;
  onCopy: () => void;
}

/**
 * Dashed-border block displaying the one-time delete URL with its own
 * copy button. The "DELETE URL" key is emphasized in dark red; the rest
 * of the helper text stays faint.
 */
export function RevokeBlock({ deleteUrl, copied, onCopy }: RevokeBlockProps) {
  return (
    <div className="vp-revoke">
      <div className="vp-revoke-text">
        <div className="vp-revoke-label">
          <span className="vp-revoke-label-key">DELETE URL</span> · save this
          for deletion
        </div>
        <code>{deleteUrl}</code>
      </div>
      <button type="button" className="vp-revoke-copy" onClick={onCopy}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
