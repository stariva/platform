import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { certificates } from "@stariva/db/schema";
import { and, eq } from "drizzle-orm";
import { getWorkshopBySlug } from "@/lib/workshops-data";
import { getCourseProgressSummary } from "./access";

export interface CertificateInfo {
  number: string;
  issuedAt: Date;
}

/** Возвращает сертификат пользователя по курсу, если он уже выдан. */
export async function getCertificate(
  userId: string,
  workshopSlug: string,
): Promise<CertificateInfo | null> {
  const rows = await db
    .select({ number: certificates.number, issuedAt: certificates.issuedAt })
    .from(certificates)
    .where(
      and(
        eq(certificates.userId, userId),
        eq(certificates.workshopSlug, workshopSlug),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Генерирует человекочитаемый номер сертификата. */
function generateNumber(workshopSlug: string): string {
  const year = new Date().getFullYear();
  const rand = (randomUUID().split("-")[0] ?? "").toUpperCase();
  // Короткий префикс из slug курса
  const prefix = workshopSlug.slice(0, 3).toUpperCase();
  return `STV-${year}-${prefix}-${rand}`;
}

/**
 * Выдаёт сертификат, если курс полностью пройден. Идемпотентно:
 * повторный вызов вернёт уже существующий сертификат.
 *
 * @returns сертификат или null, если курс ещё не завершён
 */
export async function issueCertificateIfComplete(
  userId: string,
  workshopSlug: string,
): Promise<CertificateInfo | null> {
  const existing = await getCertificate(userId, workshopSlug);
  if (existing) return existing;

  const workshop = getWorkshopBySlug(workshopSlug);
  if (!workshop) return null;

  const summary = await getCourseProgressSummary(userId, workshop);
  if (!summary.isComplete) return null;

  const number = generateNumber(workshopSlug);
  await db
    .insert(certificates)
    .values({
      id: randomUUID(),
      userId,
      workshopSlug,
      number,
    })
    .onConflictDoNothing({
      target: [certificates.userId, certificates.workshopSlug],
    });

  // Возвращаем актуальную запись (на случай гонки)
  return (
    (await getCertificate(userId, workshopSlug)) ?? {
      number,
      issuedAt: new Date(),
    }
  );
}
