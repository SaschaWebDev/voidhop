import {
  IconEmail,
  IconShare,
  IconTelegram,
  IconWhatsApp,
} from "@/components/icons";

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
  );
}
