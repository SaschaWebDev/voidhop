import type { ReactNode } from "react";
import styles from "@/routes/index.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Styled checkbox with a custom box visual but a real underlying <input
 * type="checkbox"> wrapped in a <label>, so click-on-label and keyboard
 * focus work for free.
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: CheckboxProps) {
  return (
    <label
      className={`${styles.check}${disabled ? ` ${styles.disabled}` : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className={styles.checkBox}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M1.5 5 L4 7.5 L8.5 2.5"
              stroke="#0a0418"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{children}</span>
    </label>
  );
}
