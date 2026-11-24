/** Форматирует секунды в «м:сс». */
export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Человекочитаемое название устройства. */
export function deviceLabel(device: string | null | undefined) {
  if (!device) return "—";
  const map: Record<string, string> = {
    desktop: "Компьютер",
    mobile: "Телефон",
    tablet: "Планшет",
    tv: "ТВ",
  };
  return map[device.toLowerCase()] ?? device;
}

/** Обрезает длинный URL для таблицы. */
export function truncateUrl(url: string | null | undefined, max = 60) {
  if (!url) return "—";
  return url.length > max ? `${url.slice(0, max)}…` : url;
}
