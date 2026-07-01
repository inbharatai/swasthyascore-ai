import { z } from "zod";
import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { SAFETY_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const VOICE_GUIDE_PROMPT = `
You are Swasthyak voice-guide. A patient (or family member) spoke a short voice note about their health.
Convert the transcript into a structured symptom/history summary.

RULES:
- Do NOT diagnose. Do NOT prescribe medicines or dosages.
- Identify symptoms, duration, severity (mild|moderate|severe|unknown), and any emergency red flags.
- Keep the summary simple and supportive. Mention consulting a doctor for anything serious.
- If the note mentions medications, capture them in summary text only — never adjust or prescribe.
- Return ONLY JSON matching the schema.
`.trim();

export const voiceSummarySchema = z.object({
  symptoms: z.array(z.string()),
  duration: z.string().nullable(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]),
  red_flags: z.array(z.string()),
  summary: z.string(),
  notDiagnosis: z.literal(true),
});

export type VoiceSummary = z.infer<typeof voiceSummarySchema>;

export async function summarizeVoiceNote(input: {
  transcript: string;
  patientAge?: number;
  patientSex?: string;
}): Promise<VoiceSummary> {
  const context = [
    input.patientAge ? `Patient age: ${input.patientAge}` : "",
    input.patientSex ? `Patient sex: ${input.patientSex}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return runStructuredResponse({
    mode: "premium",
    schema: voiceSummarySchema,
    schemaName: "voice_summary",
    responseInput: [
      {
        role: "system",
        content: [
          { type: "input_text", text: SAFETY_SYSTEM_PROMPT },
          { type: "input_text", text: VOICE_GUIDE_PROMPT },
        ],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: context },
          { type: "input_text", text: `Transcript:\n${input.transcript}` },
        ],
      },
    ],
  });
}