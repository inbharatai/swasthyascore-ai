import type { UserRole } from "@/lib/types/health";

export interface AuthSessionPlaceholder {
  userId: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
}

export async function getAuthSessionPlaceholder(): Promise<AuthSessionPlaceholder> {
  return {
    userId: null,
    role: null,
    isAuthenticated: false,
  };
}
