import type { ReactNode } from "react";
import styles from "@/routes/index.module.css";

interface FieldProps {
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
export function Field({ label, htmlFor, labelId, children }: FieldProps) {
  return (
    <div className={styles.field}>
      {htmlFor ? (
        <label className={styles.fieldLabel} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className={styles.fieldLabel} id={labelId}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
