import { normalizeModelOutput } from "@bioctl/core";
import { NextResponse } from "next/server";
import { bridgeAuthorized } from "../../../../../../lib/bridge-auth";
import { relayStore } from "../../../../../../lib/relay-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!bridgeAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(id)) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  try {
    const body = (await request.json()) as {
      connectorId?: unknown;
      reply?: unknown;
      error?: unknown;
    };
    if (typeof body.connectorId !== "string" || body.connectorId.length > 120) {
      return NextResponse.json({ error: "Invalid result." }, { status: 400 });
    }
    const hasReply = typeof body.reply === "string" && body.reply.length > 0;
    const hasError = typeof body.error === "string" && body.error.length > 0;
    if (hasReply === hasError) {
      return NextResponse.json({ error: "Send one reply or one error." }, { status: 400 });
    }
    const accepted = relayStore.complete(id, body.connectorId, {
      reply: hasReply ? normalizeModelOutput(body.reply as string) : undefined,
      error: hasError ? String(body.error).slice(0, 500) : undefined,
    });
    if (!accepted) {
      return NextResponse.json({ error: "Lease is no longer valid." }, { status: 409 });
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid result." }, { status: 400 });
  }
}
