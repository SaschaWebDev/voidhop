/**
 * Inline SVG icons for the UI. All icons use `stroke`/`fill="currentColor"`
 * so they inherit the surrounding text color — works across the cosmic
 * Void Portal palette and the standard light/dark theme.
 *
 * Two clusters:
 *   - Password input cluster: PasswordCopyIcon, PasswordEyeIcon,
 *     PasswordRefreshIcon (used by both the home create form and the
 *     unlock-screen prompt).
 *   - Result-panel cluster: IconWhatsApp, IconTelegram, IconEmail,
 *     IconShare, IconDoodlyArrow (used by VoidResult on the home page).
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

export function IconWhatsApp() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.099-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconTelegram() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.3 1.7L1.4 6.8c-.5.2-.5.6 0 .7l3.3 1 1.3 4c.1.4.2.5.5.5s.3-.1.4-.2l1.8-1.8 3.3 2.4c.4.2.7.1.8-.4L14.9 2.5c.1-.6-.2-.9-.6-.8zM5.3 8.2l6.3-3.9-4.8 4.4-.2 2.1-1.3-2.6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconEmail() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="3.5"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2.5 4L8 8.5 13.5 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconShare() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 10V12a1 1 0 001 1h6a1 1 0 001-1V10M8 2v7.5M5.5 4.5L8 2l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDoodlyArrow() {
  return (
    <svg
      width="48"
      height="31"
      viewBox="0 0 60 39"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6 C10 3, 22 2, 32 8 C38 12, 44 20, 50 30"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M49 23 L50 30 L44 26"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
