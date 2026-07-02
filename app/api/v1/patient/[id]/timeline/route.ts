import { NextResponse } from "next/server";
import { serverEventStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { serverError } from "@/modules/unone-health/core/routeErrors";

export const runtime = "nodejs";
export const maxDuration = 60;
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
      { error: serverError("patient/timeline", error, "Could not load the health timeline. Please try again.").message },
      { status: 500 },
    );
  }
}