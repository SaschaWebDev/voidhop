/**
 * `ResultUrlRow` renders the purple URL row, a Copy button, an optional
 * doodle nudge, and a QR code generated from the short URL. The QR
 * library is mocked so the test only checks that the data URL flows
 * through to the <img src> — the actual matrix accuracy is the
 * library's concern.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("qrcode-generator", () => ({
  default: () => ({
    addData: vi.fn(),
    make: vi.fn(),
    createDataURL: () => "data:image/png;base64,FAKE_QR",
  }),
}));

import { ResultUrlRow } from "@/components/home/result-url-row";
import styles from "@/routes/index.module.css";

afterEach(() => cleanup());

const baseProps = {
  shortUrl: "https://voidhop.test/abc",
  copied: false,
  hasCopiedOnce: false,
  shaking: false,
  onCopy: () => undefined,
};

describe("ResultUrlRow", () => {
  it("renders the short URL and an enabled Copy button", () => {
    render(<ResultUrlRow {...baseProps} />);
    expect(screen.getByText("https://voidhop.test/abc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Copy short link$/i })).toBeEnabled();
  });

  it("renders the doodle nudge until the user has copied once", () => {
    render(<ResultUrlRow {...baseProps} hasCopiedOnce={false} />);
    expect(screen.getByText("copy this")).toBeInTheDocument();
  });

  it("hides the doodle nudge after the first copy", () => {
    render(<ResultUrlRow {...baseProps} hasCopiedOnce={true} />);
    expect(screen.queryByText("copy this")).not.toBeInTheDocument();
  });

  it("keeps the 'Copy' label and adds the visual-feedback class when copied=true", () => {
    // The button's text and accessible name must stay "Copy" — feedback is
    // delivered via animation, not via the label. The .copied modifier class
    // is what drives the CSS @keyframes that signals success.
    render(<ResultUrlRow {...baseProps} copied={true} />);
    const button = screen.getByRole("button", { name: /^Copy short link$/i });
    expect(button).toBeInTheDocument();
    expect(button.classList.contains(styles.copied as string)).toBe(true);
    expect(
      screen.queryByRole("button", { name: /Copied ✓/i }),
    ).not.toBeInTheDocument();
  });

  it("omits the visual-feedback class when copied=false", () => {
    render(<ResultUrlRow {...baseProps} copied={false} />);
    const button = screen.getByRole("button", { name: /^Copy short link$/i });
    expect(button.classList.contains(styles.copied as string)).toBe(false);
  });

  it("renders the visible label 'Copy' regardless of copied state", () => {
    const { rerender } = render(<ResultUrlRow {...baseProps} copied={false} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
    rerender(<ResultUrlRow {...baseProps} copied={true} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("invokes onCopy when the Copy button is clicked", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(<ResultUrlRow {...baseProps} onCopy={onCopy} />);
    await user.click(screen.getByRole("button", { name: /^Copy short link$/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("renders the generated QR <img> with the mocked data URL", async () => {
    const { container } = render(<ResultUrlRow {...baseProps} />);
    // The QR <img> has alt="" (decorative), so query the DOM directly.
    const img = container.querySelector(
      'img[src^="data:image/png;base64,"]',
    );
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "data:image/png;base64,FAKE_QR");
  });
});
