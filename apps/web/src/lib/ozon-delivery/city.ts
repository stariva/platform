import type { PickupPoint } from "./types";

const OTHER_CITY = "Другое";

const CITY_PREFIX_RE = /^г\.?\s+(.+)$/i;

/**
 * Ozon не отдаёт город отдельным полем — вытаскиваем его из строки адреса.
 * Либо сегмент вида "г. Москва", либо (частый формат Ozon) город идёт
 * первым сегментом без префикса.
 */
export function extractCity(address: string): string {
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const match = segment.match(CITY_PREFIX_RE);
    if (match?.[1]) return match[1].trim();
  }

  return segments[0] ?? OTHER_CITY;
}

export function groupPickupPointsByCity(
  points: PickupPoint[],
): Map<string, PickupPoint[]> {
  const byCity = new Map<string, PickupPoint[]>();
  for (const point of points) {
    const city = extractCity(point.address);
    const existing = byCity.get(city);
    if (existing) {
      existing.push(point);
    } else {
      byCity.set(city, [point]);
    }
  }
  return byCity;
}

export function sortCities(cities: string[]): string[] {
  return [...cities].sort((a, b) => {
    if (a === OTHER_CITY) return 1;
    if (b === OTHER_CITY) return -1;
    return a.localeCompare(b, "ru");
  });
}
