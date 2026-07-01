/**
 * Safety wording guards. Used to post-check any AI-generated, user-facing text
 * so a model that drifts off the safety contract is caught before display.
 *
 * These are conservative pattern matchers, not NLP — they exist to enforce the
 * "no diagnosis / no prescription" guarantees, not to censor legitimate
 * explanations. Matches are case-insensitive and word-aware.
 */

const DIAGNOSIS_PATTERNS = [
  /\byou\s+(have|are\s+suffering\s+from)\s+/i,
  /\bdiagnos(?:is|ed)\s+(?:of\s+)?(?:you|with)\b/i,
  /\bconfirmed\s+(?:diagnosis|case\s+of)\b/i,
];

const PRESCRIPTION_PATTERNS = [
  /\btake\s+\d+\s*mg\b/i,
  /\b\d+\s*mg\s+(?:twice|once|three\s+times|daily)\b/i,
  /\bprescribe(?:s|d)?\s+\b/i,
  /\bstart\s+(?:on\s+)?(?:metformin|insulin|atorvastatin|amoxicillin|azithromycin|ibuprofen|paracetamol|aspirin)\b/i,
  /\bdosage?\s+of\s+\d+/i,
];

export interface SafetyScanResult {
  clean: boolean;
  diagnosisClaims: string[];
  prescriptionClaims: string[];
}

export function scanForUnsafeWording(...texts: string[]): SafetyScanResult {
  const diagnosisClaims: string[] = [];
  const prescriptionClaims: string[] = [];

  for (const text of texts) {
    if (!text) continue;
    for (const pattern of DIAGNOSIS_PATTERNS) {
      const match = text.match(pattern);
      if (match) diagnosisClaims.push(match[0]);
    }
    for (const pattern of PRESCRIPTION_PATTERNS) {
      const match = text.match(pattern);
      if (match) prescriptionClaims.push(match[0]);
    }
  }

  return {
    clean: diagnosisClaims.length === 0 && prescriptionClaims.length === 0,
    diagnosisClaims,
    prescriptionClaims,
  };
}

/** Strip the offending phrasing and append the standard consult-doctor note. */
export function sanitizeUnsafeWording(text: string): string {
  let sanitized = text;
  for (const pattern of [...DIAGNOSIS_PATTERNS, ...PRESCRIPTION_PATTERNS]) {
    sanitized = sanitized.replace(pattern, "[review with a doctor]");
  }
  return sanitized;
}

export const SAFETY_NOTE =
  "This is AI-assisted interpretation, not a diagnosis. Consult a qualified doctor for medical decisions.";

export const EMERGENCY_RED_FLAGS = [
  "chest pain",
  "severe breathlessness",
  "shortness of breath at rest",
  "fainting",
  "loss of consciousness",
  "stroke",
  "face drooping",
  "arm weakness",
  "speech difficulty",
  "blue lips",
  "bluish lips",
  "severe weakness",
  "confusion",
  "severe dehydration",
  "pregnancy bleeding",
  "pregnancy complication",
  "very high fever",
  "seizure",
  "suicidal",
  "uncontrolled bleeding",
] as const;

export function detectRedFlags(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const lower = text.toLowerCase();
    for (const flag of EMERGENCY_RED_FLAGS) {
      if (lower.includes(flag)) found.add(flag);
    }
  }
  return [...found];
}