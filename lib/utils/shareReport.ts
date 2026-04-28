export function buildWhatsAppShareUrl(reportText: string): string {
  const safeText = reportText.slice(0, 2000);
  return `https://wa.me/?text=${encodeURIComponent(safeText)}`;
}

export function buildEmailShareUrl(reportText: string, subject: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    reportText,
  )}`;
}

export function shareViaWhatsApp(reportText: string): string {
  const url = buildWhatsAppShareUrl(reportText);

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return url;
}

export function shareViaEmail(reportText: string, subject: string): string {
  const url = buildEmailShareUrl(reportText, subject);

  if (typeof window !== "undefined") {
    window.location.href = url;
  }

  return url;
}

export async function shareNative(reportText: string, title: string): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function"
  ) {
    return false;
  }

  try {
    await navigator.share({
      title,
      text: reportText,
    });
    return true;
  } catch {
    return false;
  }
}

export async function copyReport(reportText: string): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(reportText);
    return true;
  } catch {
    return false;
  }
}
