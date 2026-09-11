import { db, ozonDeliveryToken } from "@stariva/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";

/**
 * Ozon Доставка — приватное приложение с OAuth-авторизацией.
 * Обмен кода авторизации на refresh_token делается один раз вручную
 * (см. /api/ozon-delivery/oauth/callback), после чего access_token
 * обновляется автоматически по refresh_token при каждом запросе к API.
 * https://docs.ozon.ru/api/applications/#section/Poluchit-OAuth-token
 *
 * Ozon может выдавать новый refresh_token при каждом обновлении access_token
 * и инвалидировать старый (обычная ротация OAuth). Поэтому актуальный
 * refresh_token хранится в БД (таблица ozon_delivery_token) — значение из
 * env используется только как первоначальный seed, если в БД ещё пусто.
 */
const OAUTH_TOKEN_URL = "https://xapi.ozon.ru/oauth/token";
const TOKEN_ROW_ID = "current";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.coerce.number().int().positive(),
  token_type: z.string().min(1),
});

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let refreshPromise: Promise<string> | null = null;

// Дешёвая синхронная проверка для роутов — специально не ходит в БД.
// OZON_DELIVERY_REFRESH_TOKEN нужно оставлять заданным навсегда (даже
// после того, как БД начнёт хранить актуальный, уже отротированный
// токен) — иначе этот guard будет считать интеграцию невключённой.
export function isOzonDeliveryConfigured(): boolean {
  return (
    !!env.OZON_DELIVERY_CLIENT_ID &&
    !!env.OZON_DELIVERY_CLIENT_SECRET &&
    !!env.OZON_DELIVERY_REFRESH_TOKEN
  );
}

async function getCurrentRefreshToken(): Promise<string | undefined> {
  try {
    const [row] = await db
      .select({ refreshToken: ozonDeliveryToken.refreshToken })
      .from(ozonDeliveryToken)
      .where(eq(ozonDeliveryToken.id, TOKEN_ROW_ID))
      .limit(1);
    if (row?.refreshToken) return row.refreshToken;
  } catch (error) {
    console.error(
      "[ozon-delivery] Не удалось прочитать refresh_token из БД:",
      error,
    );
  }
  return env.OZON_DELIVERY_REFRESH_TOKEN;
}

export async function persistOzonDeliveryRefreshToken(
  refreshToken: string,
): Promise<void> {
  await db
    .insert(ozonDeliveryToken)
    .values({ id: TOKEN_ROW_ID, refreshToken, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: ozonDeliveryToken.id,
      set: { refreshToken, updatedAt: new Date() },
    });
}

async function refreshAccessToken(): Promise<string> {
  if (!isOzonDeliveryConfigured()) {
    throw new Error("ozon_delivery_not_configured");
  }

  const refreshToken = await getCurrentRefreshToken();
  if (!refreshToken) {
    throw new Error("ozon_delivery_not_configured");
  }

  let res: Response;
  try {
    res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: env.OZON_DELIVERY_CLIENT_ID,
        client_secret: env.OZON_DELIVERY_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });
  } catch (error) {
    throw new Error(
      `ozon_delivery_oauth_refresh_failed_network: ${String(error)}`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `ozon_delivery_oauth_refresh_failed_${res.status}: ${detail}`,
    );
  }

  const data = tokenResponseSchema.parse(await res.json());
  // Обновляем чуть раньше истечения срока, чтобы не ловить 401 в середине запроса.
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  cachedToken = { accessToken: data.access_token, expiresAt };

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    try {
      await persistOzonDeliveryRefreshToken(data.refresh_token);
    } catch (error) {
      console.error(
        "[ozon-delivery] Не удалось сохранить новый refresh_token — следующий рефреш может упасть с invalid_refresh_token:",
        error,
      );
    }
  }

  return data.access_token;
}

export async function getOzonDeliveryToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }
  // Не запускаем параллельные обновления, если несколько запросов пришли одновременно.
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
