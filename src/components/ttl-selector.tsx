/**
 * TtlSelector — TTL option grid. SRS FR-CREATE-03.
 *
 * As of v1.1.1 the TTL is universally capped at 7 days regardless of blob
 * size, so there is no per-tier disabling logic. Three options:
 * 1 hour / 24 hours / 7 days (default).
 */

import { TTL_OPTIONS } from "@/constants";

export interface TtlSelectorProps {
  value: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
}

export function TtlSelector({ value, onChange, disabled }: TtlSelectorProps) {
  return (
    <div className="ttl-grid" role="radiogroup" aria-label="Link expiry">
      {TTL_OPTIONS.map((opt) => {
        const isSelected = opt.seconds === value;
        return (
          <button
            key={opt.seconds}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`ttl-option ${isSelected ? "selected" : ""}`}
            disabled={disabled}
            onClick={() => onChange(opt.seconds)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
