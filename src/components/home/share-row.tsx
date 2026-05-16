import {
  IconEmail,
  IconShare,
  IconTelegram,
  IconWhatsApp,
} from "@/components/icons";
import styles from "@/routes/index.module.css";

interface ShareRowProps {
  shortUrl: string;
}

/**
 * "SHARE VIA" row with WhatsApp / Telegram / email links plus the native
 * Web-Share button (only rendered when navigator.share is available).
 *
 * All four targets use the same shortUrl; the native button silently
 * swallows the user-cancel rejection.
 */
export function ShareRow({ shortUrl }: ShareRowProps) {
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className={styles.share}>
      <span className={styles.shareLabel}>SHARE VIA</span>
      <div className={styles.shareIcons}>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shortUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shareIcon}
          title="share via WhatsApp"
        >
          <IconWhatsApp />
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(shortUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shareIcon}
          title="share via Telegram"
        >
          <IconTelegram />
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent("Short link")}&body=${encodeURIComponent(shortUrl)}`}
          className={styles.shareIcon}
          title="share via email"
        >
          <IconEmail />
        </a>
        {canShare && (
          <button
            type="button"
            className={styles.shareIcon}
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
  );
}
