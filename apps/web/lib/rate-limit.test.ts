import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, requestKey } from "./rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("blocks requests over the limit and resets after the window", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    expect(limiter.consume("visitor", 0).allowed).toBe(true);
    expect(limiter.consume("visitor", 10).allowed).toBe(true);
    expect(limiter.consume("visitor", 20).allowed).toBe(false);
    expect(limiter.consume("visitor", 1_001).allowed).toBe(true);
  });
});

describe("requestKey", () => {
  it("does not trust client-supplied forwarding headers by default", () => {
    delete process.env.BIOCTL_TRUST_PROXY;
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(requestKey(request)).toBe("shared");
  });

  it("uses the first forwarding address only when explicitly enabled", () => {
    process.env.BIOCTL_TRUST_PROXY = "true";
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(requestKey(request)).toBe("203.0.113.5");
    delete process.env.BIOCTL_TRUST_PROXY;
  });
});
