import { logger } from "@stariva/config";
import {
  activeStorageProvider,
  createUploadUrl,
  getDownloadUrl,
  isProviderConfigured,
  listObjects,
  mirrorContentType,
  otherStorageProvider,
  planMirrorSync,
} from "@stariva/storage";
import { syncRenditionMirrorFlags } from "./video-renditions";

/** Файл для копирования в зеркало: ключ и ссылки на оба бакета. */
export interface MirrorSyncFile {
  key: string;
  size: number;
  /** Подписан в putUrl: воркер обязан PUT-ить с этим Content-Type. */
  contentType: string;
  /** Подписанное чтение из активного бакета. */
  getUrl: string;
  /** Подписанная заливка в зеркало. */
  putUrl: string;
}

export interface MirrorSyncBatch {
  /** false — зеркало не настроено: воркеру нечего копировать. */
  configured: boolean;
  files: MirrorSyncFile[];
  /** Сколько файлов/байт ждут копирования, включая эту пачку. */
  remainingFiles: number;
  remainingBytes: number;
}

/** Пачку воркер копирует минуты; запас в 3 часа — на большие исходники. */
const URL_TTL_SECONDS = 3 * 60 * 60;

/** Папка мастер-классов в закрытом бакете: всё, что копирует зеркало. */
const WORKSHOPS_PREFIX = "workshops/";

/** Пачка файлов, которых в зеркале ещё нет: ссылки для чтения и заливки. */
export async function claimMirrorSyncBatch(
  options: { maxFiles?: number; maxBytes?: number } = {},
): Promise<MirrorSyncBatch> {
  const source = activeStorageProvider();
  const target = otherStorageProvider(source);
  if (!isProviderConfigured(target)) {
    return {
      configured: false,
      files: [],
      remainingFiles: 0,
      remainingBytes: 0,
    };
  }

  const [sourceObjects, mirrorObjects] = await Promise.all([
    listObjects(WORKSHOPS_PREFIX, source),
    listObjects(WORKSHOPS_PREFIX, target),
  ]);
  const plan = planMirrorSync(sourceObjects, mirrorObjects, {
    maxFiles: options.maxFiles ?? 1000,
    maxBytes: options.maxBytes ?? 8 * 1024 ** 3,
  });

  // Заодно обновляем отметки «нарезка скопирована целиком»: по ним витрина
  // решает, можно ли зрителям отдавать HLS из второго хранилища
  const flags = await syncRenditionMirrorFlags(sourceObjects, mirrorObjects);
  if (flags.marked > 0 || flags.cleared > 0) {
    logger.info("storage.mirror.renditions", { ...flags });
  }

  const files = await Promise.all(
    plan.copy.map(async (file): Promise<MirrorSyncFile> => {
      const contentType = mirrorContentType(file.key);
      return {
        key: file.key,
        size: file.size,
        contentType,
        getUrl: await getDownloadUrl(file.key, {
          expiresIn: URL_TTL_SECONDS,
          provider: source,
        }),
        putUrl: await createUploadUrl(file.key, contentType, {
          expiresIn: URL_TTL_SECONDS,
          provider: target,
        }),
      };
    }),
  );

  return {
    configured: true,
    files,
    remainingFiles: plan.remainingFiles,
    remainingBytes: plan.remainingBytes,
  };
}
