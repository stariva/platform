/**
 * Чинит материал, цвет и уход, в которые при импорте попал текст описания
 * товара (старая эвристика брала любой атрибут Ozon со словом «хлопок»).
 *
 *   bun --env-file=../../.env scripts/clean-product-attributes.ts          — показать изменения
 *   bun --env-file=../../.env scripts/clean-product-attributes.ts --apply  — записать
 *
 * Трогает только поля длиннее лимитов формы админки; новое значение берёт
 * из атрибутов Ozon по исправленной эвристике, иначе — пусто.
 */
import { and, db, eq, isNotNull, sql } from "@stariva/db";
import { products } from "@stariva/db/schema";
import { fetchOzonCatalog } from "@/lib/ozon/api-client";

const apply = process.argv.includes("--apply");
const LIMITS = { material: 300, color: 300, careInstructions: 1000 } as const;
type Field = keyof typeof LIMITS;

const catalog = await fetchOzonCatalog();
if (!catalog) {
  console.error("Не удалось получить каталог Ozon.");
  process.exit(1);
}
const attrsById = new Map(catalog.map(({ info, attrs }) => [info.id, attrs]));

const rows = await db
  .select({
    id: products.id,
    offerId: products.ozonOfferId,
    ozonProductId: products.ozonProductId,
    material: products.material,
    color: products.color,
    careInstructions: products.careInstructions,
  })
  .from(products)
  .where(isNotNull(products.ozonProductId));

let changed = 0;
for (const row of rows) {
  const attrs = attrsById.get(row.ozonProductId as number);
  const updates: Partial<Record<Field, string | null>> = {};
  for (const field of Object.keys(LIMITS) as Field[]) {
    const current = row[field];
    if (current === null || current.length <= LIMITS[field]) continue;
    const fresh = attrs?.[field];
    updates[field] = fresh && fresh.length <= LIMITS[field] ? fresh : null;
  }
  if (Object.keys(updates).length === 0) continue;

  changed++;
  console.log(
    `${row.offerId}: ${Object.entries(updates)
      .map(([field, value]) => `${field} → ${JSON.stringify(value)}`)
      .join(", ")}`,
  );
  if (apply) {
    await db
      .update(products)
      .set(updates)
      .where(
        and(
          eq(products.id, row.id),
          // Не перезаписываем поле, если его успели поправить в админке
          ...(Object.keys(updates) as Field[]).map(
            (field) => sql`length(${products[field]}) > ${LIMITS[field]}`,
          ),
        ),
      );
  }
}

console.log(`Товаров с испорченными полями: ${changed} из ${rows.length}.`);
if (!apply)
  console.log(
    "Пробный запуск — база не изменена. Для записи добавьте --apply.",
  );
process.exit(0);
