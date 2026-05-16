import { Link } from "@tanstack/react-router";
import { vp } from "@/components/void-portal";
import { REPO_URL } from "@/constants";

/**
 * Top bar with the brand mark on the left and the about / GitHub links
 * on the right. Stateless.
 */
export function PageHeader() {
  return (
    <header className="vp-header">
      <Link to="/" className="vp-brand">
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden="true"
          className="vp-mark"
        >
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="none"
            stroke={vp.accent}
            strokeOpacity="0.5"
          />
          <circle cx="14" cy="14" r="5" fill={vp.accent} />
        </svg>
        <span className="vp-wordmark">voidhop</span>
      </Link>
      <nav className="vp-nav">
        <Link to="/about">About</Link>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </nav>
    </header>
  );
}
