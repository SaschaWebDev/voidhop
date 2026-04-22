import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { REPO_URL } from "@/constants";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner">
          <Link to="/" className="layout-brand">
            VoidHop
          </Link>
          <nav className="layout-nav">
            <Link to="/about">About</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      <footer className="layout-footer">
        Zero-knowledge URL shortener · Encrypted in your browser ·{" "}
        <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
          Source
        </a>{" "}
        · <BuildTag />
      </footer>
    </div>
  );
}

/**
 * Renders the build identifier. In a production build this is a link to the
 * exact commit on the public source repo; in development it is a muted
 * `dev` label. The purpose is verifiability — a visitor can confirm that
 * the code running in their browser matches the audited source.
 */
function BuildTag() {
  if (__BUILD_SHA__ === "dev") {
    return (
      <span className="layout-build" aria-label="Development build">
        <code>dev</code>
      </span>
    );
  }
  return (
    <a
      href={`${REPO_URL}/tree/${__BUILD_SHA__}`}
      rel="noopener noreferrer"
      target="_blank"
      aria-label={`Source at commit ${__BUILD_SHA__}`}
      title={__BUILD_SHA__}
    >
      <code>{__BUILD_SHA_SHORT__}</code>
    </a>
  );
}
