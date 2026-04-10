/**
 * AboutPage — privacy explanation in plain language. SRS §8.4 (FR-ABOUT-*).
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <article className="card about">
      <h1 className="card-title">How VoidHop protects your privacy</h1>

      <p>
        VoidHop is a zero-knowledge URL shortener. The destination URL never
        reaches our server in any form a human (or a court order) could read.
      </p>

      <h2>What happens when you create a short link</h2>
      <ol>
        <li>You paste a URL into the box on the home page.</li>
        <li>
          Your browser generates a random AES-256 encryption key — locally,
          using <code>crypto.getRandomValues</code>.
        </li>
        <li>
          Your browser encrypts the URL with that key, then sends only the
          encrypted bytes to our server.
        </li>
        <li>
          Our server stores the encrypted bytes and returns a short ID. Your
          browser builds the final short URL by appending the key after a{" "}
          <code>#</code>. The browser never sends anything after a{" "}
          <code>#</code> to a server — that's a hard rule of HTTP, not a
          policy we enforce.
        </li>
      </ol>

      <h2>What happens when someone opens your short link</h2>
      <ol>
        <li>
          Their browser loads our small JavaScript app and reads the key from
          the URL fragment.
        </li>
        <li>
          The app immediately scrubs the key from the address bar so other
          code on the page cannot see it.
        </li>
        <li>
          The app fetches the encrypted bytes from our server, decrypts them
          locally, validates that the destination is a normal{" "}
          <code>http</code> or <code>https</code> URL, and redirects.
        </li>
      </ol>

      <h2>What we do not know</h2>
      <ul>
        <li>The destination URL — at any point.</li>
        <li>The decryption key — at any point.</li>
        <li>How many times a link has been opened.</li>
        <li>Who opened it, or from where.</li>
      </ul>

      <h2>Honest limitations</h2>
      <p>
        VoidHop cannot protect you in every situation. Specifically:
      </p>
      <ul>
        <li>
          <strong>Browser extensions</strong> with permission to read your
          tab's URL can also read the decryption key, because the key lives
          inside the URL. Grammar checkers, password managers, SEO tools, and
          analytics extensions are common offenders. For high-sensitivity
          links, open VoidHop in a private/incognito window or in a clean
          browser profile with no extensions installed.
        </li>
        <li>
          <strong>Compromised devices.</strong> If the sender's or
          recipient's device is compromised at the OS or browser level, the
          plaintext URL is readable before encryption or after decryption.
        </li>
        <li>
          <strong>Insecure channels.</strong> If you share a VoidHop link over
          a channel that itself can be intercepted, the contents of the link
          can be read by whoever intercepts it.
        </li>
        <li>
          <strong>In-app browsers</strong> (Instagram, TikTok, Facebook
          Messenger, etc.) sometimes strip the part of the URL after{" "}
          <code>#</code>. If a recipient sees an "incomplete link" error,
          they should open the link in their system browser instead.
        </li>
        <li>
          <strong>Destination filtering.</strong> VoidHop does not block any
          particular destinations. It validates that the URL is{" "}
          <code>http</code> or <code>https</code> and otherwise trusts the
          recipient's browser to handle the navigation safely. This is
          deliberate: blocking private or local addresses would break
          legitimate sharing of intranet, home-lab, and development URLs.
        </li>
      </ul>

      <h2>Open source</h2>
      <p>
        VoidHop is open source and self-hostable. You can audit the
        cryptography, the threat model, and the deployment. Run your own
        instance with one <code>wrangler deploy</code>.
      </p>
    </article>
  );
}
