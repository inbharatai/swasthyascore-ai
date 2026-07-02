import { NextResponse } from "next/server";
import { isAcceptedLabFile } from "@/modules/unone-health/health-skills/lab-lens/LabLensAgent";
import { serverLabFileStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { uuid, isoNow } from "@/modules/unone-health/core/id";
import { serverError } from "@/modules/unone-health/core/routeErrors";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Upload stores a lab report file (in-memory) for later analysis. The raw file
 * is NOT persisted beyond the process and is only re-read by /analyze.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const patientId = formData.get("patient_id");
    const consentGiven = formData.get("consent_given");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }
    if (typeof patientId !== "string" || !patientId) {
      return NextResponse.json({ error: "patient_id is required." }, { status: 400 });
    }
    if (consentGiven !== "true") {
      return NextResponse.json(
        { error: "Lab upload requires explicit consent." },
        { status: 422 },
      );
    }
    if (!isAcceptedLabFile(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 415 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64DataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    const reportId = uuid();

    await serverLabFileStore.save({
      report_id: reportId,
      patient_id: patientId,
      mime_type: file.type,
      base64_data_url: base64DataUrl,
      filename: file.name || "lab-report",
      created_at: isoNow(),
    });

    return NextResponse.json(
      { report_id: reportId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: serverError("lab-reports/upload", error, "Lab report upload failed. Please try again.").message },
      { status: 500 },
    );
  }
}