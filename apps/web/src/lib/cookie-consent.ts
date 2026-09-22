/**
 * Согласие на аналитические cookie (Яндекс.Метрика).
 * Без явного согласия счётчик не загружается: данные Метрики — это ПДн.
 */
const STORAGE_KEY = "stariva:cookie-consent";
export const COOKIE_CONSENT_EVENT = "stariva:cookie-consent";
export const COOKIE_SETTINGS_EVENT = "stariva:cookie-settings";

export type CookieChoice = "granted" | "denied";

let memoryChoice: CookieChoice | null = null;

export function getCookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "granted" || raw === "denied") return raw;
  } catch {
    /* storage blocked — fall back to memory */
  }
  return memoryChoice;
}

export function hasAnalyticsConsent(): boolean {
  return getCookieChoice() === "granted";
}

export function setCookieChoice(choice: CookieChoice) {
  memoryChoice = choice;
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* memory fallback */
  }
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: choice }),
  );
}

/** Открыть баннер повторно (ссылка «Настройки cookie» в подвале). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
