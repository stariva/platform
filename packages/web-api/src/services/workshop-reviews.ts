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
    }
  | { status: "not_found" | "unavailable" | "photo_invalid" };

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

  const existing = await findReviewRow(input.userId, input.workshopSlug);
  const id = existing?.id ?? randomUUID();

  // Оставить можно только свои прежние фото: чужой адрес в отзыв не попадёт
  const kept = input.keepPhotos.filter((url) =>
    existing?.photos.includes(url),
  );

  const files: { bytes: Uint8Array; type: string }[] = [];
  for (const file of input.photos) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Заголовку от браузера не верим — тип по сигнатуре файла
    const type = detectImageType(bytes);
    if (!type) return { status: "photo_invalid" };
    files.push({ bytes, type });
  }

  let uploaded: string[] = [];
  if (files.length > 0) {
    if (!isPublicStorageConfigured()) return { status: "unavailable" };
    try {
      uploaded = await Promise.all(
        files.map(({ bytes, type }) =>
          uploadPublicObject(reviewImageKey(id, bytes, type), bytes, type),
        ),
      );
    } catch (error) {
      logger.error("workshop_review.photo_upload_failed", error, {
        workshopSlug: input.workshopSlug,
      });
      return { status: "unavailable" };
    }
  }
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
    // Изменённый отзыв снова проверяют, прежде чем показать
    published: false,
  };
  const [row] = await db
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
  if (!row) return { status: "unavailable" };

  const removed = (existing?.photos ?? []).filter(
    (url) => !photos.includes(url),
  );
  await removePhotos(removed);

  return {
    status: "ok",
    review: toWorkshopReview(row),
    workshopTitle: workshop.title,
    created: !existing,
    wasPublished: existing?.published ?? false,
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
