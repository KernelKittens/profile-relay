"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { SiteConfig } from "@bioctl/core";

type Tab = "links" | "chat";
type Message = { role: "assistant" | "user"; content: string };
type BrandStyle = CSSProperties & {
  "--brand-accent": string;
  "--brand-background": string;
  "--brand-surface": string;
  "--brand-foreground": string;
  "--radius": string;
};

const iconLetters: Record<SiteConfig["links"][number]["icon"], string> = {
  globe: "www",
  github: "git",
  discord: "dc",
  mail: "@",
  heart: "<3",
  code: "</>",
  link: "lnk",
};

function radiusValue(radius: SiteConfig["appearance"]["radius"]): string {
  if (radius === "square") return "6px";
  if (radius === "round") return "30px";
  return "22px";
}

async function waitForReply(jobId: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const response = await fetch(`/api/chat/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("The local connector stopped responding.");
    const body = (await response.json()) as {
      status: "queued" | "leased" | "complete" | "failed";
      reply?: string;
      error?: string;
    };
    if (body.status === "complete" && body.reply) return body.reply;
    if (body.status === "failed") {
      throw new Error(body.error || "The local model could not answer.");
    }
  }
  throw new Error("The local model took too long to answer.");
}

export function SiteShell({ config }: { config: SiteConfig }) {
  const [tab, setTab] = useState<Tab>("links");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: config.chat.welcome },
  ]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages, busy]);

  const brandStyle: BrandStyle = {
    "--brand-accent": config.appearance.accent,
    "--brand-background": config.appearance.background,
    "--brand-surface": config.appearance.surface,
    "--brand-foreground": config.appearance.foreground,
    "--radius": radiusValue(config.appearance.radius),
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setInput("");
    setBusy(true);
    setStatus("Thinking...");
    setMessages((current) => [...current, { role: "user", content: question }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const body = (await response.json()) as {
        reply?: string;
        jobId?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Chat is unavailable.");
      const reply = body.reply ?? (body.jobId ? await waitForReply(body.jobId) : "");
      if (!reply) throw new Error("The model returned an empty answer.");
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      setStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat is unavailable.";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: message },
      ]);
      setStatus("Could not finish that request.");
    } finally {
      setBusy(false);
    }
  }

  const initials = config.profile.name
    .split(/\s+/u)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <a className="skip-link" href="#profile-content">Skip to profile</a>
      <main className="site-frame" id="profile-content" style={brandStyle}>
      <section className="profile-card" aria-labelledby="profile-name">
        <header className="profile-header">
          <div className="avatar" aria-hidden="true">
            {config.profile.avatar ? (
              // Config owners control this URL. CSP restricts images to this origin.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.profile.avatar} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="identity">
            <h1 id="profile-name">{config.profile.name}</h1>
            <div className="identity-line">
              <span>{config.profile.handle}</span>
              <span className="status-dot" aria-hidden="true" />
              <span>{config.profile.status}</span>
            </div>
            <p className="bio">{config.profile.bio}</p>
          </div>
        </header>

        <div className="terminal-card">
          <div className="terminal-bar" aria-hidden="true">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">~/bio</span>
          </div>
          <div className="tabs" role="tablist" aria-label="Profile sections">
            <button
              className="tab"
              id="tab-links"
              role="tab"
              aria-selected={tab === "links"}
              aria-controls="panel-links"
              onClick={() => setTab("links")}
              type="button"
            >
              [ links ]
            </button>
            <button
              className="tab"
              id="tab-chat"
              role="tab"
              aria-selected={tab === "chat"}
              aria-controls="panel-chat"
              onClick={() => setTab("chat")}
              type="button"
              disabled={!config.chat.enabled}
            >
              [ chat ]
            </button>
          </div>

          <div
            className="panel"
            id="panel-links"
            role="tabpanel"
            aria-labelledby="tab-links"
            hidden={tab !== "links"}
          >
            <ul className="link-list">
              {config.links
                .filter((link) => link.enabled)
                .map((link) => (
                  <li key={link.id}>
                    <a
                      className="link-card"
                      href={link.href}
                      target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                    >
                      <span className="link-icon" aria-hidden="true">
                        {iconLetters[link.icon]}
                      </span>
                      <span className="link-copy">
                        <strong>{link.label}</strong>
                        <span>{link.description}</span>
                      </span>
                      <span className="link-arrow" aria-hidden="true">-&gt;</span>
                    </a>
                  </li>
                ))}
            </ul>
          </div>

          <div
            className="panel chat-panel"
            id="panel-chat"
            role="tabpanel"
            aria-labelledby="tab-chat"
            hidden={tab !== "chat"}
          >
            <div className="chat-intro">
              <h2>{config.chat.title}</h2>
              <p>Answers use only the context this site owner shared.</p>
              <span className="safety-chip">no tools / no account access</span>
            </div>
            <div className="chat-log" ref={logRef} aria-live="polite" aria-label="Chat messages">
              {messages.map((message, index) => (
                <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.content}
                </div>
              ))}
              {busy ? <div className="message assistant">...</div> : null}
            </div>
            <form className="chat-form" onSubmit={submit}>
              <label className="sr-only" htmlFor="chat-input">Your question</label>
              <textarea
                id="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={config.chat.maxInputCharacters}
                placeholder={config.chat.placeholder}
                disabled={busy}
                required
              />
              <div className="chat-actions">
                <span className="character-count">
                  {input.length}/{config.chat.maxInputCharacters}
                </span>
                <button className="send-button" type="submit" disabled={busy || !input.trim()}>
                  send -&gt;
                </button>
              </div>
              <div className="chat-status" role="status">{status}</div>
            </form>
          </div>
        </div>

        {config.footer.showPoweredBy || config.footer.text ? (
          <footer className="site-footer">
            {config.footer.text}
            {config.footer.showPoweredBy ? " / powered by bioctl" : ""}
          </footer>
        ) : null}
      </section>
      </main>
    </>
  );
}
