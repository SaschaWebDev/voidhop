import type { useShortenForm } from "@/hooks/use-shorten-form";
import { Field } from "@/components/home/field";
import { Checkbox } from "@/components/home/checkbox";
import { PasswordField } from "@/components/home/password-field";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";
import styles from "@/routes/index.module.css";

interface CreateFormProps {
  form: ReturnType<typeof useShortenForm>;
}

/**
 * The create form on the home page — URL input, TTL radiogroup, uses-left
 * select, password toggle + field, submit button. All form state lives in
 * `useShortenForm` and is passed in via the `form` prop; this component is
 * pure presentation + event wiring.
 */
export function CreateForm({ form: f }: CreateFormProps) {
  const hopping = f.isBusy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        f.submit();
      }}
    >
      <div className={styles.cardTitle}>Shorten a link</div>
      <div className={styles.cardSub}>Your URL is only known to you</div>

      <Field label="destination" htmlFor="home-destination">
        <input
          id="home-destination"
          type="text"
          inputMode="url"
          className={`${styles.input}${f.url ? ` ${styles.on}` : ""}`}
          placeholder="https://yourdestination.com"
          value={f.url}
          onChange={(e) => f.onUrlChange(e.target.value)}
          disabled={hopping}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
          required
        />
        {f.inputError && (
          <div className={styles.errInline}>{f.inputError}</div>
        )}
      </Field>

      <Field label="expires in" labelId="home-ttl-label">
        <div
          className={styles.ttl}
          role="radiogroup"
          aria-labelledby="home-ttl-label"
        >
          {TTL_OPTIONS.map((o) => {
            const checked = f.ttl === o.seconds;
            return (
              <button
                key={o.seconds}
                type="button"
                role="radio"
                aria-checked={checked}
                className={`${styles.ttlBtn}${checked ? ` ${styles.on}` : ""}`}
                onClick={() => f.setTtl(o.seconds)}
                disabled={hopping}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="usage limit" htmlFor="home-uses-left">
        <select
          id="home-uses-left"
          className={styles.select}
          value={f.usesLeft === undefined ? "" : String(f.usesLeft)}
          onChange={(e) =>
            f.setUsesLeft(
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
          disabled={hopping}
        >
          {USES_LEFT_OPTIONS.map((o) => (
            <option
              key={o.value ?? "u"}
              value={o.value === undefined ? "" : String(o.value)}
            >
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className={styles.toggles}>
        <Checkbox
          checked={f.protect}
          onChange={f.setProtect}
          disabled={hopping}
        >
          Redirect requires password
        </Checkbox>
      </div>

      {f.protect && (
        <PasswordField
          value={f.password}
          onChange={f.setPassword}
          disabled={hopping}
        />
      )}
      {f.passwordError && (
        <div className={styles.errInline}>{f.passwordError}</div>
      )}

      <button
        type="submit"
        className={styles.submit}
        data-active={f.url.trim().length > 0 ? "1" : "0"}
        disabled={hopping || f.url.trim().length === 0}
      >
        {f.state === "encrypting"
          ? "Encrypting locally…"
          : f.state === "uploading"
            ? "Hopping…"
            : "Create Short Link"}
      </button>

      {f.errorMessage && (
        <div className={styles.errBlock}>{f.errorMessage}</div>
      )}
    </form>
  );
}
