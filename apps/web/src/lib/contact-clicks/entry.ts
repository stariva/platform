import type { SessionEntry } from "@stariva/db/schema";
import { analyticsPath } from "@/lib/analytics";
import { UTM_KEYS } from "@/lib/campaign-attribution";

const ENTRY_KEY = "stariva:entry";
const CLICK_IDS = ["yclid", "rb_clickid"] as const;

/** Если sessionStorage недоступен, заход живёт до перезагрузки страницы. */
let memoryEntry: SessionEntry | undefined;

const param = (url: URL, key: string, max: number) =>
  url.searchParams
    .get(key)
    ?.replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, max) || undefined;

/**
 * Заход по адресу страницы и document.referrer. fresh — это новый заход
 * (ссылка с метками или переход с другого сайта), а не переход по сайту
 * или перезагрузка: тогда он заменяет запомненный.
 */
export function entryFromLocation(
  url: URL,
  referrer: string,
  now = new Date(),
): { entry: SessionEntry; fresh: boolean } {
  const entry: SessionEntry = {
    landing: analyticsPath(url.pathname).slice(0, 200),
    at: now.toISOString(),
  };
  let tagged = false;
  for (const key of [...UTM_KEYS, ...CLICK_IDS]) {
    const value = param(url, key, 120);
    if (value) {
      entry[key] = value;
      tagged = true;
    }
  }
  let external = false;
  try {
    const host = referrer ? new URL(referrer).hostname : "";
    if (host && host !== url.hostname) {
      entry.referrer = host.slice(0, 100);
      external = true;
    }
  } catch {
    /* Битый referrer — просто без него. */
  }
  return { entry, fresh: tagged || external };
}

function readEntry(): SessionEntry | undefined {
  try {
    const stored = window.sessionStorage.getItem(ENTRY_KEY);
    return stored ? (JSON.parse(stored) as SessionEntry) : memoryEntry;
  } catch {
    return memoryEntry;
  }
}

/**
 * Запоминает, откуда начался заход в этой вкладке. Вызывается при загрузке
 * страницы; переходы по сайту и перезагрузки заход не перетирают.
 */
export function rememberEntry() {
  try {
    const { entry, fresh } = entryFromLocation(
      new URL(window.location.href),
      document.referrer,
    );
    if (!fresh && readEntry()) return;
    memoryEntry = entry;
    window.sessionStorage.setItem(ENTRY_KEY, JSON.stringify(entry));
  } catch {
    /* optional */
  }
}

/** Заход этой вкладки для журнала переходов в мессенджеры. */
export function currentEntry(): SessionEntry | undefined {
  return readEntry();
}
