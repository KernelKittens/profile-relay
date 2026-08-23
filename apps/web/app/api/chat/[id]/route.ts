import { NextResponse } from "next/server";
import { relayStore } from "../../../../lib/relay-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(id)) {
    return NextResponse.json(
      { error: "Request not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const job = relayStore.get(id);
  if (!job) {
    return NextResponse.json(
      { error: "Request not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(job, {
    headers: { "Cache-Control": "no-store" },
  });
}
