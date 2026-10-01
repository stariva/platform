/**
 * Разовый перенос каталога из Ozon в таблицу products.
 *
 *   bun --env-file=../../.env scripts/import-ozon-products.ts          — показать, что будет записано
 *   bun --env-file=../../.env scripts/import-ozon-products.ts --apply  — записать в базу
 *
 * Уже перенесённые товары (совпадение по ozon_product_id, slug или SKU) не
 * трогает, поэтому повторный запуск не затрёт правки из админки.
 */
import { db } from "@stariva/db/client";
import { products } from "@stariva/db/schema";
import { fetchOzonCatalog } from "@/lib/ozon/api-client";
import { dropDuplicateSlugs, ozonItemToProductRow } from "@/lib/ozon/import";

const apply = process.argv.includes("--apply");

const catalog = await fetchOzonCatalog();
if (catalog === null) {
  console.error(
    "Не удалось получить каталог Ozon: проверьте OZON_CLIENT_ID и OZON_API_KEY.",
  );
  process.exit(1);
}

const now = new Date();
const results = dropDuplicateSlugs(
  catalog.map((item, index) => ozonItemToProductRow(item, index * 10, now)),
);
const rows = results.flatMap((result) => (result.ok ? [result.row] : []));
const skipped = results.flatMap((result) => (result.ok ? [] : [result]));

console.table(
  rows.map((row) => ({
    offerId: row.ozonOfferId,
    slug: row.slug,
    category: `${row.category}/${row.subcategory}`,
    price: (row.price as number) / 100,
    stock: row.stockAvailable,
    sku: row.ozonSku,
    images: row.images?.length ?? 0,
  })),
);
console.log(
  `Товаров в Ozon: ${catalog.length}, к записи: ${rows.length}, ` +
    `в наличии: ${rows.filter((row) => (row.stockAvailable ?? 0) > 0).length}`,
);
for (const skip of skipped) {
  console.warn(
    `Пропущен ${skip.offerId} (${skip.ozonProductId}): ${skip.reason}`,
  );
}

if (!apply) {
  console.log(
    "Пробный запуск — база не изменена. Для записи добавьте --apply.",
  );
  process.exit(0);
}

const inserted =
  rows.length === 0
    ? []
    : await db
        .insert(products)
        .values(rows)
        .onConflictDoNothing()
        .returning({ ozonProductId: products.ozonProductId });

const insertedIds = new Set(inserted.map((row) => row.ozonProductId));
for (const row of rows) {
  if (!insertedIds.has(row.ozonProductId ?? null)) {
    console.log(`Уже в базе, не тронут: ${row.ozonOfferId} (${row.slug})`);
  }
}
console.log(`Записано товаров: ${inserted.length} из ${rows.length}.`);
process.exit(0);
