import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <a
          href="https://github.com/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Source
        </a>
      </footer>
    </div>
  );
}
