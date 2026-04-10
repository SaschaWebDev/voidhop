import { describe, expect, it } from "vitest";
import { isInAppBrowser } from "@/utils/ua-detection";

describe("isInAppBrowser", () => {
  it("matches representative in-app browser UAs", () => {
    const inApp = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 250.0.0.21.109",
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/115.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/418.0.0.0]",
      "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/108.0.0.0 Mobile Safari/537.36 musical_ly_28.0.0",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.30",
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Line/12.13.0",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Twitter for iPhone",
      "Mozilla/5.0 (Linux; Android 13) LinkedInApp",
    ];
    for (const ua of inApp) {
      expect(isInAppBrowser(ua), ua).toBe(true);
    }
  });

  it("does not match generic Chrome / Firefox / Safari UAs", () => {
    const desktop = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0",
    ];
    for (const ua of desktop) {
      expect(isInAppBrowser(ua), ua).toBe(false);
    }
  });

  it("returns false on empty input", () => {
    expect(isInAppBrowser("")).toBe(false);
  });
});
