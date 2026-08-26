// Ozon Доставка — типы запросов/ответов.
// Собраны по официальному описанию методов (docs.ozon.ru/api/rocket →
// заменено на Ozon Доставка, dev.ozon.ru, статья от 06.11.2025), а не по
// готовому SDK — публичной OpenAPI-схемы на момент написания нет.

export interface DeliveryCheckRequest {
  phone: string;
}

export interface DeliveryCheckResponse {
  available: boolean;
  /** Причина недоступности, если available === false */
  reason?: string;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  workSchedule?: string;
}

export interface PickupPointListResponse {
  points: PickupPoint[];
}

export interface CheckoutItem {
  /** fbs_sku или fbo_sku в зависимости от схемы товара */
  sku: number;
  quantity: number;
}

export type DeliverySelection =
  | { method: "pickup"; pointId: string }
  | {
      method: "courier";
      address: string;
      latitude: number;
      longitude: number;
    };

export interface DeliveryCheckoutRequest {
  items: CheckoutItem[];
  delivery: DeliverySelection;
}

export interface CheckoutSplitItem {
  sku: number;
  quantity: number;
  warehouseId: number;
}

export interface CheckoutSplit {
  warehouseId: number;
  items: CheckoutSplitItem[];
  /** Ожидаемая дата доставки, ISO-8601 */
  estimatedDeliveryDate: string;
}

export interface DeliveryCheckoutResponse {
  available: boolean;
  reason?: string;
  /** Стоимость доставки в копейках */
  deliveryPriceKopecks: number;
  splits: CheckoutSplit[];
}

export interface OrderRecipient {
  name: string;
  phone: string;
  email?: string;
}

export interface CreateOrderRequest {
  items: CheckoutItem[];
  delivery: DeliverySelection;
  recipient: OrderRecipient;
  /** Снапшот ответа v2/delivery/checkout — состав нельзя менять после checkout */
  checkout: DeliveryCheckoutResponse;
  /** Ключ идемпотентности на нашей стороне (id нашего productOrder) */
  clientOrderId: string;
}

export interface CreateOrderResponse {
  orderId: string;
  postingNumbers: string[];
}

export type PostingStatus =
  | "awaiting_packaging"
  | "awaiting_deliver"
  | "delivering"
  | "delivered"
  | "cancelled"
  | (string & {});

export interface Posting {
  postingNumber: string;
  status: PostingStatus;
  trackingUrl?: string;
  updatedAt: string;
}
