import { REPO_URL } from "@/constants";

/**
 * Bottom bar: privacy line + attribution + GitHub link. Stateless.
 */
export function PageFooter() {
  return (
    <footer className="vp-footer">
      <div className="vp-footer-row">
        <span>No cookies · no trackers · no accounts</span>
        <span className="vp-footer-sep">◦</span>
        <span>AES-256-GCM · PBKDF2-SHA256</span>
      </div>
      <div className="vp-footer-attrib">
        Made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="vp-footer-link"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
