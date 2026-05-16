/**
 * `PasswordField` is a stateful inline input with three side buttons (copy,
 * show/hide, generate). All three buttons mutate local state — clipboard
 * for copy, eye toggle for show/hide, generated value + reveal for
 * generate. The disabled gating depends on both the `disabled` prop and
 * whether the input is non-empty.
 *
 * Clipboard and the password generator are mocked so we get deterministic
 * behaviour without depending on real entropy.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/utils/generate-password", () => ({
  generatePassword: () => "GeneratedPW123",
}));

import { PasswordField } from "@/components/home/password-field";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function withClipboard(writeText: (s: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("PasswordField", () => {
  it("renders the value as a password input by default", () => {
    render(<PasswordField value="secret" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("password") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
    expect(input.value).toBe("secret");
  });

  it("clicking show/hide toggles the input type", async () => {
    const user = userEvent.setup();
    render(<PasswordField value="secret" onChange={vi.fn()} />);
    const toggle = screen.getByTitle("show password");
    await user.click(toggle);
    const input = screen.getByPlaceholderText("password");
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByTitle("hide password")).toBeInTheDocument();
  });

  it("the show/hide and copy buttons are disabled when the value is empty", () => {
    render(<PasswordField value="" onChange={vi.fn()} />);
    expect(screen.getByTitle("copy password")).toBeDisabled();
    expect(screen.getByTitle("show password")).toBeDisabled();
    // Generate is enabled even when empty — it's how you bootstrap a value.
    expect(screen.getByTitle("generate random password")).toBeEnabled();
  });

  it("all buttons + input are disabled when the disabled prop is set", () => {
    render(<PasswordField value="secret" onChange={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText("password")).toBeDisabled();
    expect(screen.getByTitle("copy password")).toBeDisabled();
    expect(screen.getByTitle("show password")).toBeDisabled();
    expect(screen.getByTitle("generate random password")).toBeDisabled();
  });

  it("typing in the input fires onChange with the new value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordField value="" onChange={onChange} />);
    await user.type(screen.getByPlaceholderText("password"), "ab");
    expect(onChange).toHaveBeenCalledWith("a");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("clicking generate calls onChange with a generated password and reveals it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordField value="" onChange={onChange} />);
    await user.click(screen.getByTitle("generate random password"));
    expect(onChange).toHaveBeenCalledWith("GeneratedPW123");
    // After generate, show is now active → the toggle button reads "hide".
    // Note the value is still "" because state is parent-owned; but the
    // local showPassword flag is true, so the input has type="text".
    expect(screen.getByPlaceholderText("password")).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("copy writes to clipboard, hides the password, and shows a copied label", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);

    render(<PasswordField value="secret" onChange={vi.fn()} />);
    // Reveal first so we can prove it gets hidden after copy.
    await user.click(screen.getByTitle("show password"));
    expect(screen.getByPlaceholderText("password")).toHaveAttribute(
      "type",
      "text",
    );

    await user.click(screen.getByTitle("copy password"));
    expect(writeText).toHaveBeenCalledWith("secret");
    expect(await screen.findByTitle("copied")).toBeInTheDocument();
    // Input is hidden again post-copy.
    expect(screen.getByPlaceholderText("password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("copy is a no-op while feedback is showing", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);

    render(<PasswordField value="secret" onChange={vi.fn()} />);
    await user.click(screen.getByTitle("copy password"));
    expect(writeText).toHaveBeenCalledTimes(1);

    // Second click during the copied-feedback window is suppressed.
    await user.click(screen.getByTitle("copied"));
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
