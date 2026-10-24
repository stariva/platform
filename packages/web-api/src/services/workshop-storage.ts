import { logger } from "@stariva/config";
import { db, inArray } from "@stariva/db";
import { videoRenditions, workshops } from "@stariva/db/schema";
import {
  deleteObjects,
  listObjects,
  planWorkshopSweep,
} from "@stariva/storage";

/**
 * Столько живут файлы, на которые никто не ссылается. Покрывает форму,
 * в которую видео загрузили, но ещё не сохранили, и зрителей, досматривающих
 * заменённое видео (ссылки на HLS живут 6 часов).
 */
export const STORAGE_SWEEP_GRACE_MS = 3 * 24 * 60 * 60_000;

export interface WorkshopStorageSweepResult {
  deleted: number;
  bytes: number;
  renditions: number;
}

/**
 * Чистит `workshops/` закрытого бакета: исходники и HLS-нарезки заменённых
 * видео, папки упавших и устаревших попыток нарезки, заменённые PDF. Что
 * именно удалять, решает planWorkshopSweep. `dryRun` — только посчитать.
 */
export async function sweepWorkshopStorage({
  now = new Date(),
  dryRun = false,
}: {
  now?: Date;
  dryRun?: boolean;
} = {}): Promise<WorkshopStorageSweepResult & { deleteKeys: string[] }> {
  const objects = await listObjects("workshops/");
  const rows = await db
    .select({
      slug: workshops.slug,
      updatedAt: workshops.updatedAt,
      lessons: workshops.lessons,
      materialFiles: workshops.materialFiles,
    })
    .from(workshops);
  // Пустая выборка при непустом бакете — скорее не та база, чем ни одного
  // курса: удалять всё подряд не станем
  if (objects.length > 0 && rows.length === 0) {
    throw new Error("workshop_storage_sweep: no workshops in database");
  }
  const renditions = await db
    .select({
      videoKey: videoRenditions.videoKey,
      status: videoRenditions.status,
      hlsPrefix: videoRenditions.hlsPrefix,
      readyHlsPrefix: videoRenditions.readyHlsPrefix,
      updatedAt: videoRenditions.updatedAt,
    })
    .from(videoRenditions);

  const plan = planWorkshopSweep(
    objects,
    {
      workshops: rows.map((row) => ({
        slug: row.slug,
        updatedAt: row.updatedAt,
        videoKeys: row.lessons.map((lesson) => lesson.videoKey).filter(Boolean),
        materialKeys: row.materialFiles.map((file) => file.key),
      })),
      renditions,
    },
    { now, graceMs: STORAGE_SWEEP_GRACE_MS },
  );

  if (!dryRun) {
    await deleteObjects(plan.deleteKeys);
    if (plan.staleRenditions.length > 0) {
      await db
        .delete(videoRenditions)
        .where(inArray(videoRenditions.videoKey, plan.staleRenditions));
    }
  }

  const result = {
    deleted: plan.deleteKeys.length,
    bytes: plan.bytes,
    renditions: plan.staleRenditions.length,
  };
  logger.info("workshop.storage.sweep", { ...result, dryRun });
  return { ...result, deleteKeys: plan.deleteKeys };
}
