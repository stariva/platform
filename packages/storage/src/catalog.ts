import { createHash } from "node:crypto";

/** Форматы фото каталога и их расширения в бакете. */
export const PRODUCT_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * Ключ фото товара в публичном бакете. Хеш содержимого в имени: повторная
 * загрузка того же файла попадает в тот же ключ, а новый файл — в новый,
 * поэтому фото можно кэшировать навсегда.
 */
export function productImageKey(
  productId: string,
  bytes: Uint8Array,
  contentType: string,
): string {
  const extension = PRODUCT_IMAGE_TYPES[contentType];
  if (!extension) throw new Error(`unsupported image type: ${contentType}`);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `products/${productId}/${hash}.${extension}`;
}
