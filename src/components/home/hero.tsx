const VOID_STATS = [
  ["AES-256 GCM", "Military Grade Encryption"],
  ["0 logs", "forever"],
] as const;

/**
 * Hero pitch: pill, headline, lede, two-stat strip. Pure presentation.
 */
export function Hero() {
  return (
    <section className="vp-pitch">
      <div className="vp-pill">
        <span className="vp-pill-dot" />
        encrypted · client-side · zero-knowledge
      </div>

      <h1 className="vp-h1">
        Warp right <span className="vp-h1-accent">through the</span>
        <br />
        <span className="vp-h1-accent">void.</span>
      </h1>

      <p className="vp-lede">
        Your short link takes you to your destination without anyone knowing
        where you're going (even us). The URL is encrypted in your local
        browser and deleted immediately. No accounts. No tracking. Just void.
      </p>

      <ul className="vp-stats">
        {VOID_STATS.map(([a, b]) => (
          <li key={a}>
            <div className="vp-stat-a">{a}</div>
            <div className="vp-stat-b">{b}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
