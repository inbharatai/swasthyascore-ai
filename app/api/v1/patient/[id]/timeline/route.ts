import { NextResponse } from "next/server";
import { serverEventStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const timeline = serverEventStore.list(id);
    return NextResponse.json(timeline, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load timeline." },
      { status: 500 },
    );
  }
}