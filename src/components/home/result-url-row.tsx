import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { IconDoodlyArrow } from "@/components/icons";

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
    <div className="vp-result-row">
      <div className={`vp-result-url-row${shaking ? " warn" : ""}`}>
        {!hasCopiedOnce && (
          <div className="vp-doodly-arrow" aria-hidden="true">
            <span className="vp-doodly-text">copy this</span>
            <IconDoodlyArrow />
          </div>
        )}
        <span className="vp-result-url">{shortUrl}</span>
        <button type="button" className="vp-result-copy" onClick={onCopy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div className="vp-qr" aria-label="QR code">
        {qrSrc ? <img src={qrSrc} alt="" /> : null}
      </div>
    </div>
  );
}
