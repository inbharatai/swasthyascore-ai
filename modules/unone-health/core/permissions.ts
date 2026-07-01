import type { ToolPermission } from "./types";

/**
 * PermissionManager gates every tool that needs consent or device access.
 *
 * Consent is explicit and per-purpose: lab report processing, camera scan and
 * voice capture each require a separate opt-in. No permission is ever implied.
 */
export class PermissionManager {
  private readonly consent: Record<ToolPermission, boolean> = {
    camera: false,
    microphone: false,
    file_upload: false,
    lab_consent: false,
    voice_consent: false,
    network: true,
  };

  grant(permission: ToolPermission): void {
    this.consent[permission] = true;
  }

  revoke(permission: ToolPermission): void {
    this.consent[permission] = false;
  }

  has(permission: ToolPermission): boolean {
    return this.consent[permission] === true;
  }

  hasAll(permissions: ToolPermission[]): boolean {
    return permissions.every((permission) => this.has(permission));
  }

  require(permissions: ToolPermission[]): void {
    const missing = permissions.filter((permission) => !this.has(permission));
    if (missing.length > 0) {
      throw new PermissionDeniedError(missing);
    }
  }

  snapshot(): Record<ToolPermission, boolean> {
    return { ...this.consent };
  }
}

export class PermissionDeniedError extends Error {
  readonly missing: ToolPermission[];
  constructor(missing: ToolPermission[]) {
    super(`Missing required permissions: ${missing.join(", ")}`);
    this.name = "PermissionDeniedError";
    this.missing = missing;
  }
}