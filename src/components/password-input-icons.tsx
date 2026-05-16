/**
 * Inline SVG icons for the password-input button cluster (copy, toggle
 * visibility, generate). All icons use `stroke="currentColor"` so they
 * inherit the surrounding button color — works for both the Void Portal
 * palette on the home page and the standard light/dark theme on the
 * unlock screen.
 */

export function PasswordCopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 7.5L5.5 10L11 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="4.5"
        y="4.5"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function PasswordEyeIcon({ shown }: { shown: boolean }) {
  if (shown) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 2l10 10M5.6 5.7a1.8 1.8 0 002.7 2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 4.3C2.7 5.2 1.5 7 1.5 7s2.2 3.5 5.5 3.5c1 0 1.9-.3 2.7-.8M9.5 9.2c1.5-1 2.9-2.7 3-2.7s-2.2-3.5-5.5-3.5c-.6 0-1.2.1-1.7.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PasswordRefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2.5 7a4.5 4.5 0 018.3-2.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M11.5 7a4.5 4.5 0 01-8.3 2.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M10.2 2.2l.6 2.4-2.4-.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 11.8l-.6-2.4 2.4.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function generatePassword(): string {
  const charset =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*_";
  const lenByte = new Uint8Array(1);
  crypto.getRandomValues(lenByte);
  const len = 16 + ((lenByte[0] ?? 0) % 9);
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}
