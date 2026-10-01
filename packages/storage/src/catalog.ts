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

/** Ключ фото из отзыва в публичном бакете; устроен так же, как productImageKey. */
export function reviewImageKey(
  reviewId: string,
  bytes: Uint8Array,
  contentType: string,
): string {
  const extension = PRODUCT_IMAGE_TYPES[contentType];
  if (!extension) throw new Error(`unsupported image type: ${contentType}`);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `reviews/${reviewId}/${hash}.${extension}`;
}

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/**
 * Тип изображения по сигнатуре файла. Заголовку Content-Type от клиента
 * верить нельзя. null — не одно из PRODUCT_IMAGE_TYPES.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  // ISO BMFF: размер бокса, «ftyp», основной бренд, версия, совместимые бренды
  if (ascii(bytes, 4, 8) === "ftyp") {
    const boxSize = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint32(0);
    const end = Math.min(boxSize, bytes.length, 64);
    const brands = [ascii(bytes, 8, 12)];
    for (let i = 16; i + 4 <= end; i += 4) brands.push(ascii(bytes, i, i + 4));
    if (brands.some((brand) => brand === "avif" || brand === "avis")) {
      return "image/avif";
    }
  }
  return null;
}
