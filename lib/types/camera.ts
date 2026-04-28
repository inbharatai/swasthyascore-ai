export type CameraConfidence = "low" | "medium" | "high";

export type ReferenceObjectType =
  | "none"
  | "a4_sheet"
  | "qr_marker"
  | "one_meter_strip"
  | "known_object"
  | "manual_reference";

export type VisualBodyRiskCategory =
  | "possible_undernutrition_risk"
  | "possible_normal_body_size"
  | "possible_overweight_risk"
  | "possible_central_obesity_risk"
  | "unclear_manual_needed";

export type VisibleConcernCategory =
  | "visible_wound_or_ulcer"
  | "foot_wound_concern"
  | "visible_leg_or_foot_swelling"
  | "severe_undernutrition_appearance"
  | "mobility_or_posture_concern"
  | "possible_dark_neck_patch"
  | "unclear";

export interface CameraPermissionState {
  supported: boolean;
  active: boolean;
  error: string | null;
}

export interface PoseLandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseAnalysisResult {
  landmarks: PoseLandmarkPoint[];
  fullBodyVisible: boolean;
  confidence: CameraConfidence;
  warnings: string[];
}

export interface HeightEstimateInput {
  referenceType: ReferenceObjectType;
  referenceHeightCm: number | null;
  referencePixelHeight: number | null;
  bodyPixelHeight: number | null;
  poseConfidence: CameraConfidence;
}

export interface HeightEstimateResult {
  estimatedHeightCm: number | null;
  confidence: CameraConfidence;
  warnings: string[];
  requiresManualConfirmation: true;
}

export interface BodyRiskEstimateInput {
  fullBodyVisible: boolean;
  shoulderWidthPx: number | null;
  hipWidthPx: number | null;
  waistWidthPx: number | null;
  poseConfidence: CameraConfidence;
}

export interface BodyRiskEstimateResult {
  category: VisualBodyRiskCategory;
  confidence: CameraConfidence;
  warnings: string[];
  requiresManualConfirmation: true;
}

export interface VisibleRiskRuleInput {
  fullBodyVisible: boolean;
  hasFootImage: boolean;
  hasWalkingVideo: boolean;
  userReportedVisibleConcern: boolean;
  cameraAvailable: boolean;
}

export interface VisibleRiskRuleResult {
  category: VisibleConcernCategory;
  confidence: CameraConfidence;
  warnings: string[];
  recommendedActionKeys: string[];
  notDiagnosis: true;
}

export interface AiVisibleConcernResult {
  summary: string;
  visibleConcerns: string[];
  confidence: CameraConfidence;
  recommendedAction: string[];
  safetyDisclaimer: string;
  notDiagnosis: true;
}
