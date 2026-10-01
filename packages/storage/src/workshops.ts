import { createHash, randomBytes } from "node:crypto";
import { PRODUCT_IMAGE_TYPES } from "./catalog";

/** Префикс ключей объектов курса в закрытом бакете (видео и PDF). */
export function workshopStoragePrefix(slug: string): string {
  return `workshops/${slug}`;
}

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const shortId = () => randomBytes(5).toString("hex");

/**
 * Ключ видео урока. Случайный хвост — у каждой загрузки свой ключ, поэтому
 * замена видео не упирается в кэш и не затирает файл, который сейчас смотрят.
 */
export function workshopVideoKey(
  slug: string,
  lessonId: string,
  contentType: string,
): string {
  const extension = VIDEO_EXTENSIONS[contentType];
  if (!extension) throw new Error(`unsupported video type: ${contentType}`);
  const safeLesson = lessonId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  return `${workshopStoragePrefix(slug)}/${safeLesson || "lesson"}-${shortId()}.${extension}`;
}

/** Ключ PDF-материала. Имя файла сохраняем для читаемости, но чистим. */
export function workshopMaterialKey(slug: string, fileName: string): string {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${workshopStoragePrefix(slug)}/materials/${base || "file"}-${shortId()}.pdf`;
}

/** Ключ картинки курса в публичном бакете (хеш содержимого — кэш навсегда). */
export function workshopImageKey(
  slug: string,
  bytes: Uint8Array,
  contentType: string,
): string {
  const extension = PRODUCT_IMAGE_TYPES[contentType];
  if (!extension) throw new Error(`unsupported image type: ${contentType}`);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `workshops/${slug}/${hash}.${extension}`;
}

/** Ключ принадлежит файлам именно этого курса (а не чужому объекту бакета). */
export function isWorkshopKey(slug: string, key: string): boolean {
  return (
    key.startsWith(`${workshopStoragePrefix(slug)}/`) && !key.includes("..")
  );
}
