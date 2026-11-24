import { logger } from "@stariva/config";
import { and, db, eq, notInArray, sql } from "@stariva/db";
import { ozonDeliveryToken, ozonPickupPoints } from "@stariva/db/schema";
import { z } from "zod";
import { env } from "../env";

const OZON_DELIVERY_API_URL = "https://api.ozon.ru";
const PVZ_PAGE_SIZE = 1000;

export interface OzonPvzSyncResult {
  configured: boolean;
  upserted: number;
  deactivated: number;
}

// Гибкая схема: реальные поля Ozon Доставки могут отличаться от документации
const coordinatesSchema = z
  .object({
    lat: z.number().optional().nullable(),
    lon: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    latitude: z.number().optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const pvzItemSchema = z
  .object({
    delivery_point_id: z.string().optional().nullable(),
    id: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    full_address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    coordinates: coordinatesSchema,
    location: coordinatesSchema,
    working_hours: z.unknown().optional().nullable(),
    schedule: z.unknown().optional().nullable(),
    is_active: z.boolean().optional().nullable(),
    status: z.string().optional().nullable(),
  })
  .passthrough();

const pvzListResponseSchema = z
  .object({
    result: z.array(pvzItemSchema).optional().nullable(),
    items: z.array(pvzItemSchema).optional().nullable(),
    data: z.array(pvzItemSchema).optional().nullable(),
    total: z.number().optional().nullable(),
    has_next: z.boolean().optional().nullable(),
    cursor: z.string().optional().nullable(),
    page: z.number().optional().nullable(),
    per_page: z.number().optional().nullable(),
  })
  .passthrough();

const tokenResponseSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string().optional().nullable(),
    expires_in: z.number().optional().nullable(),
  })
  .passthrough();

export function isOzonDeliveryConfigured(): boolean {
  return !!env.OZON_DELIVERY_CLIENT_ID && !!env.OZON_DELIVERY_CLIENT_SECRET;
}

/** Получает access_token через refresh_token из БД; при ротации — сохраняет новый. */
async function getDeliveryAccessToken(): Promise<string> {
  const clientId = env.OZON_DELIVERY_CLIENT_ID;
  const clientSecret = env.OZON_DELIVERY_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("ozon_delivery_not_configured");

  const row = await db
    .select({ refreshToken: ozonDeliveryToken.refreshToken })
    .from(ozonDeliveryToken)
    .where(eq(ozonDeliveryToken.id, "current"))
    .then((rows) => rows[0] ?? null);

  if (!row) throw new Error("ozon_delivery_refresh_token_missing");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refreshToken,
  });

  const res = await fetch(`${OZON_DELIVERY_API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ozon_delivery_oauth_failed_${res.status}: ${detail}`);
  }

  const data = tokenResponseSchema.parse(await res.json());

  // Сохраняем новый refresh_token если Ozon ротировал его
  if (data.refresh_token && data.refresh_token !== row.refreshToken) {
    await db
      .update(ozonDeliveryToken)
      .set({
        refreshToken: data.refresh_token,
        updatedAt: new Date(),
      })
      .where(eq(ozonDeliveryToken.id, "current"));
    logger.info("ozon.delivery.token_rotated");
  }

  return data.access_token;
}

/** Загружает все страницы ПВЗ из Ozon Доставки. */
async function fetchAllPickupPoints(
  accessToken: string,
): Promise<z.infer<typeof pvzItemSchema>[]> {
  const all: z.infer<typeof pvzItemSchema>[] = [];
  let page = 1;
  let cursor: string | undefined;

  while (true) {
    const body: Record<string, unknown> = {
      per_page: PVZ_PAGE_SIZE,
    };
    if (cursor) {
      body.cursor = cursor;
    } else {
      body.page = page;
    }

    const res = await fetch(`${OZON_DELIVERY_API_URL}/v1/delivery/point/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `ozon_delivery_pvz_request_failed_${res.status}: ${detail}`,
      );
    }

    const data = pvzListResponseSchema.parse(await res.json());

    // API может вернуть items в разных полях
    const items = data.result ?? data.items ?? data.data ?? [];
    all.push(...items);

    // Определяем нужна ли следующая страница
    if (data.cursor) {
      cursor = data.cursor;
    } else if (data.has_next === true) {
      page += 1;
      cursor = undefined;
    } else if (items.length === PVZ_PAGE_SIZE) {
      // Нет явного признака конца — пробуем следующую страницу
      page += 1;
      cursor = undefined;
    } else {
      break;
    }
  }

  return all;
}

/** Маппинг сырого ответа Ozon в строку БД. */
function mapToInsert(
  item: z.infer<typeof pvzItemSchema>,
  now: Date,
): {
  id: string;
  name: string;
  address: string;
  city: string | null;
  lat: number;
  lon: number;
  workingHours: unknown;
  meta: unknown;
  isActive: boolean;
  syncedAt: Date;
} | null {
  const id = item.delivery_point_id ?? item.id;
  if (!id) return null;

  const coords = item.coordinates ?? item.location;
  const lat = coords?.lat ?? coords?.latitude;
  const lon = coords?.lon ?? coords?.longitude;
  if (lat == null || lon == null) return null;

  const address = item.address ?? item.full_address;
  if (!address) return null;

  const name = item.name ?? address;
  const isActive =
    item.is_active !== false &&
    (item.status == null ||
      item.status === "active" ||
      item.status === "ACTIVE" ||
      item.status === "enabled");

  const workingHours = item.working_hours ?? item.schedule ?? null;

  // Всё остальное — в meta
  const {
    delivery_point_id,
    id: _id,
    name: _name,
    address: _addr,
    full_address,
    city,
    coordinates,
    location,
    working_hours,
    schedule,
    is_active,
    status,
    ...rest
  } = item as Record<string, unknown> & z.infer<typeof pvzItemSchema>;
  const meta = Object.keys(rest).length > 0 ? rest : null;

  return {
    id,
    name,
    address,
    city: item.city ?? null,
    lat,
    lon,
    workingHours,
    meta,
    isActive,
    syncedAt: now,
  };
}

/**
 * Синхронизирует список ПВЗ Ozon Доставки в локальную БД.
 * Возвращает `configured: false` если не задан env или нет токена.
 */
export async function syncOzonPickupPoints(): Promise<OzonPvzSyncResult> {
  const accessToken = await getDeliveryAccessToken();
  const rawItems = await fetchAllPickupPoints(accessToken);

  const now = new Date();
  const toUpsert = rawItems.flatMap((item) => {
    const mapped = mapToInsert(item, now);
    return mapped ? [mapped] : [];
  });

  if (toUpsert.length === 0) {
    logger.warn("ozon.pvz.sync_empty", { raw: rawItems.length });
    return { configured: true, upserted: 0, deactivated: 0 };
  }

  // Upsert батчами по 500 (Neon имеет ограничения параметров)
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const batch = toUpsert.slice(i, i + BATCH);
    await db
      .insert(ozonPickupPoints)
      .values(batch)
      .onConflictDoUpdate({
        target: ozonPickupPoints.id,
        set: {
          name: sql`excluded.name`,
          address: sql`excluded.address`,
          city: sql`excluded.city`,
          lat: sql`excluded.lat`,
          lon: sql`excluded.lon`,
          workingHours: sql`excluded.working_hours`,
          meta: sql`excluded.meta`,
          isActive: sql`excluded.is_active`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
    upserted += batch.length;
  }

  // Пометить закрытыми те ПВЗ, которых нет в свежем ответе Ozon
  const freshIds = toUpsert.map((r) => r.id);
  const deactivated = await db
    .update(ozonPickupPoints)
    .set({ isActive: false })
    .where(
      and(
        eq(ozonPickupPoints.isActive, true),
        notInArray(ozonPickupPoints.id, freshIds),
      ),
    )
    .returning({ id: ozonPickupPoints.id });

  logger.info("ozon.pvz.synced", { upserted, deactivated: deactivated.length });
  return { configured: true, upserted, deactivated: deactivated.length };
}

/** Все активные ПВЗ из локального кэша. */
export async function getPickupPointsFromCache(): Promise<
  (typeof ozonPickupPoints.$inferSelect)[]
> {
  return db
    .select()
    .from(ozonPickupPoints)
    .where(eq(ozonPickupPoints.isActive, true));
}

/** ПВЗ по ID из кэша; `null` если не найден. */
export async function getPickupPointById(
  id: string,
): Promise<typeof ozonPickupPoints.$inferSelect | null> {
  const rows = await db
    .select()
    .from(ozonPickupPoints)
    .where(eq(ozonPickupPoints.id, id))
    .limit(1);
  return rows[0] ?? null;
}
