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
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();
  });

  it("renders the doodle nudge until the user has copied once", () => {
    render(<ResultUrlRow {...baseProps} hasCopiedOnce={false} />);
    expect(screen.getByText("copy this")).toBeInTheDocument();
  });

  it("hides the doodle nudge after the first copy", () => {
    render(<ResultUrlRow {...baseProps} hasCopiedOnce={true} />);
    expect(screen.queryByText("copy this")).not.toBeInTheDocument();
  });

  it("flips the button label to 'Copied ✓' when the copied prop is true", () => {
    render(<ResultUrlRow {...baseProps} copied={true} />);
    expect(
      screen.getByRole("button", { name: /Copied ✓/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  });

  it("invokes onCopy when the Copy button is clicked", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(<ResultUrlRow {...baseProps} onCopy={onCopy} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
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
