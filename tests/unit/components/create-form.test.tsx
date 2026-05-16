/**
 * `CreateForm` is presentation + event wiring. All state lives in the
 * `form` prop (a `useShortenForm` return shape); the component just
 * renders fields, fires the prop callbacks, and gates the submit button.
 *
 * We pass a hand-crafted stub for `form` so each test can vary one
 * dimension (URL filled / TTL choice / password reveal / busy state /
 * error message) and assert the corresponding render.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/utils/generate-password", () => ({
  generatePassword: () => "GeneratedPW",
}));

import { CreateForm } from "@/components/home/create-form";
import type { useShortenForm } from "@/hooks/use-shorten-form";

type FormShape = ReturnType<typeof useShortenForm>;

function makeForm(overrides: Partial<FormShape> = {}): FormShape {
  const base: FormShape = {
    url: "",
    onUrlChange: vi.fn(),
    ttl: 604800,
    setTtl: vi.fn(),
    inputError: null,
    protect: false,
    setProtect: vi.fn(),
    password: "",
    setPassword: vi.fn(),
    passwordError: null,
    usesLeft: undefined,
    setUsesLeft: vi.fn(),
    isBusy: false,
    state: "idle",
    result: null,
    errorMessage: null,
    submit: vi.fn(),
    reset: vi.fn(),
  };
  return { ...base, ...overrides };
}

afterEach(() => cleanup());

describe("CreateForm", () => {
  it("renders fields and a disabled submit when URL is empty", () => {
    render(<CreateForm form={makeForm()} />);
    expect(screen.getByLabelText("destination")).toBeInTheDocument();
    expect(screen.getByText("expires in")).toBeInTheDocument();
    expect(screen.getByLabelText("usage limit")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Short Link/i }),
    ).toBeDisabled();
  });

  it("enables submit once URL has non-whitespace content", () => {
    render(<CreateForm form={makeForm({ url: "https://x" })} />);
    expect(
      screen.getByRole("button", { name: /Create Short Link/i }),
    ).toBeEnabled();
  });

  it("typing in the destination field calls onUrlChange", async () => {
    const user = userEvent.setup();
    const onUrlChange = vi.fn();
    render(<CreateForm form={makeForm({ onUrlChange })} />);
    await user.type(screen.getByLabelText("destination"), "ab");
    expect(onUrlChange).toHaveBeenCalledWith("a");
    expect(onUrlChange).toHaveBeenCalledWith("b");
  });

  it("clicking a TTL option calls setTtl with that value", async () => {
    const user = userEvent.setup();
    const setTtl = vi.fn();
    render(<CreateForm form={makeForm({ setTtl })} />);
    await user.click(screen.getByRole("radio", { name: /1 hour/i }));
    expect(setTtl).toHaveBeenCalledWith(3600);
  });

  it("marks the active TTL with aria-checked=true", () => {
    render(<CreateForm form={makeForm({ ttl: 86400 })} />);
    const opt = screen.getByRole("radio", { name: /24 hours/i });
    expect(opt).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: /1 hour/i }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("shows the inline URL error when one is set on the form", () => {
    render(<CreateForm form={makeForm({ inputError: "Bad URL" })} />);
    expect(screen.getByText("Bad URL")).toBeInTheDocument();
  });

  it("does NOT render the password field unless protect is true", () => {
    const { rerender } = render(<CreateForm form={makeForm()} />);
    expect(screen.queryByPlaceholderText("password")).not.toBeInTheDocument();
    rerender(<CreateForm form={makeForm({ protect: true })} />);
    expect(screen.getByPlaceholderText("password")).toBeInTheDocument();
  });

  it("shows the inline password error when one is set", () => {
    render(
      <CreateForm
        form={makeForm({ protect: true, passwordError: "Empty password" })}
      />,
    );
    expect(screen.getByText("Empty password")).toBeInTheDocument();
  });

  it("toggling 'Redirect requires password' fires setProtect", async () => {
    const user = userEvent.setup();
    const setProtect = vi.fn();
    render(<CreateForm form={makeForm({ setProtect })} />);
    await user.click(
      screen.getByRole("checkbox", { name: /Redirect requires password/i }),
    );
    expect(setProtect).toHaveBeenCalledWith(true);
  });

  it("submit button label tracks the state machine", () => {
    const { rerender } = render(
      <CreateForm form={makeForm({ url: "x", state: "encrypting", isBusy: true })} />,
    );
    expect(
      screen.getByRole("button", { name: /Encrypting locally…/ }),
    ).toBeDisabled();
    rerender(
      <CreateForm form={makeForm({ url: "x", state: "uploading", isBusy: true })} />,
    );
    expect(screen.getByRole("button", { name: /Hopping…/ })).toBeDisabled();
  });

  it("submitting the form calls form.submit and not a native nav", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<CreateForm form={makeForm({ url: "https://x", submit })} />);
    await user.click(
      screen.getByRole("button", { name: /Create Short Link/i }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("renders the bottom error message when one is set", () => {
    render(<CreateForm form={makeForm({ errorMessage: "Network down." })} />);
    expect(screen.getByText("Network down.")).toBeInTheDocument();
  });

  it("disables all interactive controls while busy", () => {
    render(
      <CreateForm
        form={makeForm({ url: "https://x", isBusy: true, state: "uploading" })}
      />,
    );
    expect(screen.getByLabelText("destination")).toBeDisabled();
    expect(screen.getByLabelText("usage limit")).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Redirect requires password/i }),
    ).toBeDisabled();
    for (const r of screen.getAllByRole("radio")) {
      expect(r).toBeDisabled();
    }
  });
});
