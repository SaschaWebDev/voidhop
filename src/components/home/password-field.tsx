import {
  PasswordCopyIcon,
  PasswordEyeIcon,
  PasswordRefreshIcon,
} from "@/components/icons";
import { usePasswordCopy } from "@/hooks/use-password-copy";
import { generatePassword } from "@/utils/generate-password";
import styles from "@/routes/index.module.css";

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
  const { showPassword, copied, toggleShow, reveal, onCopy } = usePasswordCopy();

  const onGenerate = () => {
    onChange(generatePassword());
    reveal();
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
          onClick={() => onCopy(value)}
          title={copied ? "copied" : "copy password"}
          tabIndex={-1}
          disabled={disabled || value.length === 0}
        >
          <PasswordCopyIcon copied={copied} />
        </button>
        <button
          type="button"
          className={styles.pwdBtn}
          onClick={toggleShow}
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
