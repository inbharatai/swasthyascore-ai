import { describe, expect, it } from "vitest";
import {
  buildEmailShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/utils/shareReport";

describe("report sharing utilities", () => {
  it("builds a WhatsApp share link without sending automatically", () => {
    const text = "SwasthyaScore AI\nOverall Risk: High & review advised";

    expect(buildWhatsAppShareUrl(text)).toBe(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
    );
  });

  it("keeps WhatsApp report text within the RHCF-style mobile share limit", () => {
    const text = "x".repeat(2100);

    expect(buildWhatsAppShareUrl(text)).toBe(
      `https://wa.me/?text=${encodeURIComponent(text.slice(0, 2000))}`,
    );
  });

  it("builds a mailto link with encoded subject and report body", () => {
    const subject = "SwasthyaScore AI screening report";
    const text = "Patient report: doctor confirmation required";

    expect(buildEmailShareUrl(text, subject)).toBe(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        text,
      )}`,
    );
  });
});
