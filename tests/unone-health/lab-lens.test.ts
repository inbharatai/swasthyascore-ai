import { describe, expect, it } from "vitest";
import {
  isAcceptedLabFile,
  LAB_LENS_ACCEPTED_MIME_TYPES,
} from "@/modules/unone-health/health-skills/lab-lens/LabLensAgent";
import {
  labMarkerSchema,
  labReportEventSchema,
} from "@/modules/unone-health/core/types";

describe("lab lens file acceptance", () => {
  it("accepts PDF and common image types", () => {
    expect(isAcceptedLabFile("application/pdf")).toBe(true);
    expect(isAcceptedLabFile("image/jpeg")).toBe(true);
    expect(isAcceptedLabFile("image/png")).toBe(true);
    expect(isAcceptedLabFile("image/webp")).toBe(true);
  });

  it("rejects unsupported types", () => {
    expect(isAcceptedLabFile("application/msword")).toBe(false);
    expect(isAcceptedLabFile("video/mp4")).toBe(false);
    expect(isAcceptedLabFile("")).toBe(false);
  });

  it("exposes a stable accepted-mime list", () => {
    expect(LAB_LENS_ACCEPTED_MIME_TYPES).toContain("application/pdf");
  });
});

const sampleMarker = {
  marker_name: "HbA1c",
  normalized_marker: "hba1c",
  value: 7.2,
  unit: "%",
  reference_range: "4.0-5.6",
  status: "high",
  severity: "consult_doctor",
  confidence: 0.91,
  source_text: "HbA1c 7.2 %",
  explanation: "This marker may suggest risk and should be discussed with a doctor.",
};

describe("lab marker + report schemas", () => {
  it("validates a LabMarker", () => {
    expect(() => labMarkerSchema.parse(sampleMarker)).not.toThrow();
  });

  it("validates a full LabReportEvent with non-diagnostic explanation", () => {
    const event = {
      event_id: "ev-1",
      patient_id: "p-1",
      source: "openai_5_5",
      event_type: "lab_report",
      report_metadata: {
        patient_name: "Jane",
        age: 45,
        sex: "female",
        lab_name: "City Lab",
        report_date: "2026-06-01",
      },
      markers: [sampleMarker],
      critical_flags: ["Very high HbA1c — discuss with a doctor urgently."],
      overall_summary: "One marker may suggest risk; discuss with a doctor.",
      confidence: 0.9,
      raw_file_uploaded: true,
      created_at: "2026-07-01T00:00:00.000Z",
    };
    expect(() => labReportEventSchema.parse(event)).not.toThrow();
  });

  it("rejects an invalid marker status", () => {
    expect(() =>
      labMarkerSchema.parse({ ...sampleMarker, status: "broken" }),
    ).toThrow();
  });

  it("rejects a diagnosis-style explanation via schema enum? (status only)", () => {
    // The schema allows any explanation string; the safety wording guard is
    // tested separately. Here we confirm severity enum rejects bad values.
    expect(() =>
      labMarkerSchema.parse({ ...sampleMarker, severity: "emergency" }),
    ).toThrow();
  });
});