/**
 * LocalMemory — a tiny localStorage wrapper used by the offline-first skills.
 *
 * Browser-only: every call is guarded so the same code can be imported in Node
 * (server routes, vitest node env) without throwing. Reads/writes are
 * JSON-serialised and namespaced per patient so multiple profiles never clash.
 */
const NAMESPACE = "unone-health";

export class LocalMemory {
  static isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.localStorage;
  }

  static read<T>(patientId: string, key: string, fallback: T): T {
    if (!this.isAvailable()) return fallback;
    try {
      const raw = window.localStorage.getItem(this.fullKey(patientId, key));
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  static write<T>(patientId: string, key: string, value: T): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.setItem(
        this.fullKey(patientId, key),
        JSON.stringify(value),
      );
    } catch {
      // Storage full or blocked — silently degrade. Events remain in memory
      // for the current session and are re-queued next time.
    }
  }

  static remove(patientId: string, key: string): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.removeItem(this.fullKey(patientId, key));
    } catch {
      // ignore
    }
  }

  private static fullKey(patientId: string, key: string): string {
    return `${NAMESPACE}:${patientId}:${key}`;
  }
}

/**
 * In-memory implementation used by the server (route handlers have no
 * localStorage) and by tests.
 */
export class InMemoryStore<T> {
  private readonly map = new Map<string, T>();

  get(key: string): T | undefined {
    return this.map.get(key);
  }

  set(key: string, value: T): void {
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  values(): T[] {
    return [...this.map.values()];
  }

  clear(): void {
    this.map.clear();
  }
}