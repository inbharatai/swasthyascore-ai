/**
 * Public barrel for the UnoOne Health embedded module. App code imports from
 * "@/lib/unone-health" and never reaches into the module internals directly.
 */
import { UnoOneHealthRuntime } from "@/modules/unone-health/core/runtime";
import type { RppgEngine } from "@/modules/unone-health/health-skills/rppg-vital-scan/engine";
import { createRppgScanTool } from "@/modules/unone-health/health-skills/rppg-vital-scan";
import { createLabExtractMarkersTool } from "@/modules/unone-health/health-skills/lab-lens";
import { createSymptomCollectTool } from "@/modules/unone-health/health-skills/symptom-check";
import { createVoiceSummarizeTool } from "@/modules/unone-health/health-skills/voice-guide";
import { createGeneratePlanTool } from "@/modules/unone-health/health-skills/lifestyle-plan";
import {
  createRecordSaveTool,
  createSyncQueueTool,
} from "@/modules/unone-health/health-skills/health-events";

export type {
  HealthEvent,
  HealthEventType,
  HealthEventSource,
  HealthEventPrivacy,
  HealthEventSafety,
  VitalScanResult,
  VitalScanConfidenceInputs,
  LabMarker,
  LabMarkerStatus,
  LabMarkerSeverity,
  LabReportEvent,
  LabReportMetadata,
  SymptomEvent,
  HealthAdvisory,
  HealthAdvisoryFinding,
  HealthAdvisoryLifestylePlan,
  ToolDescriptor,
  ToolContext,
  ToolPermission,
  SafetyFlag,
  SyncStatus,
  QueuedEvent,
} from "@/modules/unone-health/core/types";

export { UnoOneHealthRuntime } from "@/modules/unone-health/core/runtime";
export { ToolRegistry } from "@/modules/unone-health/core/toolRegistry";
export {
  PermissionManager,
  PermissionDeniedError,
} from "@/modules/unone-health/core/permissions";
export {
  InMemoryHealthEventStore,
  InMemoryOfflineQueue,
  LocalStorageHealthEventStore,
  LocalStorageOfflineQueue,
  type HealthEventStore,
  type OfflineQueue,
} from "@/modules/unone-health/core/offlineQueue";
export { LocalMemory } from "@/modules/unone-health/core/memory";
export { uuid, isoNow } from "@/modules/unone-health/core/id";
export {
  scanForUnsafeWording,
  sanitizeUnsafeWording,
  detectRedFlags,
  SAFETY_NOTE,
  EMERGENCY_RED_FLAGS,
} from "@/modules/unone-health/core/safety";

export {
  type RppgEngine,
  finalizeVitalScan,
  aggregateFrameSamples,
  type RppgScanParams,
  type RppgScanSamples,
  type RppgFrameSample,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/engine";

// Browser-only real rPPG engine + frame providers. Import these directly from
// the module path in client components (never via this barrel from server code).
export {
  SignalRppgEngine,
  FaceRoiFrameProvider,
  FingerFrameProvider,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/browserRppg";

export {
  computeConfidence,
  labelForConfidence,
  qualityLabel,
  stabilityLabel,
  applyConfidencePolicy,
  buildConfidenceBlock,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/confidence";

export {
  cameraScanReducer,
  cameraFacingToMode,
  initialCameraScanState,
  type CameraScanState,
  type CameraScanAction,
  type ScanStatus,
  type CameraFacing,
  type QualityHint,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/cameraScanState";

export {
  createRppgScanTool,
  createLabExtractMarkersTool,
  createSymptomCollectTool,
  createVoiceSummarizeTool,
  createGeneratePlanTool,
  createRecordSaveTool,
  createSyncQueueTool,
};

/**
 * Build a runtime pre-loaded with the Swasthyak health tools. The rPPG engine is
 * injected because it is environment-specific: only browser code can supply a
 * `SignalRppgEngine` bound to a live camera frame provider, so the `health.
 * vitals.rppg_scan` tool is registered ONLY when an engine is passed. There is
 * no default engine — a real scan always reads the camera.
 */
export function createUnoOneHealthRuntime(
  engine?: RppgEngine,
): UnoOneHealthRuntime {
  const runtime = UnoOneHealthRuntime.create();
  if (engine) {
    runtime.register(createRppgScanTool(engine));
  }
  runtime.register(createLabExtractMarkersTool());
  runtime.register(createSymptomCollectTool());
  runtime.register(createVoiceSummarizeTool());
  runtime.register(createGeneratePlanTool());
  runtime.register(createRecordSaveTool());
  runtime.register(createSyncQueueTool());
  return runtime;
}