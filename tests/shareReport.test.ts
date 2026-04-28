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
