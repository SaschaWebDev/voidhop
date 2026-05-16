import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { IconDoodlyArrow } from "@/components/icons";
import styles from "@/routes/index.module.css";

interface ResultUrlRowProps {
  shortUrl: string;
  copied: boolean;
  hasCopiedOnce: boolean;
  shaking: boolean;
  onCopy: () => void;
}

/**
 * The purple-outlined URL row with the doodle "copy this" arrow above the
 * Copy button, plus the QR card to the right.
 *
 * QR is rendered as `<img src={dataURL}>` (no innerHTML injection). The
 * doodle nudge stays visible until the first successful copy, then never
 * again for the same result.
 */
export function ResultUrlRow({
  shortUrl,
  copied,
  hasCopiedOnce,
  shaking,
  onCopy,
}: ResultUrlRowProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    const qr = qrcode(0, "M");
    qr.addData(shortUrl);
    qr.make();
    setQrSrc(qr.createDataURL(4, 2));
  }, [shortUrl]);

  return (
    <div className={styles.resultRow}>
      <div
        className={`${styles.resultUrlRow}${shaking ? ` ${styles.warn}` : ""}`}
      >
        {!hasCopiedOnce && (
          <div className={styles.doodlyArrow} aria-hidden="true">
            <span className={styles.doodlyText}>copy this</span>
            <IconDoodlyArrow />
          </div>
        )}
        <span className={styles.resultUrl}>{shortUrl}</span>
        <button type="button" className={styles.resultCopy} onClick={onCopy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div className={styles.qr} aria-label="QR code">
        {qrSrc ? <img src={qrSrc} alt="" /> : null}
      </div>
    </div>
  );
}
