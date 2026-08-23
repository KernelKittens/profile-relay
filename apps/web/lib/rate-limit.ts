type Bucket = { count: number; resetAt: number };

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMilliseconds: number,
  ) {}

  consume(key: string, now = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    const current = this.buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + this.windowMilliseconds }
        : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (this.buckets.size > 10_000) {
      for (const [bucketKey, candidate] of this.buckets) {
        if (candidate.resetAt <= now) this.buckets.delete(bucketKey);
      }
    }

    return {
      allowed: bucket.count <= this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }
}

export function requestKey(request: Request): string {
  if (process.env.BIOCTL_TRUST_PROXY !== "true") return "shared";
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

const globalForLimiter = globalThis as typeof globalThis & {
  bioctlRateLimiter?: FixedWindowRateLimiter;
};

export const chatRateLimiter =
  globalForLimiter.bioctlRateLimiter ?? new FixedWindowRateLimiter(12, 60_000);
globalForLimiter.bioctlRateLimiter = chatRateLimiter;
