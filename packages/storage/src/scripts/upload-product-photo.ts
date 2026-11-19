/**
 * Кладёт фото товара в публичный бакет CDN — с тем же ключом, который даёт
 * админка при загрузке фото: products/<productId>/<hash>.<ext>. Пригодился,
 * когда товар заводят миграцией, а не через форму в админке.
 *
 * Запуск:
 *   bun --env-file=../../.env src/scripts/upload-product-photo.ts <productId> <путь-к-файлу>
 *
 * Повторная загрузка того же файла попадает в тот же ключ (хеш содержимого),
 * поэтому адрес фото не меняется.
 */
import { readFile } from "node:fs/promises";
import { detectImageType, productImageKey } from "../catalog";
import { uploadPublicObject } from "../s3";

const [productId, filePath] = process.argv.slice(2);
if (!productId || !filePath) {
  throw new Error("Нужны два аргумента: <productId> <путь-к-файлу>");
}

const bytes = new Uint8Array(await readFile(filePath));
const contentType = detectImageType(bytes);
if (!contentType) {
  throw new Error("Файл не похож на JPEG, PNG, WebP, AVIF или GIF");
}

const key = productImageKey(productId, bytes, contentType);
console.log(await uploadPublicObject(key, bytes, contentType));
