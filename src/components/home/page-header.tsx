import { Link } from "@tanstack/react-router";
import { tokens } from "@/components/home/background";
import { REPO_URL } from "@/constants";
import styles from "@/routes/index.module.css";

/**
 * Top bar with the brand mark on the left and the about / GitHub links
 * on the right. Stateless.
 */
export function PageHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden="true"
          className={styles.mark}
        >
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="none"
            stroke={tokens.accent}
            strokeOpacity="0.5"
          />
          <circle cx="14" cy="14" r="5" fill={tokens.accent} />
        </svg>
        <span className={styles.wordmark}>voidhop</span>
      </Link>
      <nav className={styles.nav}>
        <Link to="/about">About</Link>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </nav>
    </header>
  );
}
