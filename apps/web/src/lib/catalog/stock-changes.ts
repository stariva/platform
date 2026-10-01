export interface StockRow {
  id: string;
  ozonProductId: number | null;
  ozonSku: number | null;
  stockAvailable: number;
}

/**
 * Новые остатки для изменившихся товаров. Товар без SKU не продаётся Ozon
 * Доставкой — у него всегда 0; товара нет в ответе Ozon (архив) — тоже 0.
 */
export function stockChanges(
  rows: StockRow[],
  stocks: Map<number, number>,
): { id: string; stockAvailable: number }[] {
  return rows.flatMap((row) => {
    const next =
      row.ozonSku === null || row.ozonProductId === null
        ? 0
        : (stocks.get(row.ozonProductId) ?? 0);
    return next === row.stockAvailable
      ? []
      : [{ id: row.id, stockAvailable: next }];
  });
}

/**
 * Свободный остаток для продажи с сайта: только склад FBS (наш, дома).
 * FBO и rFBS — другие схемы, Ozon Доставка по нашему fbs_sku с них не возит.
 */
export function freeFbsStock(
  stocks: { type: string; present: number; reserved: number }[],
): number {
  return stocks
    .filter((stock) => stock.type === "fbs")
    .reduce(
      (sum, stock) => sum + Math.max(0, stock.present - stock.reserved),
      0,
    );
}
