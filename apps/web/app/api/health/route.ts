import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "../../../lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await loadRuntimeConfig();
    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
