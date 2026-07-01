import { z } from "zod";
import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { SAFETY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  sanitizeUnsafeWording,
  scanForUnsafeWording,
} from "@/modules/unone-health/core/safety";
import { LAB_LENS_SYSTEM_PROMPT, LAB_LENS_USER_PROMPT } from "./prompts";

/**
 * OpenAI 5.5 Lab Lens. Reads a lab report (PDF or image) and returns structured
 * markers. Uses the report's own reference ranges; never diagnoses or prescribes.
 *
 * Output schema is OpenAI-facing (string confidence reasons etc.); the skill's
 * `index.ts` assembles the canonical LabReportEvent from it.
 */
export const labLensOutputSchema = z.object({
  report_metadata: z.object({
    patient_name: z.string().nullable(),
    age: z.number().nullable(),
    sex: z.string().nullable(),
    lab_name: z.string().nullable(),
    report_date: z.string().nullable(),
  }),
  markers: z.array(
    z.object({
      marker_name: z.string(),
      normalized_marker: z.string(),
      value: z.number().nullable(),
      unit: z.string().nullable(),
      reference_range: z.string().nullable(),
      status: z.enum(["normal", "low", "high", "critical", "unknown"]),
      severity: z.enum(["normal", "watch", "consult_doctor", "urgent"]),
      confidence: z.number().min(0).max(1),
      source_text: z.string().nullable(),
      explanation: z.string(),
    }),
  ),
  critical_flags: z.array(z.string()),
  overall_summary: z.string(),
  confidence: z.number().min(0).max(1),
});

export type LabLensOutput = z.infer<typeof labLensOutputSchema>;

export const LAB_LENS_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type LabLensAcceptedMime =
  (typeof LAB_LENS_ACCEPTED_MIME_TYPES)[number];

export function isAcceptedLabFile(mimeType: string): boolean {
  return (LAB_LENS_ACCEPTED_MIME_TYPES as readonly string[]).includes(
    mimeType.toLowerCase(),
  );
}

export async function analyzeLabReport(input: {
  mimeType: string;
  /** Full base64 data URL, e.g. "data:application/pdf;base64,...." */
  base64DataUrl: string;
  filename?: string;
}): Promise<LabLensOutput> {
  const filePart = buildFilePart(input);

  const output = await runStructuredResponse({
    // "premium" resolves to OPENAI_MODEL_PREMIUM (gpt-5.5) per .env.example.
    mode: "premium",
    schema: labLensOutputSchema,
    schemaName: "lab_lens_output",
    responseInput: [
      {
        role: "system",
        content: [
          { type: "input_text", text: SAFETY_SYSTEM_PROMPT },
          { type: "input_text", text: LAB_LENS_SYSTEM_PROMPT },
        ],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: LAB_LENS_USER_PROMPT },
          filePart,
        ],
      },
    ],
  });

  return enforceLabLensSafety(output);
}

/**
 * Post-check the model output for diagnosis/prescription wording. The prompt
 * forbids it, but prompts are not enforcement — sanitize any marker
 * explanation or the overall summary that drifts, mirroring the advisory path.
 */
export function enforceLabLensSafety(output: LabLensOutput): LabLensOutput {
  const scan = scanForUnsafeWording(
    output.overall_summary,
    ...output.markers.map((m) => m.explanation),
  );
  if (scan.clean) return output;
  return {
    ...output,
    overall_summary: sanitizeUnsafeWording(output.overall_summary),
    markers: output.markers.map((m) => ({
      ...m,
      explanation: sanitizeUnsafeWording(m.explanation),
    })),
  };
}

/** Strip the `data:<mime>;base64,` prefix, returning raw base64. */
function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function buildFilePart(input: {
  mimeType: string;
  base64DataUrl: string;
  filename?: string;
}):
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string } {
  if (input.mimeType.toLowerCase() === "application/pdf") {
    // The OpenAI SDK types `input_file.file_data` as raw base64 (NOT a data
    // URL). `input_image.image_url` accepts data URLs, so images keep theirs.
    return {
      type: "input_file",
      filename: input.filename ?? "lab-report.pdf",
      file_data: stripDataUrlPrefix(input.base64DataUrl),
    };
  }
  return { type: "input_image", image_url: input.base64DataUrl };
}