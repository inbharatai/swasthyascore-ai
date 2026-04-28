import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";

describe("translation coverage", () => {
  it("keeps English and Hindi dictionaries aligned", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it("has non-empty translations for every key", () => {
    for (const key of Object.keys(en)) {
      expect(en[key as keyof typeof en].trim().length).toBeGreaterThan(0);
      expect(hi[key as keyof typeof hi].trim().length).toBeGreaterThan(0);
    }
  });
});
