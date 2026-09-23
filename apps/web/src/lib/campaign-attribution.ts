import { hasAnalyticsConsent } from "./cookie-consent";
import { ATTRIBUTION_KEYS } from "./custom-order/schema";

const STORAGE_KEY = "stariva:campaign";
export function parseCampaign(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const url = new URL(value);
    for (const key of ATTRIBUTION_KEYS) {
      const entry = url.searchParams.get(key)?.trim().slice(0, 120);
      if (entry) result[key] = entry;
    }
  } catch {
    /* Invalid URLs carry no campaign. */
  }
  return result;
}

export function captureCampaign() {
  if (typeof window === "undefined") return;
  try {
    if (!hasAnalyticsConsent()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const campaign = parseCampaign(window.location.href);
    if (Object.keys(campaign).length)
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
  } catch {
    /* Storage may be disabled in an in-app browser. */
  }
}

export function getCampaign(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const current = parseCampaign(window.location.href);
  if (Object.keys(current).length) return current;
  if (hasAnalyticsConsent()) {
    try {
      const stored = JSON.parse(
        window.sessionStorage.getItem(STORAGE_KEY) ?? "{}",
      );
      // Revalidate the allowlist even for browser storage; never include form data.
      return Object.fromEntries(
        ATTRIBUTION_KEYS.flatMap((key) =>
          typeof stored?.[key] === "string"
            ? [[key, stored[key].slice(0, 120)]]
            : [],
        ),
      );
    } catch {
      /* No attribution is preferable to failing the order. */
    }
  }
  return {};
}

export function appendCampaign(form: FormData) {
  const campaign = getCampaign();
  if (Object.keys(campaign).length)
    form.append("attribution", JSON.stringify(campaign));
}
