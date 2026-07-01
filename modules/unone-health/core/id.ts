/**
 * Deterministic-ish ID + timestamp helpers.
 *
 * `randomUUID` is preferred when available (browser + Node 19+). The fallback
 * keeps tests and older runtimes working. Timestamps are injected via the
 * ToolContext `now()` so tests stay deterministic — production code uses the
 * default ISO setter.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  return `id-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}