import { randomUUID } from "node:crypto";
import { logger } from "@stariva/config";
import { and, db, eq } from "@stariva/db";
import { type ReviewRow, reviews, workshops } from "@stariva/db/schema";
import {
  deletePublicObjects,
  detectImageType,
  isPublicStorageConfigured,
  publicObjectKey,
  reviewImageKey,
  stripImageMetadata,
  uploadPublicObject,
} from "@stariva/storage";
import type { WorkshopReview } from "../contract";

function toWorkshopReview(row: ReviewRow): WorkshopReview {
  return {
    rating: row.rating,
    text: row.text,
    reviewerName: row.reviewerName,
    photos: row.photos,
    status: row.published ? "published" : "pending",
  };
}

async function findReviewRow(
  userId: string,
  workshopSlug: string,
): Promise<ReviewRow | undefined> {
  const [row] = await db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.userId, userId), eq(reviews.workshopSlug, workshopSlug)),
    )
    .limit(1);
  return row;
}

/** Отзыв покупателя о мастер-классе; null — ещё не оставлял. */
export async function getWorkshopReview(
  userId: string,
  workshopSlug: string,
): Promise<WorkshopReview | null> {
  const row = await findReviewRow(userId, workshopSlug);
  return row ? toWorkshopReview(row) : null;
}

export interface SaveWorkshopReviewInput {
  userId: string;
  workshopSlug: string;
  rating: number;
  text: string;
  reviewerName: string;
  keepPhotos: string[];
  photos: File[];
  now?: Date;
}

export type SaveWorkshopReviewResult =
  | {
      status: "ok";
      review: WorkshopReview;
      workshopTitle: string;
      /** Отзыв впервые или после правки ушёл на проверку */
      created: boolean;
      /** До правки отзыв был на сайте — страницы с ним нужно обновить */
      wasPublished: boolean;
      /**
       * Сообщить мастеру: отзыв новый, был на сайте или давно не менялся.
       * Серия правок подряд — одно сообщение, отзыв она прочитает последним.
       */
      notify: boolean;
    }
  | { status: "not_found" | "unavailable" | "photo_invalid" };

/** Правки чаще этого не будят мастера новым сообщением. */
export const REVIEW_NOTIFY_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Сохраняет отзыв о мастер-классе: новые фото кладёт в публичный бакет под
 * ключом от содержимого, убранные автором — удаляет. Отзыв всегда уходит на
 * проверку: на сайте его покажут только после неё.
 */
export async function saveWorkshopReview(
  input: SaveWorkshopReviewInput,
): Promise<SaveWorkshopReviewResult> {
  const now = input.now ?? new Date();
  const [workshop] = await db
    .select({ title: workshops.title })
    .from(workshops)
    .where(eq(workshops.slug, input.workshopSlug))
    .limit(1);
  if (!workshop) return { status: "not_found" };

  const files: { bytes: Uint8Array; type: string }[] = [];
  for (const file of input.photos) {
    const raw = new Uint8Array(await file.arrayBuffer());
    // Заголовку от браузера не верим — тип по сигнатуре файла
    const type = detectImageType(raw);
    if (!type) return { status: "photo_invalid" };
    // Фото уйдёт на публичный сайт: координаты съёмки и прочий EXIF убираем
    // и здесь, даже если запрос пришёл мимо формы, которая уже перекодировала
    const bytes = stripImageMetadata(raw, type);
    if (!bytes) return { status: "photo_invalid" };
    files.push({ bytes, type });
  }
  if (files.length > 0 && !isPublicStorageConfigured()) {
    return { status: "unavailable" };
  }

  // Фото грузим до транзакции: держать блокировку строки, пока идёт загрузка
  // в бакет, незачем. Id нужен только как папка для файлов.
  const known = await findReviewRow(input.userId, input.workshopSlug);
  const id = known?.id ?? randomUUID();
  // Файлы, на которые уже ссылается отзыв: при откате их не трогаем, даже
  // если автор загрузил тот же снимок ещё раз (ключ зависит от содержимого)
  const referenced = new Set(known?.photos ?? []);
  const discardUploads = (urls: string[]) =>
    removePhotos(urls.filter((url) => !referenced.has(url)));

  const uploads = await Promise.allSettled(
    files.map(({ bytes, type }) =>
      uploadPublicObject(reviewImageKey(id, bytes, type), bytes, type),
    ),
  );
  const uploaded = uploads.flatMap((u) =>
    u.status === "fulfilled" ? [u.value] : [],
  );
  const failedUpload = uploads.find((u) => u.status === "rejected");
  if (failedUpload) {
    logger.error("workshop_review.photo_upload_failed", failedUpload.reason, {
      workshopSlug: input.workshopSlug,
    });
    await discardUploads(uploaded);
    return { status: "unavailable" };
  }

  let saved: { row: ReviewRow; before: ReviewRow | undefined };
  try {
    saved = await db.transaction(async (tx) => {
      // Строку перечитываем под блокировкой: два сохранения из разных вкладок
      // идут по очереди, и каждое видит фото, записанные предыдущим
      const [before] = await tx
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.userId, input.userId),
            eq(reviews.workshopSlug, input.workshopSlug),
          ),
        )
        .limit(1)
        .for("update");

      // Оставить можно только свои прежние фото: чужой адрес в отзыв не попадёт
      const kept = input.keepPhotos.filter((url) =>
        before?.photos.includes(url),
      );
      // Одно и то же фото дважды — один файл: ключ зависит от содержимого
      const photos = [...new Set([...kept, ...uploaded])];

      const fields = {
        rating: input.rating,
        text: input.text,
        reviewerName: input.reviewerName,
        photos,
        productTitle: workshop.title,
        reviewedAt: now,
        publishConsentAt: now,
        // Версия отзыва: админка публикует только ту, что видела. При вставке
        // и при ON CONFLICT ставим сами — $onUpdateFn тут не срабатывает
        updatedAt: now,
        // Изменённый отзыв снова проверяют, прежде чем показать
        published: false,
      };
      const [row] = await tx
        .insert(reviews)
        .values({
          id,
          source: "site",
          workshopSlug: input.workshopSlug,
          userId: input.userId,
          ...fields,
        })
        .onConflictDoUpdate({
          target: [reviews.userId, reviews.workshopSlug],
          set: fields,
        })
        .returning();
      if (!row) throw new Error("review_upsert_returned_nothing");
      return { row, before };
    });
  } catch (error) {
    logger.error("workshop_review.save_failed", error, {
      workshopSlug: input.workshopSlug,
    });
    await discardUploads(uploaded);
    return { status: "unavailable" };
  }

  // Удаляем только то, чего нет в записанной версии, и только после записи:
  // список фото взят под той же блокировкой, устареть он не мог
  const { row, before } = saved;
  await removePhotos(
    (before?.photos ?? []).filter((url) => !row.photos.includes(url)),
  );

  return {
    status: "ok",
    review: toWorkshopReview(row),
    workshopTitle: workshop.title,
    created: !before,
    wasPublished: before?.published ?? false,
    notify:
      !before ||
      before.published ||
      now.getTime() - before.updatedAt.getTime() >= REVIEW_NOTIFY_INTERVAL_MS,
  };
}

/** Убранные автором фото удаляем; сбой не мешает отзыву, только в лог. */
async function removePhotos(urls: string[]): Promise<void> {
  const keys = urls
    .map(publicObjectKey)
    .filter((key): key is string => key?.startsWith("reviews/") ?? false);
  if (keys.length === 0) return;
  try {
    await deletePublicObjects(keys);
  } catch (error) {
    logger.warn("workshop_review.photo_delete_failed", {
      keys,
      error: String(error),
    });
  }
}
