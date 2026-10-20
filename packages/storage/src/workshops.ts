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

/**
 * Папка HLS-версии видео: рядом с исходником, `workshops/<slug>/hls/<имя без
 * расширения>`. Выводится из ключа исходника, поэтому у каждой загрузки своя.
 */
export function workshopHlsPrefix(videoKey: string): string {
  const slash = videoKey.lastIndexOf("/");
  const folder = videoKey.slice(0, slash);
  const name = videoKey.slice(slash + 1).replace(/\.[^.]+$/, "");
  return `${folder}/hls/${name}`;
}

/**
 * Файлы HLS-версии. Первая версия нарезки — одно качество: плейлист,
 * инициализирующий сегмент и куски по порядку прямо в папке. Вторая —
 * несколько качеств: master.m3u8 со списком и те же файлы в подпапках
 * v0/, v1/, v2/.
 */
export const HLS_FILE_PATTERN =
  /^(master\.m3u8|(v\d\/)?(index\.m3u8|init\.mp4|seg-\d{5}\.m4s))$/;

/**
 * Плейлист, с которого плеер начинает нарезку: у версии 1 (одно качество) —
 * index.m3u8, у версии 2 (несколько качеств) — master.m3u8.
 */
export function hlsPlaylistFile(version: number): string {
  return version >= 2 ? "master.m3u8" : "index.m3u8";
}

/** Content-Type файла HLS-версии. Подписывается в ссылке на загрузку. */
export function hlsContentType(file: string): string {
  if (file.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (file.endsWith(".m4s")) return "video/iso.segment";
  return "video/mp4";
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

/**
 * Имя PDF-материала во вложении письма — по подписи из админки:
 * «Бриф «Ёлка макраме»» → «Бриф «Ёлка макраме».pdf».
 */
export function workshopMaterialFileName(label: string): string {
  const base = label
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.pdf$/i, "")
    .slice(0, 100);
  return `${base || "Материалы"}.pdf`;
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
