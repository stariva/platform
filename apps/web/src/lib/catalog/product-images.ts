import { createHash } from "node:crypto";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Фото ещё лежит не у нас (CDN Ozon и т.п.) — его нужно перенести. */
export function isExternalImage(url: string, publicBaseUrl: string): boolean {
  return /^https?:\/\//.test(url) && !url.startsWith(publicBaseUrl);
}

/**
 * Ключ фото в публичном бакете. Хеш содержимого в имени: повторная загрузка
 * того же файла попадает в тот же ключ, а новый файл — в новый, поэтому
 * его можно кэшировать навсегда.
 */
export function productImageKey(
  productId: string,
  bytes: Uint8Array,
  contentType: string,
): string {
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error(`unsupported image type: ${contentType}`);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `products/${productId}/${hash}.${extension}`;
}
