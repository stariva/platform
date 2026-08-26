import { env } from "@/env";

/**
 * OAuth-авторизация для методов Ozon Доставка (частное приложение,
 * client_credentials). Отдельно от классического Api-Key/Client-Id заголовка
 * Ozon Seller API (`lib/ozon/api-client.ts`) — методы Ozon Доставка требуют
 * именно OAuth-токен.
 *
 * TODO(ozon-delivery): уточнить точный путь токен-эндпоинта и форму ответа
 * после одобрения заявки и выдачи доступа в кабинете продавца — на момент
 * написания публичной OpenAPI-схемы нет, эндпоинт собран по общей практике
 * client_credentials + описанию Ozon Seller API (snake_case JSON).
 */

const TOKEN_URL = "https://api-seller.ozon.ru/v1/oauth/token";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cached: CachedToken | undefined;

export function isOzonDeliveryConfigured(): boolean {
  return Boolean(
    env.OZON_DELIVERY_CLIENT_ID && env.OZON_DELIVERY_CLIENT_SECRET,
  );
}

export async function getOzonDeliveryToken(): Promise<string> {
  const clientId = env.OZON_DELIVERY_CLIENT_ID;
  const clientSecret = env.OZON_DELIVERY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ozon_delivery_not_configured");
  }

  const now = Date.now();
  // 60s запас, чтобы не отправить запрос токеном, который истечёт в пути
  if (cached && cached.expiresAt - 60_000 > now) {
    return cached.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ozon_delivery_auth_failed_${res.status}: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cached.accessToken;
}
