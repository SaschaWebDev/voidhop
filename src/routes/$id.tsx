/**
 * RedirectPage — `/:id`. SRS §8.2.
 *
 * The hook does all the security-critical work (hash validation, replaceState
 * scrubbing, decryption, validation, navigation). This component just renders
 * the appropriate state.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useRedirect } from "@/hooks/use-redirect";
import { useDocumentHead } from "@/hooks/use-document-head";
import { RedirectStatus } from "@/components/redirect-status";
import { ErrorDisplay } from "@/components/error-display";
import { PasswordPrompt } from "@/components/password-prompt";
import type { RedirectError } from "@/hooks/use-redirect";

export const Route = createFileRoute("/$id")({
  component: RedirectPage,
});

function RedirectPage() {
  useDocumentHead({
    title: "Opening link — VoidHop",
    robots: "noindex,nofollow",
  });
  const { id } = Route.useParams();
  const {
    state,
    error,
    destinationHref,
    attemptsLeft,
    passwordError,
    backoffUntil,
    submitPassword,
  } = useRedirect(id);

  if (state === "error" && error) {
    return <RedirectErrorView error={error} />;
  }

  if (
    (state === "password-required" || state === "verifying") &&
    attemptsLeft !== null
  ) {
    return (
      <PasswordPrompt
        attemptsLeft={attemptsLeft}
        busy={state === "verifying"}
        errorMessage={passwordError}
        backoffUntil={backoffUntil}
        onSubmit={(password) => submitPassword?.(password)}
      />
    );
  }

  const status = statusLabel(state);
  return (
    <RedirectStatus
      status={status}
      destinationHref={state === "redirecting" ? destinationHref : null}
    />
  );
}

export function statusLabel(state: string): string {
  switch (state) {
    case "loading":
      return "Loading…";
    case "confirming":
      return "Confirming link…";
    case "verifying":
      return "Verifying password…";
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

/**
 * Map a `RedirectError` to the user-facing `{ title, message }` pair the
 * `<ErrorDisplay>` will render. Pure — exported for unit testing and so
 * that the JSX render path stays a one-liner.
 */
export function mapRedirectErrorToContent(
  error: RedirectError,
): { title: string; message?: string } {
  switch (error.type) {
    case "MISSING_KEY":
      if (error.inAppBrowser) {
        return {
          title: "Your in-app browser blocked part of this link.",
          message:
            'In-app browsers (Instagram, TikTok, Facebook Messenger, etc.) often strip the security key from VoidHop links. Tap the menu (•••) and choose "Open in Safari" / "Open in Chrome", then paste the original link there.',
        };
      }
      return {
        title: "This link is incomplete.",
        message:
          "The decryption key is missing from the URL. Make sure you copied the full link.",
      };
    case "MISSING_SALT":
      return {
        title: "This link is incomplete.",
        message:
          "The password salt is missing or malformed. The link was likely truncated in transit — ask the sender for the full URL.",
      };
    case "NOT_FOUND":
      return {
        title: "This link has expired or does not exist.",
        message:
          "VoidHop links automatically expire — there is nothing to recover.",
      };
    case "LINK_DESTROYED":
      return {
        title: "This link has been permanently destroyed.",
        message:
          "Too many wrong password attempts. VoidHop deletes password-protected links after five misses to prevent brute-force guessing — even the correct password will no longer work.",
      };
    case "TAMPERED":
      return {
        title:
          "This link has been tampered with and cannot be decrypted safely.",
        message: "The encrypted contents failed integrity verification.",
      };
    case "DECRYPTION_FAILED":
      return {
        title: "Could not decrypt this link.",
        message:
          "The decryption key may be wrong, or your browser may not support the required cryptography.",
      };
    case "UNSAFE_SCHEME":
      return {
        title: "This link points to an unsupported or unsafe destination.",
        message: "VoidHop only redirects to http:// and https:// URLs.",
      };
    case "NETWORK_ERROR":
      return {
        title: "Could not reach VoidHop.",
        message: "Check your connection and try again.",
      };
    default:
      return { title: "Something went wrong." };
  }
}

function RedirectErrorView({ error }: { error: RedirectError }) {
  const { title, message } = mapRedirectErrorToContent(error);
  return <ErrorDisplay title={title} {...(message !== undefined ? { message } : {})} />;
}
