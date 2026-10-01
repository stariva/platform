/**
 * Переносит фото товаров с CDN Ozon в наш публичный бакет S3.
 *
 *   bun --env-file=../../.env scripts/migrate-product-images.ts          — скачать и проверить, ничего не записывая
 *   bun --env-file=../../.env scripts/migrate-product-images.ts --apply  — загрузить в бакет и обновить товары
 *
 * Повторный запуск безопасен: уже перенесённые фото пропускаются, а ключи
 * зависят от содержимого. Строка товара обновляется, только если её фото
 * не поменяли (например, в админке) за время переноса.
 */
import { and, db, eq, sql } from "@stariva/db";
import { products } from "@stariva/db/schema";
import {
  isPublicStorageConfigured,
  publicObjectUrl,
  uploadPublicObject,
} from "@stariva/storage";
import { isExternalImage, productImageKey } from "@/lib/catalog/product-images";

const apply = process.argv.includes("--apply");
const MAX_BYTES = 15 * 1024 * 1024;

if (!isPublicStorageConfigured()) {
  console.error(
    "Публичный бакет не настроен: нужны AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_ENDPOINT и AWS_S3_PUBLIC_BUCKET.",
  );
  process.exit(1);
}

const publicBase = publicObjectUrl("");
console.log(`Публичный адрес фото: ${publicBase}`);

async function download(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    throw new Error(`размер ${bytes.byteLength} байт для ${url}`);
  }
  return { contentType: contentType?.trim() ?? "", bytes };
}

const rows = await db
  .select({ id: products.id, slug: products.slug, images: products.images })
  .from(products);

let moved = 0;
let updated = 0;
const failed: string[] = [];

for (const row of rows) {
  if (!row.images.some((url) => isExternalImage(url, publicBase))) continue;

  try {
    const images = await Promise.all(
      row.images.map(async (url) => {
        if (!isExternalImage(url, publicBase)) return url;
        const { contentType, bytes } = await download(url);
        const key = productImageKey(row.id, bytes, contentType);
        moved++;
        return apply
          ? uploadPublicObject(key, bytes, contentType)
          : publicObjectUrl(key);
      }),
    );

    if (apply) {
      const result = await db
        .update(products)
        .set({ images })
        .where(
          and(
            eq(products.id, row.id),
            eq(products.images, sql`${row.images}::text[]`),
          ),
        )
        .returning({ id: products.id });
      if (result.length === 0) {
        throw new Error("фото товара изменились во время переноса");
      }
      updated++;
    }
    console.log(`✓ ${row.slug}: ${images.length} фото`);
  } catch (error) {
    failed.push(row.slug);
    console.error(`✗ ${row.slug}: ${(error as Error).message}`);
  }
}

console.log(
  `Фото к переносу: ${moved}, товаров обновлено: ${updated}, ошибок: ${failed.length}.`,
);
if (!apply) {
  console.log(
    "Пробный запуск — бакет и база не изменены. Для записи добавьте --apply.",
  );
}
process.exit(failed.length > 0 ? 1 : 0);
