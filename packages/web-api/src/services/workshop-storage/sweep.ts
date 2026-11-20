import { logger } from "@stariva/config";
import { db, inArray } from "@stariva/db";
import type { videoRenditionStatus } from "@stariva/db/schema";
import { videoRenditions, workshops } from "@stariva/db/schema";
import {
  activeStorageProvider,
  deleteObjects,
  isProviderConfigured,
  listObjects,
  otherStorageProvider,
  planWorkshopSweep,
} from "@stariva/storage";

/**
 * Столько живёт файл, на который никто не ссылается: его могли загрузить
 * в форму, которую ещё не сохранили.
 */
export const STORAGE_SWEEP_FILE_GRACE_MS = 3 * 24 * 60 * 60_000;

/**
 * Столько после сохранения курса или перерезки не трогаем его прежние видео
 * и нарезки: их досматривают по выданным ссылкам (HLS живут 6 часов).
 */
export const STORAGE_SWEEP_CHANGE_GRACE_MS = 12 * 60 * 60_000;

export interface WorkshopStorageSweepResult {
  deleted: number;
  bytes: number;
  renditions: number;
}

interface WorkshopRow {
  slug: string;
  updatedAt: Date;
  lessons: { videoKey: string | null | undefined }[];
  materialFiles: { key: string }[];
}

type RenditionStatus = (typeof videoRenditionStatus.enumValues)[number];

interface RenditionRow {
  videoKey: string;
  status: RenditionStatus;
  hlsPrefix: string;
  readyHlsPrefix: string | null;
  updatedAt: Date;
}

export interface SweepWorkshopStorageDeps {
  listObjects: typeof listObjects;
  deleteObjects: typeof deleteObjects;
  activeStorageProvider: typeof activeStorageProvider;
  isProviderConfigured: typeof isProviderConfigured;
  otherStorageProvider: typeof otherStorageProvider;
  getWorkshops: () => Promise<WorkshopRow[]>;
  getRenditions: () => Promise<RenditionRow[]>;
  deleteRenditions: (keys: string[]) => Promise<void>;
  logger: typeof logger;
}

function defaultDeps(): SweepWorkshopStorageDeps {
  return {
    listObjects,
    deleteObjects,
    activeStorageProvider,
    isProviderConfigured,
    otherStorageProvider,
    getWorkshops: () =>
      db
        .select({
          slug: workshops.slug,
          updatedAt: workshops.updatedAt,
          lessons: workshops.lessons,
          materialFiles: workshops.materialFiles,
        })
        .from(workshops),
    getRenditions: () =>
      db
        .select({
          videoKey: videoRenditions.videoKey,
          status: videoRenditions.status,
          hlsPrefix: videoRenditions.hlsPrefix,
          readyHlsPrefix: videoRenditions.readyHlsPrefix,
          updatedAt: videoRenditions.updatedAt,
        })
        .from(videoRenditions),
    deleteRenditions: async (keys) => {
      await db
        .delete(videoRenditions)
        .where(inArray(videoRenditions.videoKey, keys));
    },
    logger,
  };
}

/**
 * Чистит `workshops/` закрытого бакета: исходники и HLS-нарезки заменённых
 * видео, папки упавших и устаревших попыток нарезки, заменённые PDF. Что
 * именно удалять, решает planWorkshopSweep. `dryRun` — только посчитать.
 */
export async function sweepWorkshopStorage(
  options: { now?: Date; dryRun?: boolean } = {},
  deps: Partial<SweepWorkshopStorageDeps> = {},
): Promise<WorkshopStorageSweepResult & { deleteKeys: string[] }> {
  const d = { ...defaultDeps(), ...deps };
  const { now = new Date(), dryRun = false } = options;
  const objects = await d.listObjects("workshops/");
  const rows = await d.getWorkshops();
  // Пустая выборка при непустом бакете — скорее не та база, чем ни одного
  // курса: удалять всё подряд не станем
  if (objects.length > 0 && rows.length === 0) {
    throw new Error("workshop_storage_sweep: no workshops in database");
  }
  const renditions = await d.getRenditions();

  const plan = planWorkshopSweep(
    objects,
    {
      workshops: rows.map((row) => ({
        slug: row.slug,
        updatedAt: row.updatedAt,
        videoKeys: row.lessons
          .map((lesson) => lesson.videoKey)
          .filter((key): key is string => Boolean(key)),
        materialKeys: row.materialFiles.map((file) => file.key),
      })),
      renditions,
    },
    {
      now,
      fileGraceMs: STORAGE_SWEEP_FILE_GRACE_MS,
      changeGraceMs: STORAGE_SWEEP_CHANGE_GRACE_MS,
    },
  );

  if (!dryRun) {
    await d.deleteObjects(plan.deleteKeys);
    if (plan.staleRenditions.length > 0) {
      await d.deleteRenditions(plan.staleRenditions);
    }
    // Чистим и зеркало: после переключения хранилища мусор в старом не
    // должен копиться. Ошибки зеркала не роняют чистку активного бакета
    const mirror = d.otherStorageProvider(d.activeStorageProvider());
    if (d.isProviderConfigured(mirror)) {
      try {
        const mirrorObjects = await d.listObjects("workshops/", mirror);
        if (rows.length === 0 && mirrorObjects.length > 0) {
          d.logger.warn("workshop.storage.sweep.mirror_no_workshops", {
            objects: mirrorObjects.length,
          });
        } else {
          const mirrorPlan = planWorkshopSweep(
            mirrorObjects,
            {
              workshops: rows.map((row) => ({
                slug: row.slug,
                updatedAt: row.updatedAt,
                videoKeys: row.lessons
                  .map((lesson) => lesson.videoKey)
                  .filter((key): key is string => Boolean(key)),
                materialKeys: row.materialFiles.map((file) => file.key),
              })),
              renditions,
            },
            {
              now,
              fileGraceMs: STORAGE_SWEEP_FILE_GRACE_MS,
              changeGraceMs: STORAGE_SWEEP_CHANGE_GRACE_MS,
            },
          );
          await d.deleteObjects(mirrorPlan.deleteKeys, mirror);
          d.logger.info("workshop.storage.sweep.mirror", {
            deleted: mirrorPlan.deleteKeys.length,
            bytes: mirrorPlan.bytes,
          });
        }
      } catch (error) {
        d.logger.warn("workshop.storage.sweep.mirror_failed", {
          error: String(error),
        });
      }
    }
  }

  const result = {
    deleted: plan.deleteKeys.length,
    bytes: plan.bytes,
    renditions: plan.staleRenditions.length,
  };
  d.logger.info("workshop.storage.sweep", { ...result, dryRun });
  return { ...result, deleteKeys: plan.deleteKeys };
}
