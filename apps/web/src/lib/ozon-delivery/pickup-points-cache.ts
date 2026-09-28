import { getPickupPointsInfo, listPickupPoints } from "./client";
import type { PickupPoint, PickupPointLocation } from "./types";

const TTL_MS = 10 * 60 * 1000;
// Адрес и режим работы пункта меняются редко, а point/info — самый
// «дорогой» запрос чекаута: держим подробности дольше, чем список точек.
const DETAILS_TTL_MS = 60 * 60 * 1000;

interface LocationsCache {
  points: PickupPointLocation[];
  byId: Map<string, PickupPointLocation>;
  expiresAt: number;
}

let cache: LocationsCache | null = null;
let pending: Promise<LocationsCache> | null = null;

async function loadLocations(): Promise<LocationsCache> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  if (!pending) {
    pending = listPickupPoints()
      .then((points) => {
        const loaded: LocationsCache = {
          points,
          byId: new Map(points.map((point) => [point.id, point])),
          expiresAt: Date.now() + TTL_MS,
        };
        cache = loaded;
        return loaded;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Ozon отдаёт пункты выдачи по всей стране одним запросом без фильтров —
 * кэшируем результат в памяти процесса, чтобы повторный выбор адреса
 * не дёргал Ozon заново на каждый чекаут.
 */
export async function getCachedPickupPoints(): Promise<PickupPointLocation[]> {
  return (await loadLocations()).points;
}

type DetailsEntry = { point: PickupPoint | null; expiresAt: number };
const details = new Map<string, DetailsEntry>();

/**
 * Подробности пунктов с кэшем по каждому id. `null` в кэше означает,
 * что Ozon вернул пункт выключенным — повторно его не запрашиваем.
 */
export async function getCachedPickupPointsInfo(
  ids: string[],
): Promise<{ points: PickupPoint[]; unavailable: string[] }> {
  const now = Date.now();
  const missing = ids.filter((id) => {
    const entry = details.get(id);
    return !entry || entry.expiresAt <= now;
  });

  if (missing.length > 0) {
    const { byId } = await loadLocations();
    const fetched = await getPickupPointsInfo(missing, byId);
    const expiresAt = Date.now() + DETAILS_TTL_MS;
    for (const point of fetched.points) {
      details.set(point.id, { point, expiresAt });
    }
    for (const id of fetched.unavailable) {
      details.set(id, { point: null, expiresAt });
    }
  }

  const points: PickupPoint[] = [];
  const unavailable: string[] = [];
  for (const id of ids) {
    const point = details.get(id)?.point;
    if (point) points.push(point);
    else unavailable.push(id);
  }
  return { points, unavailable };
}
