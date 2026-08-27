import { z } from "zod";
import { env } from "@/env";

/**
 * Ozon Доставка — приватное приложение с OAuth-авторизацией.
 * Обмен кода авторизации на refresh_token делается один раз вручную
 * (см. /api/ozon-delivery/oauth/callback), после чего access_token
 * обновляется автоматически по refresh_token при каждом запросе к API.
 * https://docs.ozon.ru/api/applications/#section/Poluchit-OAuth-token
 */
const OAUTH_TOKEN_URL = "https://xapi.ozon.ru/oauth/token";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
});

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let refreshPromise: Promise<string> | null = null;

export function isOzonDeliveryConfigured(): boolean {
  return (
    !!env.OZON_DELIVERY_CLIENT_ID &&
    !!env.OZON_DELIVERY_CLIENT_SECRET &&
    !!env.OZON_DELIVERY_REFRESH_TOKEN
  );
}

async function refreshAccessToken(): Promise<string> {
  if (!isOzonDeliveryConfigured()) {
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
        refresh_token: env.OZON_DELIVERY_REFRESH_TOKEN,
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
