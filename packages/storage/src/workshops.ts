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

/** Качество из master.m3u8: размер кадра (0 — не указан) и пиковый битрейт. */
export interface HlsVariantInfo {
  width: number;
  height: number;
  /** Бит/с. */
  bandwidth: number;
}

/**
 * Качества из master.m3u8, от лучшего к худшему. В самом плейлисте первым
 * идёт среднее (с него начинает Safari), поэтому порядок свой.
 */
export function parseMasterPlaylist(text: string): HlsVariantInfo[] {
  const variants: HlsVariantInfo[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const bandwidth = /(?:^|[:,])BANDWIDTH=(\d+)/.exec(line);
    const resolution = /RESOLUTION=(\d+)x(\d+)/.exec(line);
    variants.push({
      width: Number(resolution?.[1] ?? 0),
      height: Number(resolution?.[2] ?? 0),
      bandwidth: Number(bandwidth?.[1] ?? 0),
    });
  }
  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
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

/** Курс глазами чистки бакета: на какие файлы он ссылается и когда сохранён. */
export interface SweepWorkshop {
  slug: string;
  updatedAt: Date;
  videoKeys: string[];
  materialKeys: string[];
}

/** Нарезка глазами чистки бакета. */
export interface SweepRendition {
  videoKey: string;
  status: "processing" | "ready" | "failed";
  hlsPrefix: string;
  readyHlsPrefix: string | null;
  updatedAt: Date;
}

export interface WorkshopSweepPlan {
  /** Файлы, которые можно удалить из закрытого бакета. */
  deleteKeys: string[];
  /** Сколько байт они занимают. */
  bytes: number;
  /** Строки video_renditions, чьих исходников больше нет. */
  staleRenditions: string[];
}

/**
 * Что удалить из `workshops/` закрытого бакета. Каждая загрузка и каждая
 * попытка нарезки получают свой ключ, поэтому после замены видео, PDF или
 * перерезки прежние файлы остаются лежать. Удаляем всё, на что не ссылаются
 * курсы (включая черновики) и их нарезки, кроме недавнего:
 * - файл моложе `fileGraceMs` — его могли загрузить в ещё не сохранённую форму;
 * - курс или нарезку меняли позже `changeGraceMs` назад — старое видео ещё
 *   досматривают по выданным ссылкам.
 */
export function planWorkshopSweep(
  objects: { key: string; size: number; lastModified: Date }[],
  state: { workshops: SweepWorkshop[]; renditions: SweepRendition[] },
  {
    now,
    fileGraceMs,
    changeGraceMs,
  }: { now: Date; fileGraceMs: number; changeGraceMs: number },
): WorkshopSweepPlan {
  const fileCutoff = now.getTime() - fileGraceMs;
  const changeCutoff = now.getTime() - changeGraceMs;
  const videoKeys = new Set(state.workshops.flatMap((w) => w.videoKeys));
  const keepKeys = new Set([
    ...videoKeys,
    ...state.workshops.flatMap((w) => w.materialKeys),
  ]);
  // Папки со слешем на конце: префикс одной попытки не накрывает соседнюю
  const keepFolders: string[] = [];
  const recentFolders: string[] = [];

  for (const workshop of state.workshops) {
    if (workshop.updatedAt.getTime() > changeCutoff) {
      recentFolders.push(`${workshopStoragePrefix(workshop.slug)}/`);
    }
  }
  for (const rendition of state.renditions) {
    if (!videoKeys.has(rendition.videoKey)) continue;
    // Нарезка, которую смотрят, и попытка, которую сейчас режут. Папка
    // упавшей попытки не нужна: повтор получит новую
    if (rendition.readyHlsPrefix)
      keepFolders.push(`${rendition.readyHlsPrefix}/`);
    if (rendition.status !== "failed")
      keepFolders.push(`${rendition.hlsPrefix}/`);
    if (rendition.updatedAt.getTime() > changeCutoff) {
      recentFolders.push(`${workshopHlsPrefix(rendition.videoKey)}/`);
    }
  }

  const inFolder = (key: string, folders: string[]) =>
    folders.some((folder) => key.startsWith(folder));
  const doomed = objects.filter(
    (object) =>
      !keepKeys.has(object.key) &&
      object.lastModified.getTime() <= fileCutoff &&
      !inFolder(object.key, keepFolders) &&
      !inFolder(object.key, recentFolders),
  );
  const deleteKeys = doomed.map((object) => object.key);
  const doomedKeys = new Set(deleteKeys);
  const remaining = new Set(
    objects.map((object) => object.key).filter((key) => !doomedKeys.has(key)),
  );

  return {
    deleteKeys,
    bytes: doomed.reduce((sum, object) => sum + object.size, 0),
    staleRenditions: state.renditions
      .filter(
        (rendition) =>
          !videoKeys.has(rendition.videoKey) &&
          !remaining.has(rendition.videoKey) &&
          rendition.updatedAt.getTime() <= changeCutoff,
      )
      .map((rendition) => rendition.videoKey),
  };
}

/** Ключ принадлежит файлам именно этого курса (а не чужому объекту бакета). */
export function isWorkshopKey(slug: string, key: string): boolean {
  return (
    key.startsWith(`${workshopStoragePrefix(slug)}/`) && !key.includes("..")
  );
}
