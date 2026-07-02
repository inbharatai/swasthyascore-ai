/**
 * Derive the stored-confidence for a HealthAdvisory event from the inputs that
 * were actually available, instead of a fixed constant. This is the
 * `HealthEvent.confidence` value (audit/transparency), NOT a clinical accuracy
 * claim — the advisory text always carries the "not a diagnosis" safety note.
 *
 * Rationale (medical-engineering):
 *   - An advisory built from a lab report + vitals + full profile is better
 *     evidenced than one built from a few symptoms alone. The score reflects
 *     input completeness so consumers can tell a well-evidenced advisory from
 *     a thin one.
 *   - Emergency / red-flag presentations are intentionally capped LOW: a
 *     confident lifestyle plan is inappropriate when the right action is
 *     urgent care, so the advisory should signal uncertainty, not assurance.
 *
 * Range 0.5–0.9. Pure + stateless so the API route, the tool, and tests share
 * one source of truth.
 */

export interface AdvisoryConfidenceInput {
  profile?: {
    age?: number | null;
    sex?: string | null;
    bmi?: number | null;
  } | null;
  labReport?: unknown | null;
  vitals?: unknown | null;
  symptoms?: {
    severity?: string | null;
    red_flags?: string[] | null;
  } | null;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export function deriveAdvisoryConfidence(
  input: AdvisoryConfidenceInput,
): number {
  let score = 0.5;

  const profile = input.profile ?? null;
  if (profile) {
    if (profile.age != null && profile.sex) score += 0.08;
    if (profile.bmi != null) score += 0.07;
  }
  if (input.labReport) score += 0.15; // strongest objective evidence
  if (input.vitals) score += 0.1;
  if (input.symptoms) score += 0.05;

  // Emergency presentations: cap low — do not project assurance.
  const redFlags = input.symptoms?.red_flags;
  const severe =
    input.symptoms?.severity === "severe" ||
    (Array.isArray(redFlags) && redFlags.length > 0);
  if (severe) {
    score = Math.min(score, 0.7);
  }

  return clamp(Math.round(score * 100) / 100, 0.5, 0.9);
}