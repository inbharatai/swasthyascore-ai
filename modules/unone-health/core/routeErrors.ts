/**
 * Shared API error helper. Route handlers must not forward internal error
 * messages (SDK bodies, model names, rate-limit details, malformed-data-URL
 * internals) to the patient-facing client. Log the real error server-side and
 * return a generic, safe message instead.
 */
export function serverError(logLabel: string, error: unknown, fallback: string): Error {
  console.error(`[unone-health] ${logLabel}:`, error);
  return new Error(fallback);
}