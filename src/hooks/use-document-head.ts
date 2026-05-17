import { useEffect } from "react";

export interface DocumentHead {
  readonly title: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly robots?: string;
}

type TagSpec =
  | { kind: "meta-name"; key: string }
  | { kind: "meta-property"; key: string }
  | { kind: "link"; rel: string };

function findOrCreate(spec: TagSpec): HTMLElement {
  let el: HTMLElement | null;
  if (spec.kind === "link") {
    el = document.head.querySelector(`link[rel="${spec.rel}"]`);
    if (!el) {
      el = document.createElement("link");
      (el as HTMLLinkElement).rel = spec.rel;
      document.head.appendChild(el);
    }
  } else {
    const attr = spec.kind === "meta-name" ? "name" : "property";
    el = document.head.querySelector(`meta[${attr}="${spec.key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, spec.key);
      document.head.appendChild(el);
    }
  }
  return el;
}

function readValue(spec: TagSpec): string | null {
  if (spec.kind === "link") {
    const el = document.head.querySelector<HTMLLinkElement>(
      `link[rel="${spec.rel}"]`,
    );
    return el ? el.href : null;
  }
  const attr = spec.kind === "meta-name" ? "name" : "property";
  const el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${spec.key}"]`,
  );
  return el ? el.content : null;
}

function writeValue(spec: TagSpec, value: string): void {
  const el = findOrCreate(spec);
  if (spec.kind === "link") {
    (el as HTMLLinkElement).href = value;
  } else {
    (el as HTMLMetaElement).content = value;
  }
}

/**
 * Per-route head sync. Sets title, description, canonical, robots, and the
 * matching OG/Twitter tags; restores prior values on unmount so navigating
 * away does not leave stale metadata behind.
 */
export function useDocumentHead({
  title,
  description,
  canonical,
  robots,
}: DocumentHead): void {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDescription = readValue({ kind: "meta-name", key: "description" });
    const prevOgTitle = readValue({ kind: "meta-property", key: "og:title" });
    const prevOgDescription = readValue({
      kind: "meta-property",
      key: "og:description",
    });
    const prevOgUrl = readValue({ kind: "meta-property", key: "og:url" });
    const prevTwitterTitle = readValue({
      kind: "meta-name",
      key: "twitter:title",
    });
    const prevTwitterDescription = readValue({
      kind: "meta-name",
      key: "twitter:description",
    });
    const prevCanonical = readValue({ kind: "link", rel: "canonical" });
    const prevRobots = readValue({ kind: "meta-name", key: "robots" });

    document.title = title;
    writeValue({ kind: "meta-property", key: "og:title" }, title);
    writeValue({ kind: "meta-name", key: "twitter:title" }, title);

    if (description !== undefined) {
      writeValue({ kind: "meta-name", key: "description" }, description);
      writeValue(
        { kind: "meta-property", key: "og:description" },
        description,
      );
      writeValue(
        { kind: "meta-name", key: "twitter:description" },
        description,
      );
    }

    if (canonical !== undefined) {
      writeValue({ kind: "link", rel: "canonical" }, canonical);
      writeValue({ kind: "meta-property", key: "og:url" }, canonical);
    }

    if (robots !== undefined) {
      writeValue({ kind: "meta-name", key: "robots" }, robots);
    }

    return () => {
      document.title = prevTitle;
      if (prevDescription !== null) {
        writeValue({ kind: "meta-name", key: "description" }, prevDescription);
      }
      if (prevOgTitle !== null) {
        writeValue({ kind: "meta-property", key: "og:title" }, prevOgTitle);
      }
      if (prevOgDescription !== null) {
        writeValue(
          { kind: "meta-property", key: "og:description" },
          prevOgDescription,
        );
      }
      if (prevOgUrl !== null) {
        writeValue({ kind: "meta-property", key: "og:url" }, prevOgUrl);
      }
      if (prevTwitterTitle !== null) {
        writeValue(
          { kind: "meta-name", key: "twitter:title" },
          prevTwitterTitle,
        );
      }
      if (prevTwitterDescription !== null) {
        writeValue(
          { kind: "meta-name", key: "twitter:description" },
          prevTwitterDescription,
        );
      }
      if (prevCanonical !== null) {
        writeValue({ kind: "link", rel: "canonical" }, prevCanonical);
      }
      // Robots is the only field that may not exist in the static index.html
      // (we deliberately removed the global noindex). If a route set robots
      // and a previous route had none, remove the tag on cleanup.
      if (prevRobots !== null) {
        writeValue({ kind: "meta-name", key: "robots" }, prevRobots);
      } else if (robots !== undefined) {
        document.head
          .querySelector('meta[name="robots"]')
          ?.remove();
      }
    };
  }, [title, description, canonical, robots]);
}
