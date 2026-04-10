import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/not-found")({
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <div className="card">
      <h1 className="card-title">Page not found</h1>
      <p>This page doesn't exist.</p>
      <p>
        <Link to="/">Back to VoidHop home</Link>
      </p>
    </div>
  );
}
