import type { ReactNode } from "react";

interface VoidFieldProps {
  label: string;
  htmlFor?: string;
  labelId?: string;
  children: ReactNode;
}

/**
 * Form-field wrapper that renders a small uppercase label above its child
 * control.
 *
 * - When `htmlFor` is provided the label is a real `<label htmlFor>`,
 *   associating it with a single input/select for screen-reader users.
 * - When `labelId` is provided instead, the label gets that `id`. The
 *   child container (e.g. a TTL button group) can then reference it via
 *   `aria-labelledby` to name a non-input group.
 *
 * Pass exactly one of the two, or neither for a purely visual label.
 */
export function VoidField({
  label,
  htmlFor,
  labelId,
  children,
}: VoidFieldProps) {
  return (
    <div className="vp-field">
      {htmlFor ? (
        <label className="vp-field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className="vp-field-label" id={labelId}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
