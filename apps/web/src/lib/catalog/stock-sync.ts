import { logger } from "@stariva/config";
import { db, eq, isNotNull } from "@stariva/db";
import { products } from "@stariva/db/schema";
import { after } from "next/server";
import { fetchOzonStocks } from "@/lib/ozon/api-client";
import { stockChanges } from "./stock-changes";

/** Как часто сверяем остатки с Ozon (на процесс). */
export const STOCK_SYNC_INTERVAL_MS = 10 * 60 * 1000;

/** Сверяет остатки товаров с FBS-складом Ozon. null — Ozon недоступен. */
export async function syncStockFromOzon(
  now = new Date(),
): Promise<{ changed: number } | null> {
  const stocks = await fetchOzonStocks();
  if (!stocks) return null;

  const rows = await db
    .select({
      id: products.id,
      ozonProductId: products.ozonProductId,
      ozonSku: products.ozonSku,
      stockAvailable: products.stockAvailable,
    })
    .from(products)
    .where(isNotNull(products.ozonProductId));

  const changes = stockChanges(rows, stocks);
  for (const change of changes) {
    await db
      .update(products)
      .set({ stockAvailable: change.stockAvailable, stockSyncedAt: now })
      .where(eq(products.id, change.id));
  }
  await db
    .update(products)
    .set({ stockSyncedAt: now })
    .where(isNotNull(products.ozonProductId));

  if (changes.length > 0) {
    logger.info("catalog.stock.synced", { changed: changes.length });
  }
  return { changed: changes.length };
}

let lastSyncStartedAt = 0;

/**
 * Запускает сверку остатков после ответа, если с прошлой прошло больше
 * STOCK_SYNC_INTERVAL_MS. Отдельный cron не нужен: сверка идёт, пока сайт
 * кто-то открывает. При сборке не запускается.
 */
export function scheduleStockSync(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const now = Date.now();
  if (now - lastSyncStartedAt < STOCK_SYNC_INTERVAL_MS) return;
  lastSyncStartedAt = now;

  try {
    after(async () => {
      try {
        await syncStockFromOzon();
      } catch (error) {
        logger.error("catalog.stock.sync_failed", error);
      }
    });
  } catch {
    // Вне запроса (скрипты, тесты) after недоступен — просто не синхронизируем
    lastSyncStartedAt = 0;
  }
}
