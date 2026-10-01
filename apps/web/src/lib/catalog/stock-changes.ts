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
