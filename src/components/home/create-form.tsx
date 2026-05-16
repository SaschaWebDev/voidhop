import type { useShortenForm } from "@/hooks/use-shorten-form";
import { VoidField } from "@/components/void-field";
import { VoidCheckbox } from "@/components/void-checkbox";
import { PasswordField } from "@/components/home/password-field";
import { TTL_OPTIONS, USES_LEFT_OPTIONS } from "@/constants";

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
      <div className="vp-card-title">Shorten a link</div>
      <div className="vp-card-sub">Your URL is only known to you</div>

      <VoidField label="destination" htmlFor="vp-destination">
        <input
          id="vp-destination"
          type="text"
          inputMode="url"
          className={`vp-input${f.url ? " on" : ""}`}
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
          <div className="vp-err-inline">{f.inputError}</div>
        )}
      </VoidField>

      <VoidField label="expires in" labelId="vp-ttl-label">
        <div
          className="vp-ttl"
          role="radiogroup"
          aria-labelledby="vp-ttl-label"
        >
          {TTL_OPTIONS.map((o) => {
            const checked = f.ttl === o.seconds;
            return (
              <button
                key={o.seconds}
                type="button"
                role="radio"
                aria-checked={checked}
                className={`vp-ttl-btn${checked ? " on" : ""}`}
                onClick={() => f.setTtl(o.seconds)}
                disabled={hopping}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </VoidField>

      <VoidField label="usage limit" htmlFor="vp-uses-left">
        <select
          id="vp-uses-left"
          className="vp-select"
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
      </VoidField>

      <div className="vp-toggles">
        <VoidCheckbox
          checked={f.protect}
          onChange={f.setProtect}
          disabled={hopping}
        >
          Redirect requires password
        </VoidCheckbox>
      </div>

      {f.protect && (
        <PasswordField
          value={f.password}
          onChange={f.setPassword}
          disabled={hopping}
        />
      )}
      {f.passwordError && (
        <div className="vp-err-inline">{f.passwordError}</div>
      )}

      <button
        type="submit"
        className="vp-submit"
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
        <div className="vp-err-block">{f.errorMessage}</div>
      )}
    </form>
  );
}
