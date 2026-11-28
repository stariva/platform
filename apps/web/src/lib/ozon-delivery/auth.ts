import {
  getOzonDeliveryAccessToken,
  invalidateOzonDeliveryAccessToken,
  isOzonDeliveryConfigured as isOzonDeliveryAuthConfigured,
  persistOzonDeliveryRefreshToken as persistRefreshToken,
} from "@stariva/web-api/ozon-delivery-auth";
import { OzonDeliveryError } from "./errors";

/**
 * Checkout и sync ПВЗ используют один общий механизм из @stariva/web-api:
 * refresh_token хранится в ozon_delivery_token, а весь цикл ротации
 * сериализуется Postgres advisory lock'ом. Этот модуль оставляет прежний
 * API для кода витрины и переводит ошибки в OzonDeliveryError, чтобы заказ
 * падал в ручную доставку, а не в 500.
 */
export function isOzonDeliveryConfigured(): boolean {
  return isOzonDeliveryAuthConfigured();
}

export async function persistOzonDeliveryRefreshToken(
  refreshToken: string,
): Promise<void> {
  await persistRefreshToken(refreshToken);
}

export function invalidateOzonDeliveryToken(token: string): void {
  invalidateOzonDeliveryAccessToken(token);
}

export async function getOzonDeliveryToken(): Promise<string> {
  if (!isOzonDeliveryConfigured()) {
    throw new OzonDeliveryError("ozon_delivery_not_configured", true);
  }
  try {
    return await getOzonDeliveryAccessToken();
  } catch (error) {
    throw new OzonDeliveryError(
      error instanceof Error ? error.message : String(error),
      true,
    );
  }
}
