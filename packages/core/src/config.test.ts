import { describe, expect, it } from "vitest";
import { siteConfigSchema } from "./config.js";

const validConfig = {
  profile: {
    name: "Kernel Kittens",
    handle: "@kernelkittens",
    bio: "Small tools, weird computers, useful work.",
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
    title: "Ask me anything",
    placeholder: "Type a question",
    welcome: "Ask about my work.",
    provider: "local",
    model: "llama3.2",
    systemPrompt: "Answer from the supplied context only.",
    maxInputCharacters: 4000,
  },
  footer: {
    showPoweredBy: false,
    text: "",
  },
};

describe("white-label configuration", () => {
  it("accepts a complete branded site", () => {
    expect(siteConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it("requires secure public links", () => {
    expect(() =>
      siteConfigSchema.parse({
        ...validConfig,
        links: [{ ...validConfig.links[0], href: "javascript:alert(1)" }],
      }),
    ).toThrow();
  });

  it("supports a fully unbranded footer", () => {
    const parsed = siteConfigSchema.parse(validConfig);
    expect(parsed.footer.showPoweredBy).toBe(false);
  });
});
