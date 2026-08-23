// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SiteConfig } from "@bioctl/core";
import { SiteShell } from "./site-shell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const config: SiteConfig = {
  profile: {
    name: "Kernel Kittens",
    handle: "@kernelkittens",
    bio: "Useful things for weird computers.",
    status: "online",
  },
  appearance: {
    accent: "#ff4f9a",
    background: "#f5f1e8",
    surface: "#fffdf7",
    foreground: "#191716",
    radius: "soft",
  },
  links: [
    {
      id: "site",
      label: "Website",
      href: "https://example.com",
      description: "Main site",
      icon: "globe",
      enabled: true,
    },
  ],
  chat: {
    enabled: true,
    title: "Ask this page",
    placeholder: "Type a question",
    welcome: "Ask about the public context.",
    provider: "mock",
    model: "mock",
    systemPrompt: "Answer from context.",
    maxInputCharacters: 4000,
  },
  footer: { showPoweredBy: false, text: "" },
};

describe("SiteShell", () => {
  it("provides a keyboard skip link to the main profile content", () => {
    render(<SiteShell config={config} />);

    expect(screen.getByRole("link", { name: "Skip to profile" })).toHaveAttribute(
      "href", "#profile-content",
    );
    expect(document.querySelector("main")).toHaveAttribute("id", "profile-content");
  });

  it("opens on Links and switches to Chat with the keyboard", async () => {
    const user = userEvent.setup();
    render(<SiteShell config={config} />);

    expect(screen.getByRole("tab", { name: "[ links ]" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("link", { name: /Website/i })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "[ chat ]" }));
    expect(screen.getByRole("tab", { name: "[ chat ]" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("textbox", { name: "Your question" })).toBeVisible();
  });

  it("submits a chat message and displays the plain-text reply", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: "A safe answer." }),
      }),
    );
    render(<SiteShell config={config} />);

    await user.click(screen.getByRole("tab", { name: "[ chat ]" }));
    await user.type(screen.getByRole("textbox", { name: "Your question" }), "Hello");
    await user.click(screen.getByRole("button", { name: "send ->" }));

    expect(await screen.findByText("A safe answer.")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
