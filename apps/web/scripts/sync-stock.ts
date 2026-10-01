/**
 * Разовая сверка остатков с FBS-складом Ozon (на сайте она идёт сама раз в
 * 10 минут, пока его открывают).
 *
 *   bun --env-file=../../.env scripts/sync-stock.ts
 */
import { syncStockFromOzon } from "@/lib/catalog/stock-sync";

const result = await syncStockFromOzon();
if (!result) {
  console.error("Ozon недоступен или не заданы OZON_CLIENT_ID / OZON_API_KEY.");
  process.exit(1);
}
console.log(`Остатки сверены, изменилось товаров: ${result.changed}.`);
process.exit(0);
