import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCreateLink } from "@/hooks/use-create-link";
import { validateInputUrl } from "@/utils/url-validation";
import {
  humanizeCreateError,
  humanizeInputError,
} from "@/utils/humanize-errors";
import { copyToClipboard, formatExpiry } from "@/hooks/use-shorten-form";

export const Route = createFileRoute("/9")({
  component: Design9,
});

type Line =
  | { kind: "system"; text: string }
  | { kind: "prompt"; text: string }
  | { kind: "input"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "err"; text: string }
  | { kind: "dim"; text: string };

type Phase =
  | "idle"
  | "ask-url"
  | "ask-ttl"
  | "ask-password"
  | "ask-password-confirm"
  | "ask-uses"
  | "ask-deletion"
  | "running"
  | "done";

function Design9() {
  const create = useCreateLink();
  const [lines, setLines] = useState<Line[]>(initialLines());
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<{
    url?: string;
    ttl?: number;
    password?: string;
    usesLeft?: number;
    includeDeletionToken?: boolean;
  }>({});
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, phase]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase]);

  // React to mutation lifecycle
  useEffect(() => {
    if (create.state === "encrypting") {
      appendLines([
        { kind: "dim", text: "[PBKDF2·600K … AES-256-GCM] encrypting in browser" },
      ]);
    } else if (create.state === "uploading") {
      appendLines([{ kind: "dim", text: "uploading ciphertext to void0 …" }]);
    } else if (create.state === "success" && create.result) {
      const r = create.result;
      const out: Line[] = [
        { kind: "ok", text: "✓ sealed." },
        { kind: "system", text: `  short  ${r.shortUrl}` },
        { kind: "system", text: `  expiry ${formatExpiry(r.expiresAt)}` },
      ];
      if (r.passwordProtected) {
        out.push({ kind: "system", text: "  lock   password required" });
      }
      if (r.usesLeft !== undefined) {
        out.push({
          kind: "system",
          text: `  uses   ${r.usesLeft === 1 ? "1 (self-destruct)" : r.usesLeft}`,
        });
      }
      if (r.deleteUrl) {
        out.push({ kind: "system", text: `  revoke ${r.deleteUrl}` });
      }
      out.push({
        kind: "dim",
        text: "commands: copy, new, quit · type /help anytime",
      });
      appendLines(out);
      setPhase("done");
    } else if (create.state === "error" && create.error) {
      appendLines([{ kind: "err", text: `✗ ${humanizeCreateError(create.error)}` }]);
      setPhase("done");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create.state]);

  const appendLines = (next: Line[]) => setLines((ls) => [...ls, ...next]);

  const handleLine = async (raw: string) => {
    const value = raw.trim();
    if (value.length === 0 && phase !== "ask-password") {
      return;
    }
    setHistory((h) => [...h, raw]);
    setHistoryIdx(null);

    appendLines([
      { kind: "input", text: `${promptFor(phase)} ${maskIfPwd(value, phase)}` },
    ]);

    // meta-commands available in any phase
    if (value === "/help") {
      appendLines(helpLines());
      return;
    }
    if (value === "/clear") {
      setLines(initialLines());
      return;
    }
    if (value === "/quit" || value === "exit") {
      setLines(initialLines());
      setPhase("idle");
      setStaged({});
      create.reset();
      return;
    }

    switch (phase) {
      case "idle": {
        if (value.startsWith("hop ")) {
          const url = value.slice(4).trim();
          const v = validateInputUrl(url);
          if (!v.ok) {
            appendLines([{ kind: "err", text: `✗ ${humanizeInputError(v.error.type)}` }]);
            return;
          }
          setStaged({ url: v.value });
          appendLines([
            {
              kind: "dim",
              text: "ttl? enter one of: 1h · 24h · 7d   (default: 7d)",
            },
          ]);
          setPhase("ask-ttl");
        } else if (value === "hop") {
          appendLines([
            { kind: "dim", text: "paste a url (http:// or https://)" },
          ]);
          setPhase("ask-url");
        } else {
          appendLines([
            {
              kind: "err",
              text: `unknown command — type '/help' or 'hop <url>'`,
            },
          ]);
        }
        break;
      }
      case "ask-url": {
        const v = validateInputUrl(value);
        if (!v.ok) {
          appendLines([{ kind: "err", text: `✗ ${humanizeInputError(v.error.type)}` }]);
          return;
        }
        setStaged((s) => ({ ...s, url: v.value }));
        appendLines([
          {
            kind: "dim",
            text: "ttl? enter one of: 1h · 24h · 7d   (default: 7d)",
          },
        ]);
        setPhase("ask-ttl");
        break;
      }
      case "ask-ttl": {
        const ttl = parseTtl(value);
        if (ttl === null) {
          appendLines([{ kind: "err", text: "expected '1h', '24h', '7d', or empty" }]);
          return;
        }
        setStaged((s) => ({ ...s, ttl }));
        appendLines([{ kind: "dim", text: "password? type one, or blank for none" }]);
        setPhase("ask-password");
        break;
      }
      case "ask-password": {
        if (value.length === 0) {
          // skip
          appendLines([
            { kind: "dim", text: "uses? unlimited · 1 · 3 · 10   (default: unlimited)" },
          ]);
          setPhase("ask-uses");
          return;
        }
        setStaged((s) => ({ ...s, password: value }));
        appendLines([{ kind: "dim", text: "confirm the password:" }]);
        setPhase("ask-password-confirm");
        break;
      }
      case "ask-password-confirm": {
        if (value !== staged.password) {
          appendLines([{ kind: "err", text: "passwords did not match — try again" }]);
          setStaged((s) => {
            const { password: _pw, ...rest } = s;
            void _pw;
            return rest;
          });
          appendLines([{ kind: "dim", text: "password? type one, or blank for none" }]);
          setPhase("ask-password");
          return;
        }
        appendLines([
          { kind: "dim", text: "uses? unlimited · 1 · 3 · 10   (default: unlimited)" },
        ]);
        setPhase("ask-uses");
        break;
      }
      case "ask-uses": {
        const uses = parseUses(value);
        if (uses === "invalid") {
          appendLines([{ kind: "err", text: "expected 'unlimited', '1', '3', '10'" }]);
          return;
        }
        setStaged((s) => {
          if (uses === "unlimited") {
            const { usesLeft: _u, ...rest } = s;
            void _u;
            return rest;
          }
          return { ...s, usesLeft: uses };
        });
        appendLines([
          {
            kind: "dim",
            text: "revocation key? y/N   (lets you destroy the link early)",
          },
        ]);
        setPhase("ask-deletion");
        break;
      }
      case "ask-deletion": {
        const yes = /^y(es)?$/i.test(value);
        setStaged((s) => ({ ...s, includeDeletionToken: yes }));
        await commit({ ...staged, includeDeletionToken: yes });
        break;
      }
      case "done": {
        if (value === "copy") {
          if (create.result) {
            const ok = await copyToClipboard(create.result.shortUrl);
            appendLines([
              ok
                ? { kind: "ok", text: "✓ copied to clipboard" }
                : { kind: "err", text: "clipboard unavailable" },
            ]);
          }
        } else if (value === "new") {
          setLines(initialLines());
          setPhase("idle");
          setStaged({});
          create.reset();
        } else {
          appendLines([{ kind: "err", text: "unknown — 'copy' · 'new' · '/quit'" }]);
        }
        break;
      }
      case "running":
        appendLines([{ kind: "err", text: "busy — wait for the current job" }]);
        break;
    }
  };

  const commit = async (s: {
    url?: string;
    ttl?: number;
    password?: string;
    usesLeft?: number;
    includeDeletionToken?: boolean;
  }) => {
    if (!s.url) {
      appendLines([{ kind: "err", text: "no url staged — start over with 'hop <url>'" }]);
      setPhase("idle");
      return;
    }
    setPhase("running");
    await create.mutate(s.url, s.ttl ?? 604800, {
      ...(s.password ? { password: s.password } : {}),
      ...(s.usesLeft !== undefined ? { usesLeft: s.usesLeft } : {}),
      ...(s.includeDeletionToken ? { includeDeletionToken: true } : {}),
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLine(input);
      setInput("");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = historyIdx === null ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(next);
      setInput(history[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === null) return;
      const next = historyIdx + 1;
      if (next >= history.length) {
        setHistoryIdx(null);
        setInput("");
      } else {
        setHistoryIdx(next);
        setInput(history[next] ?? "");
      }
    }
  };

  return (
    <>
      <FontLoader />
      <div className="d9-root" onClick={() => inputRef.current?.focus()}>
        <div className="d9-scanlines" aria-hidden="true" />
        <div className="d9-frame">
          <div className="d9-bar">
            <span className="d9-bar-dots">
              <span className="d9-bar-dot" />
              <span className="d9-bar-dot" />
              <span className="d9-bar-dot" />
            </span>
            <span className="d9-bar-title">voidhop — /dev/ttyA0 — IX</span>
            <Link to="/designs" className="d9-bar-nav">
              ← INDEX
            </Link>
          </div>

          <div className="d9-screen">
            {lines.map((l, i) => (
              <div key={i} className={`d9-line d9-line-${l.kind}`}>
                {l.text}
              </div>
            ))}
            {phase !== "running" && (
              <div className="d9-line d9-input-line">
                <span className="d9-prompt">{promptFor(phase)}</span>
                <input
                  ref={inputRef}
                  className="d9-input"
                  type={
                    phase === "ask-password" || phase === "ask-password-confirm"
                      ? "password"
                      : "text"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="shell input"
                />
                <span className="d9-cursor">█</span>
              </div>
            )}
            {phase === "running" && <Spinner />}
            <div ref={endRef} />
          </div>
        </div>
      </div>

      <style>{css}</style>
    </>
  );
}

function Spinner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => x + 1), 120);
    return () => window.clearInterval(id);
  }, []);
  const frames = ["▓▒░", "▒░▓", "░▓▒", "▓▒░"];
  return (
    <div className="d9-line d9-line-dim">
      <span>{frames[i % frames.length]}</span>
      <span style={{ marginLeft: 8 }}>working…</span>
    </div>
  );
}

function initialLines(): Line[] {
  return [
    { kind: "system", text: "voidhop shell v9 · interactive" },
    { kind: "dim", text: "type 'hop <url>' to begin  ·  '/help' for commands" },
    { kind: "dim", text: "" },
  ];
}

function helpLines(): Line[] {
  return [
    { kind: "dim", text: "──────── HELP ────────" },
    { kind: "dim", text: "hop <url>    start a shorten flow" },
    { kind: "dim", text: "copy         copy the last short url" },
    { kind: "dim", text: "new          reset the shell" },
    { kind: "dim", text: "/help        show this" },
    { kind: "dim", text: "/clear       clear the screen" },
    { kind: "dim", text: "/quit        reset to idle" },
    { kind: "dim", text: "↑ / ↓        recall previous input" },
    { kind: "dim", text: "──────────────────────" },
  ];
}

function promptFor(phase: Phase): string {
  switch (phase) {
    case "idle":
      return "voidhop:~$";
    case "ask-url":
      return "url>";
    case "ask-ttl":
      return "ttl>";
    case "ask-password":
      return "pw?>";
    case "ask-password-confirm":
      return "confirm>";
    case "ask-uses":
      return "uses>";
    case "ask-deletion":
      return "revoke?";
    case "running":
      return "…";
    case "done":
      return "voidhop:~$";
  }
}

function maskIfPwd(value: string, phase: Phase): string {
  if (phase === "ask-password" || phase === "ask-password-confirm") {
    return value.length === 0 ? "" : "•".repeat(Math.min(value.length, 12));
  }
  return value;
}

function parseTtl(v: string): number | null {
  if (v === "" || v === "7d") return 604800;
  if (v === "1h") return 3600;
  if (v === "24h" || v === "1d") return 86400;
  return null;
}

function parseUses(v: string): number | "unlimited" | "invalid" {
  if (v === "" || v === "unlimited" || v === "u") return "unlimited";
  if (v === "1" || v === "3" || v === "10") return Number(v);
  return "invalid";
}

function FontLoader() {
  useEffect(() => {
    const id = "d9-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

const css = `
.d9-root {
  position: relative;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at center, #1a1000 0%, #050200 70%, #000 100%);
  padding: 40px 24px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  color: #ffb000;
  overflow: hidden;
  isolation: isolate;
}
.d9-scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.3) 3px,
    rgba(0, 0, 0, 0) 4px
  );
}
.d9-frame {
  position: relative;
  z-index: 2;
  max-width: 920px;
  margin: 0 auto;
  border: 2px solid rgba(255, 176, 0, 0.4);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.9);
  box-shadow:
    0 0 0 1px rgba(255, 176, 0, 0.25),
    inset 0 0 120px rgba(255, 176, 0, 0.08),
    0 30px 80px rgba(255, 176, 0, 0.18);
  overflow: hidden;
}
.d9-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 176, 0, 0.35);
  background: linear-gradient(180deg, rgba(255, 176, 0, 0.1), transparent);
}
.d9-bar-dots {
  display: inline-flex;
  gap: 8px;
}
.d9-bar-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 176, 0, 0.35);
}
.d9-bar-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.18em;
  color: rgba(255, 176, 0, 0.75);
  text-transform: uppercase;
}
.d9-bar-nav {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #ffb000;
  text-decoration: none;
  border: 1px solid rgba(255, 176, 0, 0.4);
  padding: 4px 10px;
}
.d9-bar-nav:hover {
  background: rgba(255, 176, 0, 0.12);
}
.d9-screen {
  padding: 24px 28px 32px;
  min-height: 70vh;
  max-height: 75vh;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.55;
  caret-color: #ffb000;
}
.d9-screen::-webkit-scrollbar {
  width: 10px;
}
.d9-screen::-webkit-scrollbar-track {
  background: rgba(255, 176, 0, 0.05);
}
.d9-screen::-webkit-scrollbar-thumb {
  background: rgba(255, 176, 0, 0.3);
  border-radius: 5px;
}
.d9-line {
  white-space: pre-wrap;
  word-break: break-word;
  text-shadow: 0 0 6px rgba(255, 176, 0, 0.35);
}
.d9-line-system {
  color: #ffb000;
}
.d9-line-prompt {
  color: #ffb000;
  font-weight: 700;
}
.d9-line-input {
  color: #ffe18a;
}
.d9-line-ok {
  color: #7dff7d;
  text-shadow: 0 0 6px rgba(125, 255, 125, 0.35);
}
.d9-line-err {
  color: #ff6161;
  text-shadow: 0 0 6px rgba(255, 97, 97, 0.5);
}
.d9-line-dim {
  color: #7a5300;
}
.d9-input-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}
.d9-prompt {
  color: #ffb000;
  font-weight: 700;
  flex-shrink: 0;
}
.d9-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ffe18a;
  font-family: inherit;
  font-size: inherit;
  outline: none;
  caret-color: transparent;
  padding: 0;
  border-radius: 0;
}
.d9-cursor {
  color: #ffb000;
  animation: d9-blink 1s steps(2) infinite;
  line-height: 1;
}
@keyframes d9-blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}
`;
