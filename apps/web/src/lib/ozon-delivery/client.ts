import { getOzonDeliveryToken, isOzonDeliveryConfigured } from "./auth";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  DeliveryCheckoutRequest,
  DeliveryCheckoutResponse,
  DeliveryCheckResponse,
  PickupPoint,
  PickupPointListResponse,
  Posting,
} from "./types";

/**
 * Клиент методов Ozon Доставка (продажа со своего сайта, доставка Ozon).
 *
 * TODO(ozon-delivery): пути методов и форма запросов/ответов собраны по
 * описанию на dev.ozon.ru (v1/delivery/check, v1/delivery/map,
 * v1/delivery/point/list, v1/delivery/point/info, v2/delivery/checkout,
 * v2/order/create, v2/posting/fbo/*, v3/posting/fbs/*, v1/cancel-reason/*,
 * v1/order/cancel, v1/posting/cancel, v1/returns/list, v4/product/info/stocks).
 * Тестовой среды у Ozon нет — точные поля тел запроса/ответа нужно свериться
 * при первом реальном вызове (см. README/TODO рядом) и поправить маппинг
 * здесь, не трогая остальной код (checkout-флоу, БД, UI на него не завязаны
 * напрямую — все проходит через эти функции).
 */

export { isOzonDeliveryConfigured };

const BASE_URL = "https://api-seller.ozon.ru";

async function ozonDeliveryFetch<T>(path: string, body: unknown): Promise<T> {
  const token = await getOzonDeliveryToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ozon_delivery_request_failed_${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}

export async function checkDeliveryAvailable(
  phone: string,
): Promise<DeliveryCheckResponse> {
  return ozonDeliveryFetch<DeliveryCheckResponse>("/v1/delivery/check", {
    phone,
  });
}

export async function listPickupPoints(): Promise<PickupPoint[]> {
  const data = await ozonDeliveryFetch<PickupPointListResponse>(
    "/v1/delivery/point/list",
    {},
  );
  return data.points;
}

export async function checkout(
  request: DeliveryCheckoutRequest,
): Promise<DeliveryCheckoutResponse> {
  return ozonDeliveryFetch<DeliveryCheckoutResponse>(
    "/v2/delivery/checkout",
    request,
  );
}

/**
 * Создаёт заказ в Ozon Доставка. Вызывать ТОЛЬКО после подтверждённой оплаты —
 * состав заказа нельзя изменить после создания.
 */
export async function createOzonDeliveryOrder(
  request: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  return ozonDeliveryFetch<CreateOrderResponse>("/v2/order/create", request);
}

export async function getFbsPosting(postingNumber: string): Promise<Posting> {
  return ozonDeliveryFetch<Posting>("/v3/posting/fbs/get", {
    posting_number: postingNumber,
  });
}

export async function getFboPosting(postingNumber: string): Promise<Posting> {
  return ozonDeliveryFetch<Posting>("/v2/posting/fbo/get", {
    posting_number: postingNumber,
  });
}

/**
 * Отмена асинхронная — возвращать деньги покупателю нужно только после
 * подтверждения статуса отмены (см. дальнейший опрос статуса в Ozon).
 */
export async function cancelOzonDeliveryOrder(
  orderId: string,
  reasonId: number,
): Promise<void> {
  await ozonDeliveryFetch<unknown>("/v1/order/cancel", {
    order_id: orderId,
    cancel_reason_id: reasonId,
  });
}
