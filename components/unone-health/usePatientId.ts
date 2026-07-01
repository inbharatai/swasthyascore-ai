"use client";

import { useState } from "react";
import { uuid } from "@/lib/unone-health";

const patientIdKey = "unone-health-patient-id";

/**
 * Stable per-device patient id for the UnoOne Health module. The app currently
 * runs in local mode, so we persist a single id in localStorage; when real
 * Swasthyak auth lands, this is replaced by the authenticated patient id.
 *
 * Computed via a lazy initializer so there is no setState-in-effect and the
 * id is stable across renders.
 */
function readOrCreatePatientId(): string {
  try {
    const existing = window.localStorage.getItem(patientIdKey);
    if (existing) return existing;
    const id = uuid();
    window.localStorage.setItem(patientIdKey, id);
    return id;
  } catch {
    return "local";
  }
}

export function usePatientId(): string {
  const [patientId] = useState<string>(readOrCreatePatientId);
  return patientId;
}