import { describe, expect, it } from "vitest";
import { assertSafeModelEndpoint, assertSafeSiteUrl } from "./connector.js";

describe("local model endpoint policy", () => {
  it.each([
    "http://127.0.0.1:11434",
    "http://localhost:1234",
    "http://10.0.0.4:8080",
    "http://172.20.0.2:8080",
    "http://192.168.1.9:8080",
    "https://100.100.20.30:443",
  ])("allows local and Tailscale endpoints: %s", (endpoint) => {
    expect(assertSafeModelEndpoint(endpoint)).toMatch(/^https?:/);
  });

  it.each([
    "https://api.openai.com",
    "http://8.8.8.8:8080",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
  ])("blocks public, metadata, and non-HTTP endpoints: %s", (endpoint) => {
    expect(() => assertSafeModelEndpoint(endpoint)).toThrow();
  });
});

describe("site relay URL policy", () => {
  it("requires HTTPS for a remote site", () => {
    expect(assertSafeSiteUrl("https://bio.example.com")).toBe("https://bio.example.com");
    expect(() => assertSafeSiteUrl("http://bio.example.com")).toThrow();
  });

  it("permits HTTP on loopback for development", () => {
    expect(assertSafeSiteUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
});
