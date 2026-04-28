import type { UserRole } from "@/lib/types/health";

export interface AuthSessionPlaceholder {
  userId: string | null;
  displayName: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  provider: "local_device" | "supabase" | "authjs";
}

export async function getAuthSessionPlaceholder(): Promise<AuthSessionPlaceholder> {
  return {
    userId: null,
    displayName: null,
    role: null,
    isAuthenticated: false,
    provider: "supabase",
  };
}

export const futureAuthNotes = [
  "Replace the localStorage session gate with Supabase Auth or Auth.js when cloud accounts are needed.",
  "Keep UserRole values aligned with row-level security policies.",
  "Do not move patient records to cloud storage until consent, retention, and clinic workflows are defined.",
] as const;
