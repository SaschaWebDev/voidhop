/**
 * In-app browser User-Agent detection. SRS FR-REDIRECT-02 / item 16.
 *
 * Used by the redirect page to provide a targeted error message when known
 * in-app browsers strip the URL fragment. Substring match (no regex) for
 * obvious auditability.
 */

import { IN_APP_BROWSER_UA_PATTERNS } from "@/constants";

export function isInAppBrowser(userAgent: string): boolean {
  if (userAgent.length === 0) return false;
  for (const pattern of IN_APP_BROWSER_UA_PATTERNS) {
    if (userAgent.includes(pattern)) return true;
  }
  return false;
}
