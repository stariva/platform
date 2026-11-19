import type { StoredObject } from "./s3";
import { HLS_FILE_PATTERN, hlsContentType } from "./workshops";

/** Файл, которого нет в зеркале (или размер не совпал) — его копирует воркер. */
export interface MirrorCopy {
  key: string;
  size: number;
}

export interface MirrorSyncPlan {
  /** Пачка для копирования: старые файлы вперёд, чтобы зеркало скорее стало полным. */
  copy: MirrorCopy[];
  /** Сколько файлов ждут копирования, включая эту пачку. */
  remainingFiles: number;
  /** Сколько байт ждут копирования, включая эту пачку. */
  remainingBytes: number;
}

/**
 * Что скопировать из активного бакета в зеркало. Копируем файлы, которых в
 * зеркале нет или чей размер не совпал (PUT в S3 атомарен, так что расхождение
 * — признак чужого файла под нашим ключом; перезапишем). Пачку набираем до
 * `maxFiles` или пока не набрали `maxBytes` — последний файл кладём и сверх
 * лимита, иначе один большой исходник не скопируется никогда.
 *
 * Повтор прогона безопасен: скопированное исчезает из следующего плана.
 */
export function planMirrorSync(
  source: StoredObject[],
  mirror: StoredObject[],
  limits: { maxFiles: number; maxBytes: number },
): MirrorSyncPlan {
  const mirrorSizes = new Map(
    mirror.map((object) => [object.key, object.size]),
  );
  const pending = source
    .filter((object) => mirrorSizes.get(object.key) !== object.size)
    // Сначала старое: свежие загрузки интереснее копить после догонения
    // накопившегося, а у нарезок порядок не важен — их смотрят по готовности
    .sort(
      (a, b) =>
        a.lastModified.getTime() - b.lastModified.getTime() ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );

  const copy: MirrorCopy[] = [];
  let batchBytes = 0;
  for (const object of pending) {
    if (copy.length >= limits.maxFiles || batchBytes >= limits.maxBytes) break;
    copy.push({ key: object.key, size: object.size });
    batchBytes += object.size;
  }

  return {
    copy,
    remainingFiles: pending.length,
    remainingBytes: pending.reduce((sum, object) => sum + object.size, 0),
  };
}

/**
 * Считает объекты под каждым префиксом. Префиксы не вкладываются друг в друга
 * (папки нарезок), поэтому один проход по списку отвечает на все.
 */
export function countUnderPrefixes(
  objects: { key: string }[],
  prefixes: string[],
): Map<string, number> {
  const counts = new Map<string, number>(prefixes.map((p) => [p, 0]));
  for (const object of objects) {
    for (const prefix of prefixes) {
      if (object.key.startsWith(`${prefix}/`)) {
        counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
        break;
      }
    }
  }
  return counts;
}

/**
 * Папка нарезки скопирована в зеркало целиком: в источнике она непустая и в
 * зеркале файлов не меньше. Размеры сверять не нужно — PUT атомарен, лишние
 * файлы в зеркале выметает чистка. По этой проверке сайт решает, можно ли
 * зрителям отдавать нарезку из зеркала.
 */
export function isMirrorFolderComplete(
  sourceCounts: Map<string, number>,
  mirrorCounts: Map<string, number>,
  prefix: string,
): boolean {
  const source = sourceCounts.get(prefix) ?? 0;
  return source > 0 && (mirrorCounts.get(prefix) ?? 0) >= source;
}

/** Content-Type при копировании: зеркало должно отдавать файлы с теми же типами, что и активный бакет. */
export function mirrorContentType(key: string): string {
  // Имена файлов HLS нарезки узнаём по тому же шаблону, что и маршрут отдачи
  const file = key.slice(key.lastIndexOf("/") + 1);
  if (HLS_FILE_PATTERN.test(file)) return hlsContentType(file);
  const extension = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}
