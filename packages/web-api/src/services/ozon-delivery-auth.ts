import { logger } from "@stariva/config";
import { and, type Database, eq, sql } from "@stariva/db";
import { createDatabase } from "@stariva/db/client";
import { ozonDeliveryToken } from "@stariva/db/schema";
import { z } from "zod";
import { env } from "../env";

const OAUTH_TOKEN_URL = "https://xapi.ozon.ru/oauth/token";
const TOKEN_ROW_ID = "current";
const DB_TIMEOUT_MS = 5_000;
// OAuth-запрос идёт внутри транзакции с advisory lock: ждущий конкурент
// должен пережить чужой десятисекундный таймаут, а не падать раньше.
const LOCK_TIMEOUT_MS = 15_000;
const TRANSACTION_TIMEOUT_MS = 20_000;
const OAUTH_TIMEOUT_MS = 10_000;
const FALLBACK_ACCESS_TOKEN_TTL_MS = 60_000;

// Токен обновляется только в Node runtime: neon-http не даёт интерактивных
// транзакций, а без них нельзя держать advisory lock через сетевой запрос.
const tokenDb = createDatabase("node", {
  connectionTimeoutMillis: DB_TIMEOUT_MS,
});

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional().nullable(),
    expires_in: z.coerce.number().int().positive().optional().nullable(),
  })
  .passthrough();

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let refreshPromise: Promise<{ accessToken: string; expiresAt: number }> | null =
  null;

/** Срок действия из claim `exp` JWT, мс; null, если токен не JWT или без `exp`. */
function jwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Синхронная проверка только по client credentials. Сам refresh_token живёт
 * в БД; env-значение — одноразовый seed для первого запуска, поэтому его
 * наличие не требуется после успешной авторизации.
 */
export function isOzonDeliveryConfigured(): boolean {
  return !!env.OZON_DELIVERY_CLIENT_ID && !!env.OZON_DELIVERY_CLIENT_SECRET;
}

async function lockTokenRotation(tx: Database): Promise<void> {
  await tx.execute(sql`select
    set_config('statement_timeout', ${String(LOCK_TIMEOUT_MS)}, true),
    set_config('lock_timeout', ${String(LOCK_TIMEOUT_MS)}, true),
    set_config('idle_in_transaction_session_timeout', ${String(TRANSACTION_TIMEOUT_MS)}, true)`);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('ozon-delivery-refresh-token', 0))`,
  );
  await tx.execute(
    sql`select set_config('statement_timeout', ${String(DB_TIMEOUT_MS)}, true)`,
  );
}

/**
 * Ручная переавторизация тоже проходит через тот же advisory lock: она не
 * должна вклиниться между чужим refresh и записью отротированного токена.
 */
export async function persistOzonDeliveryRefreshToken(
  refreshToken: string,
): Promise<void> {
  await tokenDb.transaction(async (tx) => {
    await lockTokenRotation(tx);
    await tx
      .insert(ozonDeliveryToken)
      .values({ id: TOKEN_ROW_ID, refreshToken, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: ozonDeliveryToken.id,
        set: { refreshToken, updatedAt: new Date() },
      });
  });
  cachedToken = null;
}

/**
 * Если соединение с БД оборвалось уже после ответа Ozon, обычный rollback не
 * отменяет ротацию на стороне Ozon. Пробуем сохранить новый токен повторно,
 * поверх прежнего значения или вместо seed, исчезнувшего при откате.
 */
async function recoverRotatedRefreshToken(
  previous: string,
  next: string,
  insertedSeed: boolean,
): Promise<boolean> {
  try {
    return await tokenDb.transaction(async (tx) => {
      await lockTokenRotation(tx);
      const [row] = await tx
        .select({ refreshToken: ozonDeliveryToken.refreshToken })
        .from(ozonDeliveryToken)
        .where(eq(ozonDeliveryToken.id, TOKEN_ROW_ID))
        .limit(1);
      if (row?.refreshToken === next) return true;
      if (!row && insertedSeed) {
        const inserted = await tx
          .insert(ozonDeliveryToken)
          .values({
            id: TOKEN_ROW_ID,
            refreshToken: next,
            updatedAt: new Date(),
          })
          .onConflictDoNothing({ target: ozonDeliveryToken.id })
          .returning({ id: ozonDeliveryToken.id });
        return inserted.length > 0;
      }
      if (row?.refreshToken !== previous) return false;
      const updated = await tx
        .update(ozonDeliveryToken)
        .set({ refreshToken: next, updatedAt: new Date() })
        .where(
          and(
            eq(ozonDeliveryToken.id, TOKEN_ROW_ID),
            eq(ozonDeliveryToken.refreshToken, previous),
          ),
        )
        .returning({ id: ozonDeliveryToken.id });
      return updated.length > 0;
    });
  } catch (error) {
    logger.error("ozon.delivery.token_rotation_persist_failed", error);
    return false;
  }
}

async function currentRefreshToken(
  tx: Database,
): Promise<{ refreshToken: string; insertedSeed: boolean }> {
  const [row] = await tx
    .select({ refreshToken: ozonDeliveryToken.refreshToken })
    .from(ozonDeliveryToken)
    .where(eq(ozonDeliveryToken.id, TOKEN_ROW_ID))
    .limit(1);
  if (row?.refreshToken) {
    return { refreshToken: row.refreshToken, insertedSeed: false };
  }

  // Единственный допустимый fallback на env: строки в БД ещё нет. Если БД
  // недоступна или строка уже есть, старый env не используем — он мог давно
  // отстать от отротированного значения и вернуть интеграцию в сломанное состояние.
  const seed = env.OZON_DELIVERY_REFRESH_TOKEN;
  if (!seed) throw new Error("ozon_delivery_refresh_token_missing");
  const inserted = await tx
    .insert(ozonDeliveryToken)
    .values({
      id: TOKEN_ROW_ID,
      refreshToken: seed,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: ozonDeliveryToken.id })
    .returning({ id: ozonDeliveryToken.id });
  if (inserted.length > 0) {
    return { refreshToken: seed, insertedSeed: true };
  }
  const [seeded] = await tx
    .select({ refreshToken: ozonDeliveryToken.refreshToken })
    .from(ozonDeliveryToken)
    .where(eq(ozonDeliveryToken.id, TOKEN_ROW_ID))
    .limit(1);
  if (!seeded?.refreshToken)
    throw new Error("ozon_delivery_refresh_token_missing");
  return { refreshToken: seeded.refreshToken, insertedSeed: false };
}

function accessTokenExpiry(
  accessToken: string,
  expiresIn: number | null | undefined,
): number {
  const candidates: number[] = [];
  if (expiresIn) candidates.push(Date.now() + (expiresIn - 60) * 1000);
  const jwtExpiresAt = jwtExpiryMs(accessToken);
  if (jwtExpiresAt !== null) candidates.push(jwtExpiresAt - 60_000);
  return candidates.length > 0
    ? Math.min(...candidates)
    : Date.now() + FALLBACK_ACCESS_TOKEN_TTL_MS;
}

/**
 * Атомарно относительно других инстансов приложения обновляет access_token.
 *
 * Refresh token у Ozon одноразовый: параллельный refresh одним и тем же
 * значением может оставить в БД уже отозванную цепочку. Поэтому весь цикл
 * «прочитать → обменять → сохранить» держит один и тот же Postgres advisory
 * lock. Дополнительно update сравнивает старое значение: если его кто-то
 * изменил вне lock'а, мы не перезаписываем чужой более свежий токен.
 */
async function refreshOzonDeliveryAccessToken(): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  if (!isOzonDeliveryConfigured())
    throw new Error("ozon_delivery_not_configured");

  const state: {
    rotated?: { previous: string; next: string; insertedSeed: boolean };
    refreshedToken?: { accessToken: string; expiresAt: number };
  } = {};

  try {
    return await tokenDb.transaction(async (tx) => {
      await lockTokenRotation(tx);
      const { refreshToken, insertedSeed } = await currentRefreshToken(tx);

      let res: Response;
      try {
        res = await fetch(OAUTH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          redirect: "error",
          signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: env.OZON_DELIVERY_CLIENT_ID ?? "",
            client_secret: env.OZON_DELIVERY_CLIENT_SECRET ?? "",
            refresh_token: refreshToken,
          }).toString(),
        });
      } catch (error) {
        throw new Error(`ozon_delivery_oauth_failed_network: ${String(error)}`);
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`ozon_delivery_oauth_failed_${res.status}: ${detail}`);
      }

      const parsed = tokenResponseSchema.safeParse(
        await res.json().catch(() => null),
      );
      if (!parsed.success) {
        throw new Error(
          `ozon_delivery_oauth_bad_response: ${parsed.error.message}`,
        );
      }
      const data = parsed.data;
      const result = {
        accessToken: data.access_token,
        expiresAt: accessTokenExpiry(data.access_token, data.expires_in),
      };
      state.refreshedToken = result;

      if (data.refresh_token && data.refresh_token !== refreshToken) {
        state.rotated = {
          previous: refreshToken,
          next: data.refresh_token,
          insertedSeed,
        };
        const updated = await tx
          .update(ozonDeliveryToken)
          .set({ refreshToken: data.refresh_token, updatedAt: new Date() })
          .where(
            and(
              eq(ozonDeliveryToken.id, TOKEN_ROW_ID),
              eq(ozonDeliveryToken.refreshToken, refreshToken),
            ),
          )
          .returning({ id: ozonDeliveryToken.id });
        if (updated.length === 0) {
          throw new Error("ozon_delivery_refresh_token_changed_during_refresh");
        }
        logger.info("ozon.delivery.token_rotated");
      }

      return result;
    });
  } catch (error) {
    if (
      state.rotated &&
      state.refreshedToken &&
      (await recoverRotatedRefreshToken(
        state.rotated.previous,
        state.rotated.next,
        state.rotated.insertedSeed,
      ))
    ) {
      logger.warn("ozon.delivery.token_rotation_recovered");
      return state.refreshedToken;
    }
    throw error;
  }
}

/** Access token с process-local кэшем; параллельные вызовы делят один refresh. */
export async function getOzonDeliveryAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }
  // Сюда специально не пробрасывается signal покупателя или джобы: отмена
  // одного ожидающего не должна обрывать общий refresh для остальных.
  refreshPromise ??= refreshOzonDeliveryAccessToken()
    .then((token) => {
      cachedToken = token;
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return (await refreshPromise).accessToken;
}

/**
 * Ozon отверг access token (401) — забываем только его: параллельный запрос
 * мог уже получить более свежий.
 */
export function invalidateOzonDeliveryAccessToken(accessToken: string): void {
  if (cachedToken?.accessToken === accessToken) cachedToken = null;
}
