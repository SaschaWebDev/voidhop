import styles from "@/routes/index.module.css";

const HOME_STATS = [
  ["AES-256 GCM", "Military Grade Encryption"],
  ["0 logs", "forever"],
] as const;

/**
 * Hero pitch: pill, headline, lede, two-stat strip. Pure presentation.
 */
export function Hero() {
  return (
    <section>
      <div className={styles.pill}>
        <span className={styles.pillDot} />
        encrypted · client-side · zero-knowledge
      </div>

      <h1 className={styles.h1}>
        Warp right <span className={styles.h1Accent}>through the</span>
        <br />
        <span className={styles.h1Accent}>void.</span>
      </h1>

      <p className={styles.lede}>
        Your short link takes you to your destination without anyone knowing
        where you're going (even us). The URL is encrypted in your local
        browser and deleted immediately. No accounts. No tracking. Just void.
      </p>

      <ul className={styles.stats}>
        {HOME_STATS.map(([a, b]) => (
          <li key={a}>
            <div className={styles.statA}>{a}</div>
            <div className={styles.statB}>{b}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
