/**
 * Home — voidhop's landing-and-tool route.
 *
 * Thin route shell that composes the cosmic background, header, hero, the
 * create-or-result panel, and the footer. All form/result state lives in
 * `useShortenForm` and its sub-hooks; the visual regions are isolated
 * components under src/components/home/ so this file stays small and
 * grep-able.
 *
 * Self-hosted fonts are imported here so the route bundle pulls them in.
 * The cosmic-design styles live in `index.module.css` as a CSS Module:
 * Vite hashes each class name per file, so no prefix is needed to avoid
 * collisions with the global styles in `src/styles.css`.
 */

import "@fontsource/fraunces/300.css";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/300-italic.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";

import { createFileRoute } from "@tanstack/react-router";
import { useShortenForm, formatExpiry } from "@/hooks/use-shorten-form";
import { Stars, Portal } from "@/components/home/background";
import { PageHeader } from "@/components/home/page-header";
import { PageFooter } from "@/components/home/page-footer";
import { Hero } from "@/components/home/hero";
import { CreateForm } from "@/components/home/create-form";
import { ResultPanel } from "@/components/home/result-panel";

import styles from "./index.module.css";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const f = useShortenForm();
  const hopping = f.isBusy;

  return (
    <div className={styles.root}>
      <Stars />
      <Portal />
      <div className={styles.noise} aria-hidden="true" />

      <PageHeader />

      <main className={styles.main}>
        <Hero />

        <section
          className={`${styles.card}${hopping ? ` ${styles.hopping}` : ""}`}
        >
          <div className={styles.shimmer} aria-hidden="true" />
          {f.state === "success" && f.result ? (
            <ResultPanel
              shortUrl={f.result.shortUrl}
              expiry={formatExpiry(f.result.expiresAt)}
              passwordProtected={f.result.passwordProtected}
              usesLeft={f.result.usesLeft}
              deleteUrl={f.result.deleteUrl}
              onReset={f.reset}
            />
          ) : (
            <CreateForm form={f} />
          )}
        </section>
      </main>

      <PageFooter />
    </div>
  );
}
