import { z } from "zod";

/**
 * Canonical data model for the UnoOne Health embedded module.
 *
 * Safety contract (enforced everywhere):
 * - Never claims a diagnosis.
 * - Never prescribes medicine.
 * - Never uploads raw face video by default.
 * - Confidence is always surfaced to the user.
 *
 * These types are the source of truth shared by every health-skill, the
 * SwasthyakAdapter, the `/api/v1` route handlers and the UI. Schemas that must
 * be validated at runtime (tool I/O, OpenAI structured output) live in
 * `schemas.ts`; the plain TypeScript interfaces here are what app code imports.
 */

export type HealthEventSource =
  | "swasthyak_cloud"
  | "unone_health"
  | "openai_5_5";

export type HealthEventType =
  | "vital_scan"
  | "lab_report"
  | "symptom_event"
  | "voice_note"
  | "health_advisory";

/* -------------------------------------------------------------------------- */
/* Privacy + safety envelopes                                                  */
/* -------------------------------------------------------------------------- */

export const healthEventPrivacySchema = z.object({
  consent_given: z.boolean(),
  raw_video_uploaded: z.boolean().default(false),
  raw_report_uploaded: z.boolean().default(false),
});

export const healthEventSafetySchema = z.object({
  diagnosis_claimed: z.literal(false).default(false),
  medicine_prescribed: z.literal(false).default(false),
});

export type HealthEventPrivacy = z.infer<typeof healthEventPrivacySchema>;
export type HealthEventSafety = z.infer<typeof healthEventSafetySchema>;

/* -------------------------------------------------------------------------- */
/* Canonical HealthEvent (Phase 9)                                            */
/* -------------------------------------------------------------------------- */

export const healthEventSchema = z.object({
  event_id: z.string().min(1),
  patient_id: z.string().min(1),
  source: z.enum(["swasthyak_cloud", "unone_health", "openai_5_5"]),
  event_type: z.enum([
    "vital_scan",
    "lab_report",
    "symptom_event",
    "voice_note",
    "health_advisory",
  ]),
  confidence: z.number().min(0).max(1),
  payload: z.record(z.string(), z.unknown()),
  privacy: healthEventPrivacySchema,
  safety: healthEventSafetySchema,
  created_at: z.string(),
  synced_at: z.string().nullable().default(null),
});

export type HealthEvent = z.infer<typeof healthEventSchema>;

/* -------------------------------------------------------------------------- */
/* Vital scan (Phase 4)                                                       */
/* -------------------------------------------------------------------------- */

export const vitalScanResultSchema = z.object({
  event_type: z.literal("vital_scan"),
  source: z.literal("unone_health"),
  camera_mode: z.enum(["front_face", "rear_face", "rear_finger", "unknown"]),
  heart_rate_bpm: z.number().nullable(),
  respiratory_rate_bpm: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  confidence_label: z.enum(["good", "moderate", "low", "fail"]),
  signal_quality: z.enum(["good", "acceptable", "poor", "unknown"]),
  lighting_quality: z.enum(["good", "acceptable", "poor", "unknown"]),
  motion_detected: z.boolean(),
  face_stability: z.enum(["stable", "unstable", "unknown"]),
  duration_seconds: z.number(),
  raw_video_uploaded: z.literal(false),
  repeat_scan_recommended: z.boolean(),
  created_at: z.string(),
  /**
   * DEMO/DEV ONLY marker. When `engine === "mock"` the result was produced by
   * the clearly-named MockRppgEngine and must NOT be treated as a real
   * physiological measurement.
   */
  engine: z.enum(["mock", "signal"]).default("mock"),
});

export type VitalScanResult = z.infer<typeof vitalScanResultSchema>;

export type VitalScanConfidenceInputs = {
  faceRoiStability: number; // 0..1
  motionScore: number; // 0..1 (1 = still)
  lightingScore: number; // 0..1
  signalQuality: number; // 0..1
  leftRightRoiConsistency: number; // 0..1
};

/* -------------------------------------------------------------------------- */
/* Lab lens (Phase 5)                                                         */
/* -------------------------------------------------------------------------- */

export const labMarkerStatusSchema = z.enum([
  "normal",
  "low",
  "high",
  "critical",
  "unknown",
]);
export const labMarkerSeveritySchema = z.enum([
  "normal",
  "watch",
  "consult_doctor",
  "urgent",
]);

export const labMarkerSchema = z.object({
  marker_name: z.string(),
  normalized_marker: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  reference_range: z.string().nullable(),
  status: labMarkerStatusSchema,
  severity: labMarkerSeveritySchema,
  confidence: z.number().min(0).max(1),
  source_text: z.string().nullable(),
  explanation: z.string(),
});

export type LabMarker = z.infer<typeof labMarkerSchema>;
export type LabMarkerStatus = z.infer<typeof labMarkerStatusSchema>;
export type LabMarkerSeverity = z.infer<typeof labMarkerSeveritySchema>;

export const labReportMetadataSchema = z.object({
  patient_name: z.string().nullable(),
  age: z.number().nullable(),
  sex: z.string().nullable(),
  lab_name: z.string().nullable(),
  report_date: z.string().nullable(),
});

export const labReportEventSchema = z.object({
  event_id: z.string(),
  patient_id: z.string(),
  source: z.literal("openai_5_5"),
  event_type: z.literal("lab_report"),
  report_metadata: labReportMetadataSchema,
  markers: z.array(labMarkerSchema),
  critical_flags: z.array(z.string()),
  overall_summary: z.string(),
  confidence: z.number().min(0).max(1),
  raw_file_uploaded: z.boolean(),
  created_at: z.string(),
});

export type LabReportEvent = z.infer<typeof labReportEventSchema>;
export type LabReportMetadata = z.infer<typeof labReportMetadataSchema>;

/* -------------------------------------------------------------------------- */
/* Symptoms + voice (Phase 6)                                                 */
/* -------------------------------------------------------------------------- */

export const symptomEventSchema = z.object({
  event_type: z.literal("symptom_event"),
  source: z.enum(["voice", "text"]),
  symptoms: z.array(z.string()),
  duration: z.string().nullable(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]),
  red_flags: z.array(z.string()),
  summary: z.string(),
  created_at: z.string(),
});

export type SymptomEvent = z.infer<typeof symptomEventSchema>;

/* -------------------------------------------------------------------------- */
/* Combined health advisory (Phase 7)                                         */
/* -------------------------------------------------------------------------- */

export const healthAdvisoryLifestylePlanSchema = z.object({
  diet: z.array(z.string()),
  activity: z.array(z.string()),
  sleep: z.array(z.string()),
  hydration: z.array(z.string()),
  avoid: z.array(z.string()),
  follow_up: z.array(z.string()),
});

export const healthAdvisoryFindingSchema = z.object({
  title: z.string(),
  why_it_matters: z.string(),
  related_markers: z.array(z.string()),
  recommended_next_step: z.string(),
});

export const healthAdvisorySchema = z.object({
  risk_level: z.enum(["normal", "watch", "consult_doctor", "urgent"]),
  top_findings: z.array(healthAdvisoryFindingSchema),
  user_message: z.string(),
  follow_up_questions: z.array(z.string()),
  repeat_scan_recommended: z.boolean(),
  doctor_summary: z.string(),
  family_summary: z.string(),
  lifestyle_plan: healthAdvisoryLifestylePlanSchema,
  safety_note: z.string(),
  /**
   * Forced safety guarantees. The advisory is rejected if OpenAI returns
   * either as true.
   */
  diagnosis_claimed: z.literal(false).default(false),
  medicine_prescribed: z.literal(false).default(false),
});

export type HealthAdvisory = z.infer<typeof healthAdvisorySchema>;
export type HealthAdvisoryFinding = z.infer<typeof healthAdvisoryFindingSchema>;
export type HealthAdvisoryLifestylePlan = z.infer<
  typeof healthAdvisoryLifestylePlanSchema
>;

/* -------------------------------------------------------------------------- */
/* Tool registry descriptors (Phase 3)                                        */
/* -------------------------------------------------------------------------- */

export type ToolNamespace =
  | "health.vitals"
  | "health.lab"
  | "health.symptoms"
  | "health.voice"
  | "health.reasoning"
  | "health.record"
  | "health.sync";

export type ToolPermission =
  | "camera"
  | "microphone"
  | "file_upload"
  | "lab_consent"
  | "voice_consent"
  | "network";

export type SafetyFlag =
  | "no_diagnosis"
  | "no_prescription"
  | "no_raw_face_video"
  | "requires_consent"
  | "confidence_required"
  | "emergency_red_flags";

export interface ToolDescriptor {
  name: string;
  namespace: ToolNamespace;
  description: string;
  permissions: ToolPermission[];
  offline_supported: boolean;
  input_schema: z.ZodTypeAny;
  output_schema: z.ZodTypeAny;
  safety_flags: SafetyFlag[];
  /**
   * Receives the already-Zod-validated input (so the runtime guarantees the
   * shape before this runs). Typed `unknown` because the descriptor is stored
   * generically in the registry; each tool casts to its own input type.
   */
  run: (input: unknown, context: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  patientId: string;
  consent: Record<ToolPermission, boolean>;
  online: boolean;
  /** ISO timestamp. Injected so tests stay deterministic. */
  now: () => string;
  /** Persistent (localStorage) event store for offline-first skills. */
  events: {
    save: (event: HealthEvent) => void;
    list: (patientId: string) => HealthEvent[];
    markSynced: (eventId: string, syncedAt: string) => void;
  };
}

/* -------------------------------------------------------------------------- */
/* Sync status                                                                */
/* -------------------------------------------------------------------------- */

export type SyncStatus = "pending" | "synced" | "failed";

export interface QueuedEvent {
  event: HealthEvent;
  status: SyncStatus;
  attempts: number;
  last_error: string | null;
}