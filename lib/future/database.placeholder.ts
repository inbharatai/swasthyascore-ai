import type {
  LabReport,
  PatientProfile,
  ReferralNoteRecord,
  ScreeningRecord,
} from "@/lib/types/health";

export interface ScreeningRepository {
  savePatientProfile(profile: PatientProfile): Promise<void>;
  saveScreeningRecord(record: ScreeningRecord): Promise<void>;
  saveLabReport(report: LabReport): Promise<void>;
  saveReferralNote(note: ReferralNoteRecord): Promise<void>;
}

export class DatabasePlaceholderRepository implements ScreeningRepository {
  async savePatientProfile(profile: PatientProfile): Promise<void> {
    void profile;
    throw new Error("Database not connected in MVP mode.");
  }

  async saveScreeningRecord(record: ScreeningRecord): Promise<void> {
    void record;
    throw new Error("Database not connected in MVP mode.");
  }

  async saveLabReport(report: LabReport): Promise<void> {
    void report;
    throw new Error("Database not connected in MVP mode.");
  }

  async saveReferralNote(note: ReferralNoteRecord): Promise<void> {
    void note;
    throw new Error("Database not connected in MVP mode.");
  }
}
