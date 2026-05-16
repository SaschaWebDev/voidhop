import { useState } from "react";
import {
  PasswordCopyIcon,
  PasswordEyeIcon,
  PasswordRefreshIcon,
} from "@/components/icons";
import { copyToClipboard } from "@/hooks/use-shorten-form";
import { generatePassword } from "@/utils/generate-password";
import styles from "@/routes/index.module.css";

const COPY_FEEDBACK_MS = 1500;

interface PasswordFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

/**
 * Inline password input with three right-side buttons: copy, toggle
 * visibility, generate. Owns the show/hide and copy-feedback state — they
 * don't need to leak up into the form.
 *
 * Copying also hides the password (matches notefade's behaviour for
 * shoulder-surf safety). Generate fills the field and reveals it so the
 * user can verify before submitting.
 */
export function PasswordField({
  value,
  onChange,
  disabled,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (copied || value.length === 0) return;
    if (await copyToClipboard(value)) {
      setShowPassword(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
  };

  const onToggle = () => setShowPassword((v) => !v);

  const onGenerate = () => {
    onChange(generatePassword());
    setShowPassword(true);
  };

  return (
    <div className={styles.pwd}>
      <div className={styles.pwdWrap}>
        <input
          type={showPassword ? "text" : "password"}
          className={styles.pwdInput}
          placeholder="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="new-password"
        />
        <button
          type="button"
          className={`${styles.pwdBtn}${copied ? ` ${styles.pwdBtnCopied}` : ""}`}
          onClick={onCopy}
          title={copied ? "copied" : "copy password"}
          tabIndex={-1}
          disabled={disabled || value.length === 0}
        >
          <PasswordCopyIcon copied={copied} />
        </button>
        <button
          type="button"
          className={styles.pwdBtn}
          onClick={onToggle}
          title={showPassword ? "hide password" : "show password"}
          tabIndex={-1}
          disabled={disabled || value.length === 0}
        >
          <PasswordEyeIcon shown={showPassword} />
        </button>
        <button
          type="button"
          className={styles.pwdBtn}
          onClick={onGenerate}
          title="generate random password"
          tabIndex={-1}
          disabled={disabled}
        >
          <PasswordRefreshIcon />
        </button>
      </div>
    </div>
  );
}
