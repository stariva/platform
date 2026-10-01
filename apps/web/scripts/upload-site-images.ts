/**
 * Выкладывает статичные картинки сайта (public/images) в наш публичный бакет S3.
 *
 *   bun --env-file=../../.env scripts/upload-site-images.ts          — только показать, что будет загружено
 *   bun --env-file=../../.env scripts/upload-site-images.ts --apply  — загрузить в бакет
 *
 * public/images/<путь> попадает в <бакет>/site/images/<путь>. Повторный запуск
 * безопасен: файлы перезаписываются теми же байтами. Кэш у файлов вечный, поэтому
 * изменённую картинку нужно класть под новым именем, а не поверх старой.
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import {
  isPublicStorageConfigured,
  publicObjectUrl,
  uploadPublicObject,
} from "@stariva/storage";

const apply = process.argv.includes("--apply");
const SOURCE_DIR = join(import.meta.dirname, "..", "public", "images");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

if (!isPublicStorageConfigured()) {
  console.error(
    "Публичный бакет не настроен: нужны AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_ENDPOINT и AWS_S3_PUBLIC_BUCKET.",
  );
  process.exit(1);
}

console.log(`Публичный адрес картинок: ${publicObjectUrl("site/images/")}`);

const entries = await readdir(SOURCE_DIR, {
  recursive: true,
  withFileTypes: true,
});
const files = entries
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

let uploaded = 0;
let bytesTotal = 0;
const failed: string[] = [];

for (const file of files) {
  const path = relative(SOURCE_DIR, file).split(sep).join("/");
  const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
  if (!contentType) {
    failed.push(path);
    console.error(`✗ ${path}: неизвестный тип файла`);
    continue;
  }

  const key = `site/images/${path}`;
  try {
    const bytes = await readFile(file);
    bytesTotal += bytes.byteLength;
    if (apply) await uploadPublicObject(key, bytes, contentType);
    uploaded++;
    console.log(`✓ ${key} (${Math.round(bytes.byteLength / 1024)} КБ)`);
  } catch (error) {
    failed.push(path);
    console.error(`✗ ${key}: ${(error as Error).message}`);
  }
}

console.log(
  `Файлов: ${uploaded} из ${files.length}, ${(bytesTotal / 1024 / 1024).toFixed(1)} МБ, ошибок: ${failed.length}.`,
);
if (!apply) {
  console.log(
    "Пробный запуск — бакет не изменён. Для записи добавьте --apply.",
  );
}
process.exit(failed.length > 0 ? 1 : 0);
