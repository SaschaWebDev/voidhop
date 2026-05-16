/**
 * `DeletePage` reads the deletion token from the URL fragment, scrubs the
 * fragment, and submits to `DELETE /api/v1/links/:id` via the api client.
 *
 * Test surface mocks (1) the `@/api/client` deleteLink call so we can drive
 * every server outcome (success / NOT_FOUND / other ApiError / non-ApiError
 * throw) and (2) `@tanstack/react-router`'s `createFileRoute` so the
 * `Route.useParams()` call resolves to a known id without standing up a
 * router.
 */

import "@testing-library/jest-dom/vitest";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/types";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () =>
    (config: { component: () => React.ReactElement }) => ({
      ...config,
      useParams: () => ({ id: "abc123" }),
    }),
}));

vi.mock("@/api/client", () => ({
  deleteLink: vi.fn(),
}));

import { Route as DeleteRoute } from "@/routes/delete.$id";
import { deleteLink } from "@/api/client";

const DeletePage = (DeleteRoute as unknown as { component: () => React.ReactElement })
  .component;

const VALID_TOKEN = "a".repeat(43);

function setHash(fragment: string): void {
  window.location.hash = fragment;
}

beforeEach(() => {
  window.location.hash = "";
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("DeletePage", () => {
  it("renders the 'incomplete delete link' error when the token length is wrong", async () => {
    setHash("short-token");
    render(<DeletePage />);
    expect(
      await screen.findByText("This delete link is incomplete."),
    ).toBeInTheDocument();
    expect(deleteLink).not.toHaveBeenCalled();
  });

  it("scrubs the fragment from the URL after reading it", async () => {
    setHash(VALID_TOKEN);
    render(<DeletePage />);
    await screen.findByRole("button", { name: /Delete permanently/i });
    expect(window.location.hash).toBe("");
  });

  it("renders the confirm screen with a valid token", async () => {
    setHash(VALID_TOKEN);
    render(<DeletePage />);
    expect(
      await screen.findByText("Delete this link?"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete permanently/i }),
    ).toBeEnabled();
  });

  it("clicking Delete permanently invokes deleteLink with id + token, then shows success", async () => {
    setHash(VALID_TOKEN);
    vi.mocked(deleteLink).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<DeletePage />);
    await user.click(
      await screen.findByRole("button", { name: /Delete permanently/i }),
    );
    expect(deleteLink).toHaveBeenCalledWith("abc123", VALID_TOKEN);
    expect(await screen.findByText("Link destroyed")).toBeInTheDocument();
  });

  it("shows the 'nothing to delete' state when the server returns NOT_FOUND", async () => {
    setHash(VALID_TOKEN);
    vi.mocked(deleteLink).mockRejectedValueOnce(
      new ApiError("NOT_FOUND", "not found"),
    );
    const user = userEvent.setup();
    render(<DeletePage />);
    await user.click(
      await screen.findByRole("button", { name: /Delete permanently/i }),
    );
    expect(await screen.findByText("Nothing to delete.")).toBeInTheDocument();
  });

  it("shows the network-error state for any other ApiError type", async () => {
    setHash(VALID_TOKEN);
    vi.mocked(deleteLink).mockRejectedValueOnce(
      new ApiError("SERVER_ERROR", "5xx"),
    );
    const user = userEvent.setup();
    render(<DeletePage />);
    await user.click(
      await screen.findByRole("button", { name: /Delete permanently/i }),
    );
    expect(
      await screen.findByText("Could not reach VoidHop."),
    ).toBeInTheDocument();
  });

  it("shows the network-error state for non-ApiError throwables", async () => {
    setHash(VALID_TOKEN);
    vi.mocked(deleteLink).mockRejectedValueOnce(
      new TypeError("bare-network failure"),
    );
    const user = userEvent.setup();
    render(<DeletePage />);
    await user.click(
      await screen.findByRole("button", { name: /Delete permanently/i }),
    );
    expect(
      await screen.findByText("Could not reach VoidHop."),
    ).toBeInTheDocument();
  });
});
