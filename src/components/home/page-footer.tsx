import { REPO_URL } from "@/constants";
import styles from "@/routes/index.module.css";

/**
 * Bottom bar: privacy line + attribution + GitHub link. Stateless.
 */
export function PageFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerRow}>
        <span>No cookies · no trackers · no accounts</span>
        <span className={styles.footerSep}>◦</span>
        <span>AES-256-GCM · PBKDF2-SHA256</span>
      </div>
      <div className={styles.footerAttrib}>
        Made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
