import {
  createRootRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { REPO_URL } from "@/constants";

export const Route = createRootRoute({
  component: RootLayout,
});

/**
 * Paths that render a "full-bleed" design experience and suppress the
 * default header/footer chrome. The /1-/10 numbered routes are the
 * design-variant gallery; /designs is the index that links to them.
 */
const FULL_BLEED_PATHS = new Set<string>([
  "/designs",
  "/1",
  "/2",
  "/3",
  "/4",
  "/5",
  "/6",
  "/7",
  "/8",
  "/9",
  "/10",
  "/11",
  "/12",
]);

function RootLayout() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const fullBleed = FULL_BLEED_PATHS.has(pathname);

  if (fullBleed) {
    return (
      <div className="layout-fullbleed">
        <Outlet />
      </div>
    );
  }

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
        <div>
          Zero-knowledge URL shortener · Encrypted in your browser ·{" "}
          <BuildTag />
        </div>
        <div>
          Made with <span aria-label="love">❤️</span> by Sascha Majewsky ·{" "}
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

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
