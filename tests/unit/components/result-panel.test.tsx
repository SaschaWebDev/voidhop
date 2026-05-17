/**
 * `ResultPanel` coordinates the post-shortening view: short-URL row,
 * metadata (expiry / lock / uses-left), share buttons, optional revoke
 * block, and the "shorten another link" reset button. The reset button
 * is gated by a one-shot shake if the user hasn't copied the URL yet —
 * that's the non-obvious behaviour the tests exercise.
 *
 * Children (`ResultUrlRow`, `ShareRow`, `RevokeBlock`) are real; the
 * clipboard call inside copy paths is mocked via `navigator.clipboard`.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withClipboard } from "../../helpers/clipboard";

vi.mock("qrcode-generator", () => ({
  default: () => ({
    addData: vi.fn(),
    make: vi.fn(),
    createDataURL: () => "data:image/png;base64,QR",
  }),
}));

import { ResultPanel } from "@/components/home/result-panel";

afterEach(() => cleanup());

const baseProps = {
  shortUrl: "https://voidhop.test/abc",
  expiry: "2026-05-18 00:00:00 UTC",
  passwordProtected: false,
  onReset: () => undefined,
};

describe("ResultPanel", () => {
  it("renders title, short URL, expiry, and reset button", () => {
    render(<ResultPanel {...baseProps} onReset={vi.fn()} />);
    expect(screen.getByText(/Here's your link\./)).toBeInTheDocument();
    expect(screen.getByText("https://voidhop.test/abc")).toBeInTheDocument();
    expect(screen.getByText("2026-05-18 00:00:00 UTC")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Shorten another link/i }),
    ).toBeEnabled();
  });

  it("shows the 'password required' meta line when passwordProtected", () => {
    render(<ResultPanel {...baseProps} passwordProtected onReset={vi.fn()} />);
    expect(screen.getByText("password required")).toBeInTheDocument();
  });

  it("omits the lock meta line when not protected", () => {
    render(<ResultPanel {...baseProps} onReset={vi.fn()} />);
    expect(screen.queryByText("password required")).not.toBeInTheDocument();
  });

  it("renders the singular self-destruct copy when usesLeft is 1", () => {
    render(<ResultPanel {...baseProps} usesLeft={1} onReset={vi.fn()} />);
    expect(
      screen.getByText("self-destruct after first use"),
    ).toBeInTheDocument();
  });

  it("renders the plural usages-remain copy when usesLeft > 1", () => {
    render(<ResultPanel {...baseProps} usesLeft={5} onReset={vi.fn()} />);
    expect(screen.getByText("5 usages remain")).toBeInTheDocument();
  });

  it("renders the revoke block only when a deleteUrl is supplied", () => {
    const { rerender } = render(
      <ResultPanel {...baseProps} onReset={vi.fn()} />,
    );
    expect(
      screen.queryByText("https://voidhop.test/delete/abc#tok"),
    ).not.toBeInTheDocument();

    rerender(
      <ResultPanel
        {...baseProps}
        onReset={vi.fn()}
        deleteUrl="https://voidhop.test/delete/abc#tok"
      />,
    );
    expect(
      screen.getByText("https://voidhop.test/delete/abc#tok"),
    ).toBeInTheDocument();
  });

  it("does NOT reset on the first click — it shakes and warns instead", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ResultPanel {...baseProps} onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: /Shorten another/i }));
    expect(onReset).not.toHaveBeenCalled();
  });

  it("the SECOND click resets even if the URL was never copied (warn already shown)", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ResultPanel {...baseProps} onReset={onReset} />);
    const reset = screen.getByRole("button", { name: /Shorten another/i });
    await user.click(reset);
    await user.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("after copying the short URL, reset goes through immediately", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    withClipboard(true);
    render(<ResultPanel {...baseProps} onReset={onReset} />);
    // Click the short-url Copy button first.
    await user.click(screen.getByRole("button", { name: /^Copy short link$/i }));
    // First click on reset now goes through.
    await user.click(screen.getByRole("button", { name: /Shorten another/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("clicking the revoke block's copy button writes the delete URL to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = withClipboard(true);
    render(
      <ResultPanel
        {...baseProps}
        onReset={vi.fn()}
        deleteUrl="https://voidhop.test/delete/abc#tok"
      />,
    );
    // Two copy buttons render with distinct accessible names so screen
    // readers can disambiguate them. The revoke block's button targets
    // the delete URL.
    await user.click(
      screen.getByRole("button", { name: /^Copy delete link$/i }),
    );
    expect(writeText).toHaveBeenCalledWith(
      "https://voidhop.test/delete/abc#tok",
    );
  });
});
