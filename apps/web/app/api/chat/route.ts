import { NextResponse } from "next/server";
import {
  buildModelMessages,
  parseChatInput,
  selectContextForProvider,
} from "@bioctl/core";
import { loadRuntimeConfig } from "../../../lib/config";
import { callProvider } from "../../../lib/providers";
import { chatRateLimiter, requestKey } from "../../../lib/rate-limit";
import { relayStore } from "../../../lib/relay-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(request: Request) {
  const rate = chatRateLimiter.consume(requestKey(request));
  if (!rate.allowed) {
    return json(
      { error: "Too many questions. Try again in a minute." },
      429,
      { "Retry-After": String(rate.retryAfterSeconds) },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8_192) return json({ error: "Request is too large." }, 413);

  try {
    const body = (await request.json()) as { message?: unknown };
    const { site, context: allContext } = await loadRuntimeConfig();
    if (!site.chat.enabled) return json({ error: "Chat is disabled." }, 404);
    const message = parseChatInput(body.message);
    if (message.length > site.chat.maxInputCharacters) {
      return json({ error: "Question is too long." }, 400);
    }
    const context = selectContextForProvider(site.chat.provider, allContext);
    const messages = buildModelMessages({
      systemPrompt: site.chat.systemPrompt,
      visitorInput: message,
      context,
    });

    if (site.chat.provider === "local") {
      if (!process.env.BIOCTL_BRIDGE_TOKEN || process.env.BIOCTL_BRIDGE_TOKEN.length < 32) {
        return json({ error: "The local connector is not configured." }, 503);
      }
      const jobId = relayStore.enqueue({ model: site.chat.model, messages });
      return json({ jobId }, 202);
    }

    const reply = await callProvider({
      provider: site.chat.provider,
      model: site.chat.model,
      messages,
      context,
    });
    return json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/question|input|control character/i.test(message)) {
      return json({ error: message }, 400);
    }
    console.error("chat request failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return json({ error: "Chat is unavailable right now." }, 503);
  }
}
