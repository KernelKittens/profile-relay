import { randomUUID } from "node:crypto";
import { normalizeModelOutput, type ModelMessage } from "@bioctl/core";
import { loadConnectorConfig, type ConnectorConfig } from "./files.js";

type ClaimedJob = {
  id: string;
  model: string;
  messages: ModelMessage[];
  expiresAt: number;
};

function ipv4Parts(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map(Number);
  return numbers.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
    ? numbers
    : null;
}

function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1") return true;
  const ip = ipv4Parts(normalized);
  if (!ip) return false;
  const [first = -1, second = -1] = ip;
  return (
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

export function assertSafeModelEndpoint(raw: string): string {
  const url = new URL(raw);
  if (!isPrivateHost(url.hostname)) {
    throw new Error("The local model endpoint must use loopback, a private LAN address, or Tailscale CGNAT.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The local model endpoint must use HTTP or HTTPS.");
  }
  return url.href.replace(/\/$/, "");
}

export function assertSafeSiteUrl(raw: string): string {
  const url = new URL(raw);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("The site URL must use HTTPS unless it is local loopback.");
  }
  return url.href.replace(/\/$/, "");
}

async function limitedJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("Response was too large");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

async function claim(config: ConnectorConfig, signal: AbortSignal): Promise<ClaimedJob | null> {
  const response = await fetch(`${config.siteUrl}/api/bridge/jobs/claim`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.bridgeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connectorId: config.connectorId, models: config.models }),
    signal,
  });
  if (response.status === 204) return null;
  return (await limitedJson(response)) as ClaimedJob;
}

async function runLocalModel(config: ConnectorConfig, job: ClaimedJob): Promise<string> {
  const endpoint = `${assertSafeModelEndpoint(config.modelEndpoint)}/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: job.model,
      messages: job.messages,
      stream: false,
      max_tokens: 700,
      tools: [],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await limitedJson(response);
  const content =
    body && typeof body === "object"
      ? (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
      : undefined;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Local model returned an empty response");
  }
  return normalizeModelOutput(content);
}

async function report(
  config: ConnectorConfig,
  job: ClaimedJob,
  outcome: { reply?: string; error?: string },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${config.siteUrl}/api/bridge/jobs/${encodeURIComponent(job.id)}/result`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.bridgeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connectorId: config.connectorId, ...outcome }),
      signal,
    },
  );
  if (!response.ok && response.status !== 409) {
    throw new Error(`Could not report result: HTTP ${response.status}`);
  }
}

function validateConfig(config: ConnectorConfig): ConnectorConfig {
  config.siteUrl = assertSafeSiteUrl(config.siteUrl);
  config.modelEndpoint = assertSafeModelEndpoint(config.modelEndpoint);
  if (config.bridgeToken.length < 32) throw new Error("Bridge token must be at least 32 characters.");
  if (!config.connectorId) config.connectorId = randomUUID();
  if (config.models.length === 0 || config.models.length > 32) {
    throw new Error("Configure at least one local model and no more than 32.");
  }
  if (config.models.some((model) => !model || model.length > 160)) {
    throw new Error("A configured model name is invalid.");
  }
  return config;
}

export async function runConnector(): Promise<void> {
  const config = validateConfig(await loadConnectorConfig());
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  process.stdout.write(`bioctl connector\nsite: ${config.siteUrl}\nmodels: ${config.models.join(", ")}\n\n`);
  process.stdout.write("connected. waiting for jobs...\n");

  while (!controller.signal.aborted) {
    try {
      const job = await claim(config, controller.signal);
      if (!job) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 1_200);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(controller.signal.reason);
            },
            { once: true },
          );
        });
        continue;
      }
      process.stdout.write(`job ${job.id.slice(0, 8)} model=${job.model}\n`);
      try {
        const reply = await runLocalModel(config, job);
        await report(config, job, { reply }, controller.signal);
        process.stdout.write(`done ${job.id.slice(0, 8)}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Local model failed";
        await report(config, job, { error: message.slice(0, 500) }, controller.signal);
        process.stderr.write(`failed ${job.id.slice(0, 8)}: ${message}\n`);
      }
    } catch (error) {
      if (controller.signal.aborted) break;
      const message = error instanceof Error ? error.message : "connector error";
      process.stderr.write(`connector: ${message}; retrying\n`);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  process.stdout.write("connector stopped\n");
}
