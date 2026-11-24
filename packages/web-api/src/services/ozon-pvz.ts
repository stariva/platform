import { logger } from "@stariva/config";
import { and, type Database, db, eq, sql } from "@stariva/db";
import { createDatabase } from "@stariva/db/client";
import { ozonDeliveryToken, ozonPickupPoints } from "@stariva/db/schema";
import { z } from "zod";
import { OZON_PVZ_SYNC_TIMEOUTS } from "../contract/jobs";
import { env } from "../env";

const OZON_DELIVERY_OAUTH_URL = "https://xapi.ozon.ru";
const OZON_DELIVERY_API_URL = "https://api.ozon.ru";
const PVZ_PAGE_SIZE = 1000;
const DB_TIMEOUT_MS = 5_000;
// Интерактивная транзакция держит блокировку между HTTP-запросами к Ozon.
const syncDb = createDatabase("node", {
  connectionTimeoutMillis: DB_TIMEOUT_MS,
});

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
async function getDeliveryAccessToken(
  tx: Database,
  signal: AbortSignal,
): Promise<string> {
  const clientId = env.OZON_DELIVERY_CLIENT_ID;
  const clientSecret = env.OZON_DELIVERY_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("ozon_delivery_not_configured");

  const row = await tx
    .select({ refreshToken: ozonDeliveryToken.refreshToken })
    .from(ozonDeliveryToken)
    .where(eq(ozonDeliveryToken.id, "current"))
    .then((rows) => rows[0] ?? null);

  signal.throwIfAborted();
  if (!row) throw new Error("ozon_delivery_refresh_token_missing");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refreshToken,
  });

  const res = await fetch(`${OZON_DELIVERY_OAUTH_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ozon_delivery_oauth_failed_${res.status}: ${detail}`);
  }

  const data = tokenResponseSchema.parse(await res.json());

  // Сохраняем новый refresh_token если Ozon ротировал его
  if (data.refresh_token && data.refresh_token !== row.refreshToken) {
    await tx
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
  signal: AbortSignal,
): Promise<z.infer<typeof pvzItemSchema>[]> {
  const all: z.infer<typeof pvzItemSchema>[] = [];
  let page = 1;
  let cursor: string | undefined;

  while (true) {
    signal.throwIfAborted();
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
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
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
  id: string,
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

/** Синхронизирует список ПВЗ Ozon Доставки в локальную БД. */
export async function syncOzonPickupPoints(
  requestSignal?: AbortSignal,
): Promise<OzonPvzSyncResult> {
  const deadline = AbortSignal.timeout(OZON_PVZ_SYNC_TIMEOUTS.serverMs);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, deadline])
    : deadline;
  signal.throwIfAborted();

  const result = await syncDb.transaction(async (tx) => {
    signal.throwIfAborted();
    // Лимит для каждого SQL-запроса, включая ожидание блокировок при записи.
    await tx.execute(sql`select
      set_config('statement_timeout', ${String(DB_TIMEOUT_MS)}, true),
      set_config('idle_in_transaction_session_timeout', ${String(OZON_PVZ_SYNC_TIMEOUTS.clientMs)}, true)`);
    const lock = await tx.execute<{ acquired: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtextextended('ozon-pvz-sync', 0)) as acquired`,
    );
    signal.throwIfAborted();
    if (!lock.rows[0]?.acquired) throw new Error("ozon_pvz_sync_in_progress");

    // Ротация токена должна сохраниться даже при сбое загрузки страниц.
    const accessToken = await syncDb.transaction(async (tokenTx) => {
      signal.throwIfAborted();
      await tokenTx.execute(sql`select
        set_config('statement_timeout', ${String(DB_TIMEOUT_MS)}, true),
        set_config('idle_in_transaction_session_timeout', '15000', true)`);
      signal.throwIfAborted();
      return getDeliveryAccessToken(tokenTx, signal);
    });

    const rawItems = await fetchAllPickupPoints(accessToken, signal);
    const now = new Date();
    const freshIds = new Set<string>();
    const toUpsert = rawItems.flatMap((item) => {
      const id = item.delivery_point_id ?? item.id;
      if (!id) return [];
      freshIds.add(id);
      const mapped = mapToInsert(item, id, now);
      return mapped ? [mapped] : [];
    });

    signal.throwIfAborted();
    // Не деактивируем кэш, если ответ не содержит ни одной пригодной записи.
    if (toUpsert.length === 0) {
      logger.warn("ozon.pvz.sync_empty", { raw: rawItems.length });
      return { configured: true, upserted: 0, deactivated: 0 };
    }

    return updatePickupPoints(tx, signal, toUpsert, [...freshIds]);
  });

  logger.info("ozon.pvz.synced", {
    upserted: result.upserted,
    deactivated: result.deactivated,
  });
  return result;
}

async function updatePickupPoints(
  tx: Database,
  signal: AbortSignal,
  toUpsert: NonNullable<ReturnType<typeof mapToInsert>>[],
  freshIds: string[],
): Promise<OzonPvzSyncResult> {
  // Upsert батчами по 500 (Neon имеет ограничения параметров)
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    signal.throwIfAborted();
    const batch = toUpsert.slice(i, i + BATCH);
    await tx
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
  signal.throwIfAborted();
  const deactivated = await tx
    .update(ozonPickupPoints)
    .set({ isActive: false })
    .where(
      and(
        eq(ozonPickupPoints.isActive, true),
        sql`${ozonPickupPoints.id} <> ALL(${sql.param(freshIds)}::text[])`,
      ),
    )
    .returning({ id: ozonPickupPoints.id });

  signal.throwIfAborted();
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
