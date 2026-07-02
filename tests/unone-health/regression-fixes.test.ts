import { afterEach, describe, expect, it, vi } from "vitest";
import { SwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";
import { enforceHealthAdvisorySafety } from "@/modules/unone-health/health-skills/lifestyle-plan";
import { enforceLabLensSafety } from "@/modules/unone-health/health-skills/lab-lens/LabLensAgent";
import {
  cameraScanReducer,
  initialCameraScanState,
  type CameraScanAction,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/cameraScanState";

const baseAdvisory = {
  risk_level: "consult_doctor",
  top_findings: [
    {
      title: "High HbA1c",
      why_it_matters: "may suggest risk, discuss with a doctor",
      related_markers: ["HbA1c"],
      recommended_next_step: "Discuss with a doctor",
    },
  ],
  user_message: "One marker may need a doctor's review.",
  follow_up_questions: [],
  repeat_scan_recommended: false,
  doctor_summary: "HbA1c is high; confirm with testing.",
  family_summary: "A sugar marker is a little high — please see a doctor.",
  lifestyle_plan: {
    diet: ["Reduce sugary drinks"],
    activity: ["30 min walk daily"],
    sleep: ["7-8 hours"],
    hydration: ["Drink water regularly"],
    avoid: ["Refined carbs"],
    follow_up: ["Doctor review in 2 weeks"],
  },
  safety_note: "This is AI-assisted interpretation, not a diagnosis. Consult a qualified doctor for medical decisions.",
  diagnosis_claimed: false,
  medicine_prescribed: false,
};

describe("advisory safety enforcement — array fields", () => {
  it("sanitises diagnosis/prescription wording in finding titles and lifestyle items", () => {
    const dirty = {
      ...baseAdvisory,
      top_findings: [
        {
          title: "You have hypertension",
          why_it_matters: "take 500 mg metformin twice daily",
          related_markers: [],
          recommended_next_step: "prescribe lisinopril",
        },
      ],
      lifestyle_plan: {
        ...baseAdvisory.lifestyle_plan,
        diet: ["you have diabetes, take 1000 mg metformin"],
      },
    };

    const safe = enforceHealthAdvisorySafety(dirty as never);
    expect(safe.diagnosis_claimed).toBe(false);
    expect(safe.medicine_prescribed).toBe(false);
    expect(safe.top_findings[0].title).not.toContain("You have hypertension");
    expect(safe.top_findings[0].why_it_matters).not.toContain("500 mg");
    expect(safe.top_findings[0].recommended_next_step).not.toContain("prescribe");
    expect(safe.lifestyle_plan.diet[0]).not.toContain("You have diabetes");
    expect(safe.lifestyle_plan.diet[0]).not.toContain("1000 mg");
  });

  it("leaves clean advisories unchanged", () => {
    const safe = enforceHealthAdvisorySafety(baseAdvisory as never);
    expect(safe.top_findings[0].title).toBe("High HbA1c");
    expect(safe.lifestyle_plan.diet[0]).toBe("Reduce sugary drinks");
  });
});

describe("lab lens safety enforcement", () => {
  it("sanitises diagnosis/prescription wording in marker explanations and the summary", () => {
    const dirty = {
      report_metadata: {
        patient_name: null,
        age: null,
        sex: null,
        lab_name: null,
        report_date: null,
      },
      markers: [
        {
          marker_name: "HbA1c",
          normalized_marker: "hba1c",
          value: 8.1,
          unit: "%",
          reference_range: "<5.7",
          status: "high",
          severity: "consult_doctor",
          confidence: 0.9,
          source_text: "HbA1c 8.1%",
          explanation: "You have diabetes. Take 500 mg metformin.",
        },
      ],
      critical_flags: [],
      overall_summary: "You have diabetes; prescribe metformin 500mg daily.",
      confidence: 0.9,
    } as never;

    const safe = enforceLabLensSafety(dirty);
    expect(safe.markers[0].explanation).not.toContain("You have diabetes");
    expect(safe.markers[0].explanation).not.toContain("500 mg");
    expect(safe.overall_summary).not.toContain("You have diabetes");
    expect(safe.overall_summary).not.toContain("prescribe");
  });
});

describe("SwasthyakAdapter.analyzeLabReport wire format", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends snake_case keys to /api/v1/lab-reports/analyze (route reads snake_case)", async () => {
    let captured: unknown = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ event_id: "ev-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const adapter = new SwasthyakAdapter();
    await adapter.analyzeLabReport({
      reportId: "rep-1",
      patientId: "p-1",
      mimeType: "application/pdf",
      base64DataUrl: "data:application/pdf;base64,AAAA",
      filename: "lab.pdf",
      consentGiven: true,
    });

    const body = captured as Record<string, unknown>;
    expect(body).toHaveProperty("report_id", "rep-1");
    expect(body).toHaveProperty("patient_id", "p-1");
    expect(body).toHaveProperty("mime_type", "application/pdf");
    expect(body).toHaveProperty("base64_data_url");
    expect(body).toHaveProperty("consent_given", true);
    // the camelCase keys the route does NOT read must not be present
    expect(body).not.toHaveProperty("reportId");
    expect(body).not.toHaveProperty("patientId");
    expect(body).not.toHaveProperty("consentGiven");
  });
});

describe("camera scan reducer — decoupled quality hint", () => {
  function reduce(...actions: CameraScanAction[]) {
    return actions.reduce(cameraScanReducer, initialCameraScanState);
  }

  it("no_face sets qualityHint, not status, so scanning continues", () => {
    const scanning = reduce({ type: "grant_consent" }, { type: "start_scan" });
    const noFace = cameraScanReducer(scanning, { type: "no_face" });
    expect(noFace.status).toBe("scanning");
    expect(noFace.qualityHint).toBe("no_face");
  });

  it("quality_ok clears the hint and the scan stays in scanning", () => {
    const state = reduce(
      { type: "grant_consent" },
      { type: "start_scan" },
      { type: "no_face" },
    );
    expect(state.qualityHint).toBe("no_face");
    const ok = cameraScanReducer(state, { type: "quality_ok" });
    expect(ok.qualityHint).toBeNull();
    expect(ok.status).toBe("scanning");
  });

  it("switch_camera updates facing and cameraMode consistently", () => {
    const front = reduce({ type: "grant_consent" }, { type: "start_scan" });
    const switched = cameraScanReducer(front, { type: "switch_camera" });
    expect(switched.facing).toBe("environment");
    expect(switched.cameraMode).toBe("rear_finger");
    // a single switch_camera flips exactly once (the old UI double-dispatched)
    const back = cameraScanReducer(switched, { type: "switch_camera" });
    expect(back.facing).toBe("user");
    expect(back.cameraMode).toBe("front_face");
  });

  it("begin_countdown preserves facing/cameraMode (no mid-countdown metadata corruption)", () => {
    // Switch to the rear/finger scan first, then enter the countdown: the mode
    // metadata sent to Swasthyak must survive the countdown transition.
    const rear = reduce({ type: "grant_consent" }, { type: "switch_camera" });
    expect(rear.facing).toBe("environment");
    expect(rear.cameraMode).toBe("rear_finger");

    const counting = cameraScanReducer(rear, { type: "begin_countdown" });
    expect(counting.status).toBe("countdown");
    expect(counting.countdownRemaining).toBe(3);
    expect(counting.facing).toBe("environment");
    expect(counting.cameraMode).toBe("rear_finger");
  });
});