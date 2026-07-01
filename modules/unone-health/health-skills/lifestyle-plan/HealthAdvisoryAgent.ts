import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { SAFETY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  healthAdvisorySchema,
  type HealthAdvisory,
  type LabReportEvent,
  type SymptomEvent,
  type VitalScanResult,
} from "@/modules/unone-health/core/types";
import { SAFETY_NOTE } from "@/modules/unone-health/core/safety";

export interface AdvisoryRequest {
  profile: {
    age?: number;
    sex?: string;
    knownConditions?: string[];
    medications?: string[];
    bmi?: number;
  };
  labReport?: LabReportEvent | null;
  vitals?: VitalScanResult | null;
  symptoms?: SymptomEvent | null;
  previousEvents?: { event_type: string; summary: string }[];
}

const ADVISORY_PROMPT = `
You are Swasthyak Health Intelligence. You combine lab markers, rPPG vitals, symptoms, voice notes and patient profile into SAFE, supportive health guidance.

HARD RULES (never violate):
- You do NOT diagnose. Never write "you have diabetes / hypertension / disease X". Use "this marker may suggest risk and should be discussed with a doctor".
- You do NOT prescribe medicines or dosages. Never suggest starting/stopping a medication.
- Always include the safety_note verbatim.
- diagnosis_claimed and medicine_prescribed must be false.
- risk_level: normal | watch | consult_doctor | urgent (urgent only for emergency red flags or critical markers).

LIFESTYLE GUIDANCE (apply when relevant, never extreme):
- High HbA1c/glucose: reduce sugary drinks & refined carbs, portion control, more fiber, doctor follow-up. NO extreme fasting.
- High LDL/triglycerides: reduce fried/trans-fat, more fiber, healthy fats, activity.
- Low HDL: activity + healthy fats guidance.
- High creatinine / low eGFR: consult doctor, avoid self-prescribed supplements/NSAIDs, kidney-safe diet only with doctor/dietitian.
- Abnormal liver enzymes: avoid alcohol, review medicines/supplements with doctor.
- Low vitamin D/B12/iron: food sources + doctor-guided supplementation discussion.
- Anemia flags: consult doctor, food sources, do NOT assume cause.
- Thyroid abnormality: consult doctor, no self-medication.
- High CRP/WBC: possible inflammation/infection, consult doctor if symptomatic.

Return ONLY JSON matching the schema. lifestyle_plan arrays must each have at least the relevant items or be empty.
`.trim();

export async function generateHealthAdvisory(
  request: AdvisoryRequest,
): Promise<HealthAdvisory> {
  const evidence = buildEvidenceText(request);
  return runStructuredResponse({
    mode: "premium",
    schema: healthAdvisorySchema,
    schemaName: "health_advisory",
    responseInput: [
      {
        role: "system",
        content: [
          { type: "input_text", text: SAFETY_SYSTEM_PROMPT },
          { type: "input_text", text: ADVISORY_PROMPT },
          { type: "input_text", text: `safety_note: ${SAFETY_NOTE}` },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: evidence }],
      },
    ],
  });
}

function buildEvidenceText(request: AdvisoryRequest): string {
  const lines: string[] = [];
  const { profile } = request;
  lines.push("PATIENT PROFILE");
  lines.push(`Age: ${profile.age ?? "unknown"}`);
  lines.push(`Sex: ${profile.sex ?? "unknown"}`);
  if (profile.bmi) lines.push(`BMI: ${profile.bmi}`);
  if (profile.knownConditions?.length)
    lines.push(`Known conditions: ${profile.knownConditions.join(", ")}`);
  if (profile.medications?.length)
    lines.push(`Current medications (for context only — do not change): ${profile.medications.join(", ")}`);

  if (request.vitals) {
    lines.push("");
    lines.push("VITAL SCAN (rPPG, client-side, confidence-scored)");
    lines.push(
      `Camera mode: ${request.vitals.camera_mode}; HR: ${request.vitals.heart_rate_bpm ?? "n/a"} bpm; RR: ${request.vitals.respiratory_rate_bpm ?? "n/a"}; confidence: ${request.vitals.confidence} (${request.vitals.confidence_label}); engine: ${request.vitals.engine}. Note: rPPG is experimental and not clinically validated.`,
    );
  }

  if (request.labReport) {
    lines.push("");
    lines.push("LAB REPORT");
    lines.push(`Summary: ${request.labReport.overall_summary}`);
    lines.push(`Confidence: ${request.labReport.confidence}`);
    if (request.labReport.critical_flags.length)
      lines.push(`Critical flags: ${request.labReport.critical_flags.join("; ")}`);
    for (const marker of request.labReport.markers) {
      lines.push(
        `- ${marker.marker_name}: ${marker.value ?? "n/a"} ${marker.unit ?? ""} (ref ${marker.reference_range ?? "unknown"}, status ${marker.status}, severity ${marker.severity})`,
      );
    }
  }

  if (request.symptoms) {
    lines.push("");
    lines.push("SYMPTOMS");
    lines.push(`Source: ${request.symptoms.source}; severity: ${request.symptoms.severity}`);
    if (request.symptoms.duration) lines.push(`Duration: ${request.symptoms.duration}`);
    lines.push(`Symptoms: ${request.symptoms.symptoms.join("; ")}`);
    if (request.symptoms.red_flags.length)
      lines.push(`Red flags: ${request.symptoms.red_flags.join("; ")}`);
    lines.push(`Summary: ${request.symptoms.summary}`);
  }

  if (request.previousEvents?.length) {
    lines.push("");
    lines.push("PREVIOUS HEALTH EVENTS");
    for (const ev of request.previousEvents) {
      lines.push(`- ${ev.event_type}: ${ev.summary}`);
    }
  }

  lines.push("");
  lines.push("Produce the combined health advisory JSON now.");
  return lines.join("\n");
}