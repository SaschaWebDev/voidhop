/**
 * DeletePage — `/delete/:id`. SRS §8.3 / §4.6.
 *
 * Reads the creator deletion token from the URL fragment, scrubs the
 * fragment via replaceState (SR-FRAG-04 — same treatment as the redirect
 * key), and submits the token to `DELETE /api/v1/links/:id`. The server
 * re-hashes the token and constant-time compares with the stored hash.
 *
 * Any failure (wrong token, expired, never existed, never had a deletion
 * token registered) collapses to the same "NOT_FOUND" surface from the
 * server, so this UI shows a uniform "already gone" state for all miss
 * cases. The server's same-error-code policy is what makes that safe.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DELETION_TOKEN_B64URL_LENGTH } from "@/constants";
import { deleteLink } from "@/api/client";
import { ApiError } from "@/api/types";
import { ErrorDisplay } from "@/components/error-display";

export const Route = createFileRoute("/delete/$id")({
  component: DeletePage,
});

type DeleteState =
  | "loading"
  | "confirming-intent"
  | "deleting"
  | "deleted"
  | "not-found"
  | "invalid-token"
  | "network-error";

function DeletePage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<DeleteState>("loading");
  const tokenRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Read the token from the fragment and scrub the fragment immediately,
    // before we do anything else. Same treatment as the redirect key.
    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const token = rawHash.split("#")[0] ?? "";
    if (token.length !== DELETION_TOKEN_B64URL_LENGTH) {
      setState("invalid-token");
      return;
    }
    tokenRef.current = token;

    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // Non-fatal.
    }
    setState("confirming-intent");
  }, []);

  const onConfirm = async () => {
    if (tokenRef.current === null) return;
    setState("deleting");
    try {
      await deleteLink(id, tokenRef.current);
      // Scrub the token from memory after use.
      tokenRef.current = null;
      setState("deleted");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.type === "NOT_FOUND") {
          setState("not-found");
          return;
        }
        setState("network-error");
        return;
      }
      setState("network-error");
    }
  };

  if (state === "loading") {
    return (
      <div className="splash" role="status" aria-live="polite">
        <p className="splash-status">Loading…</p>
      </div>
    );
  }

  if (state === "invalid-token") {
    return (
      <ErrorDisplay
        title="This delete link is incomplete."
        message="The deletion token is missing or malformed. Check that you copied the full URL."
      />
    );
  }

  if (state === "not-found") {
    return (
      <ErrorDisplay
        title="Nothing to delete."
        message="This link has already been deleted, has expired, or the deletion token does not match. Either way, no record remains on the server."
      />
    );
  }

  if (state === "network-error") {
    return (
      <ErrorDisplay
        title="Could not reach VoidHop."
        message="Check your connection and try again. Your delete URL is still valid."
      />
    );
  }

  if (state === "deleted") {
    return (
      <div className="card msg-success" role="status" aria-live="polite">
        <h1 className="card-title">Link destroyed</h1>
        <p>
          The record was removed from storage. The shortened URL will now
          return "not found" to anyone who tries to open it.
        </p>
      </div>
    );
  }

  // state === "confirming-intent"
  return (
    <div className="card">
      <h1 className="card-title">Delete this link?</h1>
      <p>
        This cannot be undone. Anyone who opens the shortened URL after you
        confirm will see a "not found" error.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={state !== "confirming-intent"}
        >
          Delete permanently
        </button>
      </div>
    </div>
  );
}
