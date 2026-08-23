import { NextResponse } from "next/server";
import { bridgeAuthorized } from "../../../../../lib/bridge-auth";
import { relayStore } from "../../../../../lib/relay-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const body = (await request.json()) as {
      connectorId?: unknown;
      models?: unknown;
    };
    if (
      typeof body.connectorId !== "string" ||
      body.connectorId.length > 120 ||
      !Array.isArray(body.models) ||
      body.models.length > 32 ||
      !body.models.every((model) => typeof model === "string" && model.length <= 160)
    ) {
      return NextResponse.json({ error: "Invalid connector claim." }, { status: 400 });
    }
    const job = relayStore.claim(body.connectorId, body.models as string[]);
    if (!job) return new NextResponse(null, { status: 204 });
    return NextResponse.json(job, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid connector claim." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
