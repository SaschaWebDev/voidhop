import styles from "@/routes/index.module.css";

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
    <div className={styles.revoke}>
      <div className={styles.revokeText}>
        <div className={styles.revokeLabel}>
          <span className={styles.revokeLabelKey}>DELETE URL</span> · save this
          for deletion
        </div>
        <code>{deleteUrl}</code>
      </div>
      <button
        type="button"
        className={styles.revokeCopy}
        onClick={onCopy}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
