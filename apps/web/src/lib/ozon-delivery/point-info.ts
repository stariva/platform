import { z } from "zod";
import type { PickupPoint, PickupPointDay } from "./types";

// Ozon помечает все поля point/info как необязательные, а на реальных
// данных часть из них приходит пустыми строками или нулями — схема
// намеренно мягкая, чтобы один кривой пункт не ронял весь ответ.
const timeSchema = z.object({
  hours: z.number().int().min(0).max(24).optional(),
  minutes: z.number().int().min(0).max(59).optional(),
});

export const pointInfoSchema = z.object({
  enabled: z.boolean().optional(),
  delivery_method: z.object({
    map_point_id: z.coerce.number().int().positive(),
    address: z.string().optional(),
    address_details: z
      .object({
        city: z.string().optional(),
        house: z.string().optional(),
        region: z.string().optional(),
        street: z.string().optional(),
      })
      .optional(),
    coordinates: z.object({ lat: z.number(), long: z.number() }).optional(),
    delivery_type: z
      .object({ id: z.number().optional(), name: z.string().optional() })
      .optional(),
    description: z.string().optional(),
    holidays: z
      .array(z.object({ begin: z.string(), end: z.string() }))
      .optional(),
    images: z.array(z.string()).optional(),
    name: z.string().optional(),
    pvz_rating: z.number().optional(),
    storage_period: z.number().optional(),
    working_hours: z
      .array(
        z.object({
          date: z.string(),
          periods: z
            .array(z.object({ min: timeSchema, max: timeSchema }))
            .optional(),
        }),
      )
      .optional(),
  }),
});

export type OzonPointInfo = z.infer<typeof pointInfoSchema>;

/**
 * Ozon передаёт дни расписания как момент в UTC, соответствующий полуночи
 * по местному времени пункта. Вся Россия восточнее UTC (UTC+2…UTC+12),
 * поэтому местная полночь попадает либо ровно в 00:00Z того же дня, либо
 * во вторую половину предыдущих суток по UTC — во втором случае берём
 * следующую дату. Так дата не «съезжает» на день назад для Москвы
 * (21:00Z) или Владивостока (14:00Z).
 */
export function localDateOf(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCHours() >= 12) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatTime(time: { hours?: number; minutes?: number }): string {
  const hours = String(time.hours ?? 0).padStart(2, "0");
  const minutes = String(time.minutes ?? 0).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Главная строка адреса — «улица, дом». Если Ozon не разложил адрес на
 * части, отрезаем из полной строки страну, регион и город, которые и так
 * видны покупателю в выбранной локации.
 */
function addressTitle(
  address: string,
  details: OzonPointInfo["delivery_method"]["address_details"],
): string {
  const street = clean(details?.street);
  const house = clean(details?.house);
  if (street && house) return `${street}, ${house}`;
  if (street) return street;

  const skip = new Set(
    ["Россия", details?.region, details?.city]
      .map((part) => clean(part)?.toLowerCase())
      .filter(Boolean),
  );
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const rest = parts.filter((part) => !skip.has(part.toLowerCase()));
  // Индекс в начале адреса покупателю не нужен
  if (rest[0] && /^\d{6}$/.test(rest[0])) rest.shift();
  return rest.length > 0 ? rest.join(", ") : address;
}

export function normalizePointInfo(
  info: OzonPointInfo,
  fallback?: { latitude: number; longitude: number },
): PickupPoint | null {
  const point = info.delivery_method;
  const latitude = point.coordinates?.lat ?? fallback?.latitude;
  const longitude = point.coordinates?.long ?? fallback?.longitude;
  if (latitude === undefined || longitude === undefined) return null;

  const address =
    clean(point.address) ??
    [point.address_details?.city, point.address_details?.street]
      .map(clean)
      .filter(Boolean)
      .join(", ");
  if (!address) return null;

  const typeName = `${point.delivery_type?.name ?? ""} ${point.name ?? ""}`;
  const schedule: PickupPointDay[] = [];
  for (const day of point.working_hours ?? []) {
    const date = localDateOf(day.date);
    if (!date) continue;
    schedule.push({
      date,
      periods: (day.periods ?? []).map((period) => ({
        open: formatTime(period.min),
        close: formatTime(period.max),
      })),
    });
  }
  schedule.sort((a, b) => a.date.localeCompare(b.date));

  const holidays: PickupPoint["holidays"] = [];
  for (const holiday of point.holidays ?? []) {
    const from = localDateOf(holiday.begin);
    const to = localDateOf(holiday.end);
    if (from && to) holidays.push({ from, to });
  }

  const imageUrl = point.images?.find((url) => /^https:\/\//.test(url));
  return {
    id: String(point.map_point_id),
    latitude,
    longitude,
    kind: /постамат/i.test(typeName) ? "postamat" : "pvz",
    title: addressTitle(address, point.address_details),
    locality: clean(point.address_details?.city),
    address,
    description: clean(point.description),
    schedule,
    holidays,
    rating:
      point.pvz_rating && point.pvz_rating > 0 && point.pvz_rating <= 5
        ? point.pvz_rating
        : undefined,
    storageDays:
      point.storage_period &&
      point.storage_period > 0 &&
      point.storage_period <= 60
        ? point.storage_period
        : undefined,
    imageUrl,
  };
}
