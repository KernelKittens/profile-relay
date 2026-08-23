import "server-only";

import {
  normalizeModelOutput,
  type ContextDocument,
  type ModelMessage,
  type Provider,
} from "@bioctl/core";

type ProviderInput = {
  provider: Provider;
  model: string;
  messages: ModelMessage[];
  context: ContextDocument[];
};

const timeoutMilliseconds = 30_000;
const maximumResponseBytes = 2_000_000;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > maximumResponseBytes) throw new Error("Provider response was too large");
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return JSON.parse(text) as unknown;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function extractOpenAIText(body: unknown): string {
  if (!body || typeof body !== "object") throw new Error("Invalid OpenAI response");
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error("OpenAI returned no output");
  const text = output
    .flatMap((item) =>
      item && typeof item === "object" && Array.isArray((item as { content?: unknown }).content)
        ? (item as { content: unknown[] }).content
        : [],
    )
    .filter(
      (item): item is { type: string; text: string } =>
        Boolean(
          item &&
            typeof item === "object" &&
            (item as { type?: unknown }).type === "output_text" &&
            typeof (item as { text?: unknown }).text === "string",
        ),
    )
    .map((item) => item.text)
    .join("\n");
  if (!text) throw new Error("OpenAI returned empty output");
  return text;
}

async function callOpenAI(model: string, messages: ModelMessage[]): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnvironment("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: messages,
      max_output_tokens: 700,
      store: false,
      tools: [],
    }),
    signal: AbortSignal.timeout(timeoutMilliseconds),
  });
  return extractOpenAIText(await readJson(response));
}

async function callAnthropic(model: string, messages: ModelMessage[]): Promise<string> {
  const [system, ...userMessages] = messages;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "x-api-key": requiredEnvironment("ANTHROPIC_API_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: system?.content ?? "",
      messages: userMessages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    }),
    signal: AbortSignal.timeout(timeoutMilliseconds),
  });
  const body = await readJson(response);
  if (!body || typeof body !== "object" || !Array.isArray((body as { content?: unknown }).content)) {
    throw new Error("Invalid Anthropic response");
  }
  const text = (body as { content: unknown[] }).content
    .filter(
      (item): item is { type: string; text: string } =>
        Boolean(
          item &&
            typeof item === "object" &&
            (item as { type?: unknown }).type === "text" &&
            typeof (item as { text?: unknown }).text === "string",
        ),
    )
    .map((item) => item.text)
    .join("\n");
  if (!text) throw new Error("Anthropic returned empty output");
  return text;
}

export function compatibleEndpoint(): string {
  const raw = requiredEnvironment("BIOCTL_COMPATIBLE_BASE_URL");
  const url = new URL(raw);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("Compatible provider URL must use HTTPS or local loopback HTTP");
  }
  return new URL("v1/chat/completions", url.href.endsWith("/") ? url : `${url.href}/`).href;
}

async function callCompatible(model: string, messages: ModelMessage[]): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.BIOCTL_COMPATIBLE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.BIOCTL_COMPATIBLE_API_KEY}`;
  }
  const response = await fetch(compatibleEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, max_tokens: 700, stream: false }),
    signal: AbortSignal.timeout(timeoutMilliseconds),
  });
  const body = await readJson(response);
  const text =
    body && typeof body === "object"
      ? (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
      : undefined;
  if (typeof text !== "string" || !text) throw new Error("Compatible provider returned empty output");
  return text;
}

export async function callProvider(input: ProviderInput): Promise<string> {
  let answer: string;
  if (input.provider === "mock") {
    const titles = input.context.map((document) => document.title).join(", ");
    answer = titles
      ? `This demo is connected to public context about: ${titles}. Set a provider in config/site.json when you are ready to use a real model.`
      : "No public context is configured yet.";
  } else if (input.provider === "openai") {
    answer = await callOpenAI(input.model, input.messages);
  } else if (input.provider === "anthropic") {
    answer = await callAnthropic(input.model, input.messages);
  } else if (input.provider === "compatible") {
    answer = await callCompatible(input.model, input.messages);
  } else {
    throw new Error("Local requests must use the connector relay");
  }
  return normalizeModelOutput(answer);
}
