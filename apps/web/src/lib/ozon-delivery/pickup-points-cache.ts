import { listPickupPoints } from "./client";
import type { PickupPoint } from "./types";

const TTL_MS = 10 * 60 * 1000;

let cache: { points: PickupPoint[]; expiresAt: number } | null = null;
let pending: Promise<PickupPoint[]> | null = null;

/**
 * Ozon отдаёт пункты выдачи по всей стране одним запросом без фильтров —
 * кэшируем результат в памяти процесса, чтобы список городов и повторный
 * выбор города не дёргали Ozon заново на каждый чекаут.
 */
export async function getCachedPickupPoints(): Promise<PickupPoint[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.points;
  if (!pending) {
    pending = listPickupPoints()
      .then((points) => {
        cache = { points, expiresAt: Date.now() + TTL_MS };
        return points;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
