/**
 * Отправляет на FBS-склад Ozon остаток всех готовых изделий из таблицы
 * products и скрывает их с витрины Ozon. Дальше остаток уходит в Ozon сам
 * при каждой правке в админке; скрипт нужен для первичной синхронизации
 * или после ручных правок в базе.
 *
 *   bun --env-file=../../.env scripts/push-ozon-stock.ts
 */
import { pushStockToOzon } from "@/lib/ozon/stock-push";

const result = await pushStockToOzon();
console.log(`Остаток принят Ozon: ${result.updated.join(", ") || "—"}`);
console.log(`Скрыто с витрины Ozon (SKU): ${result.hidden.join(", ") || "—"}`);
for (const { offerId, error } of result.failed) {
  console.error(`Не обновлено ${offerId}: ${error}`);
}
process.exit(result.failed.length > 0 ? 1 : 0);
