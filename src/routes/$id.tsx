/**
 * RedirectPage — `/:id`. SRS §8.2.
 *
 * The hook does all the security-critical work (hash validation, replaceState
 * scrubbing, decryption, validation, navigation). This component just renders
 * the appropriate state.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useRedirect } from "@/hooks/use-redirect";
import { RedirectStatus } from "@/components/redirect-status";
import { ErrorDisplay } from "@/components/error-display";
import type { RedirectError } from "@/hooks/use-redirect";

export const Route = createFileRoute("/$id")({
  component: RedirectPage,
});

function RedirectPage() {
  const { id } = Route.useParams();
  const { state, error, destinationHref } = useRedirect(id);

  if (state === "error" && error) {
    return <RedirectErrorView error={error} />;
  }

  const status = statusLabel(state);
  return (
    <RedirectStatus
      status={status}
      destinationHref={state === "redirecting" ? destinationHref : null}
    />
  );
}

function statusLabel(state: string): string {
  switch (state) {
    case "loading":
      return "Loading…";
    case "confirming":
      return "Confirming link…";
    case "decrypting":
      return "Decrypting in your browser…";
    case "validating":
      return "Validating destination…";
    case "redirecting":
      return "Redirecting…";
    default:
      return "…";
  }
}

function RedirectErrorView({ error }: { error: RedirectError }) {
  switch (error.type) {
    case "MISSING_KEY":
      if (error.inAppBrowser) {
        return (
          <ErrorDisplay
            title="Your in-app browser blocked part of this link."
            message='In-app browsers (Instagram, TikTok, Facebook Messenger, etc.) often strip the security key from VoidHop links. Tap the menu (•••) and choose "Open in Safari" / "Open in Chrome", then paste the original link there.'
          />
        );
      }
      return (
        <ErrorDisplay
          title="This link is incomplete."
          message="The decryption key is missing from the URL. Make sure you copied the full link."
        />
      );
    case "NOT_FOUND":
      return (
        <ErrorDisplay
          title="This link has expired or does not exist."
          message="VoidHop links automatically expire — there is nothing to recover."
        />
      );
    case "TAMPERED":
      return (
        <ErrorDisplay
          title="This link has been tampered with and cannot be decrypted safely."
          message="The encrypted contents failed integrity verification."
        />
      );
    case "DECRYPTION_FAILED":
      return (
        <ErrorDisplay
          title="Could not decrypt this link."
          message="The decryption key may be wrong, or your browser may not support the required cryptography."
        />
      );
    case "UNSAFE_SCHEME":
      return (
        <ErrorDisplay
          title="This link points to an unsupported or unsafe destination."
          message="VoidHop only redirects to http:// and https:// URLs."
        />
      );
    case "NETWORK_ERROR":
      return (
        <ErrorDisplay
          title="Could not reach VoidHop."
          message="Check your connection and try again."
        />
      );
    default:
      return <ErrorDisplay title="Something went wrong." />;
  }
}
