"use client";

import type {
  HealthEvent,
  LabReportEvent,
  SymptomEvent,
  VitalScanResult,
  HealthAdvisory,
} from "@/modules/unone-health/core/types";

/**
 * SwasthyakAdapter — the single client-side boundary to the Swasthyak Cloud
 * backend (/api/v1). App code talks to the UnoOne Health module; the module
 * talks to this adapter; this adapter performs the real HTTP. Swapping in a
 * different backend later means replacing only this file.
 *
 * All POSTs send JSON except lab upload, which sends multipart/form-data.
 */
export interface SwasthyakAdapterOptions {
  baseUrl?: string;
}

export class SwasthyakAdapter {
  constructor(private readonly options: SwasthyakAdapterOptions = {}) {}

  private get base(): string {
    return this.options.baseUrl ?? "";
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.parse<T>(response);
  }

  private async parse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : (undefined as T);
    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  }

  saveHealthEvent(event: HealthEvent): Promise<{ event_id: string }> {
    return this.postJson("/api/v1/health-events", event);
  }

  submitVitalScan(result: VitalScanResult, patientId: string) {
    return this.postJson<{ event_id: string }>("/api/v1/vital-scan", {
      patient_id: patientId,
      result,
    });
  }

  submitSymptoms(event: SymptomEvent, patientId: string) {
    return this.postJson<{ event_id: string }>("/api/v1/symptoms", {
      patient_id: patientId,
      event,
    });
  }

  collectSymptoms(input: {
    patientId: string;
    text: string;
    source?: "text" | "voice";
    duration?: string | null;
  }): Promise<{ event_id: string; event: SymptomEvent }> {
    return this.postJson("/api/v1/symptoms", {
      patient_id: input.patientId,
      text: input.text,
      source: input.source ?? "text",
      duration: input.duration ?? null,
    });
  }

  generateAdvisory(input: {
    patient_id: string;
    profile: unknown;
    lab_report?: unknown;
    vitals?: unknown;
    symptoms?: unknown;
    previous_events?: unknown;
    consent_given: boolean;
  }): Promise<HealthAdvisory> {
    return this.postJson<HealthAdvisory>("/api/v1/health-advisory", input);
  }

  getTimeline(patientId: string): Promise<HealthEvent[]> {
    return fetch(`${this.base}/api/v1/patient/${encodeURIComponent(patientId)}/timeline`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    }).then((response) => this.parse<HealthEvent[]>(response));
  }

  /** Upload a lab report file (multipart). Returns a stored report id. */
  async uploadLabReport(input: {
    file: File | Blob;
    filename: string;
    mimeType: string;
    patientId: string;
    consentGiven: boolean;
  }): Promise<{ report_id: string }> {
    const form = new FormData();
    form.append("file", input.file, input.filename);
    form.append("patient_id", input.patientId);
    form.append("consent_given", String(input.consentGiven));
    const response = await fetch(`${this.base}/api/v1/lab-reports/upload`, {
      method: "POST",
      body: form,
    });
    return this.parse<{ report_id: string }>(response);
  }

  /** Analyze a previously uploaded report (by id) — or inline if id omitted. */
  async analyzeLabReport(input: {
    reportId?: string;
    patientId: string;
    mimeType?: string;
    base64DataUrl?: string;
    filename?: string;
    consentGiven: boolean;
  }): Promise<LabReportEvent> {
    // The route handler reads snake_case; every other v1 route is snake_case
    // on the wire too, so translate here at the boundary (client stays camel).
    return this.postJson<LabReportEvent>("/api/v1/lab-reports/analyze", {
      report_id: input.reportId,
      patient_id: input.patientId,
      mime_type: input.mimeType,
      base64_data_url: input.base64DataUrl,
      filename: input.filename,
      consent_given: input.consentGiven,
    });
  }
}

/** Singleton adapter bound to the default origin. */
let sharedAdapter: SwasthyakAdapter | null = null;

export function getSwasthyakAdapter(): SwasthyakAdapter {
  if (!sharedAdapter) sharedAdapter = new SwasthyakAdapter();
  return sharedAdapter;
}